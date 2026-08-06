import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { updateStates } from './state.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3030);
const DATA_FILE = path.join(__dirname, 'data', 'state.json');
const POLL_MS = Number(process.env.POLL_MS || 15000);

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}
function config() {
  return {
    mode: process.env.THREECX_MODE || 'mock',
    baseUrl: process.env.THREECX_BASE_URL || '',
    token: process.env.THREECX_TOKEN || '',
    agentsPath: process.env.THREECX_AGENTS_PATH || '/xapi/v1/Users',
    queuePath: process.env.THREECX_QUEUE_PATH || '/xapi/v1/Queues',
    timezone: process.env.BUSINESS_TIMEZONE || 'Pacific/Auckland'
  };
}
function mockSnapshot() {
  const n = Date.now();
  return [
    { id:'101', name:'Alex Morgan', extension:'101', queue:'Support', signedIn:true, phoneStatus:'Available', callsToday:14 },
    { id:'102', name:'Jamie Lee', extension:'102', queue:'Support', signedIn:false, phoneStatus:'Away', callsToday:9 },
    { id:'103', name:'Sam Patel', extension:'103', queue:'Sales', signedIn:true, phoneStatus:n % 60000 < 30000 ? 'On call' : 'Available', callsToday:18 },
    { id:'104', name:'Taylor Kim', extension:'104', queue:'Sales', signedIn:false, phoneStatus:'DND', callsToday:6 }
  ];
}
async function get3cxSnapshot() {
  const c = config();
  if (c.mode === 'mock') return mockSnapshot();
  if (!c.baseUrl || !c.token) throw new Error('THREECX_BASE_URL and THREECX_TOKEN are required in live mode');
  const headers = { Authorization: `Bearer ${c.token}`, Accept: 'application/json' };
  const [usersResponse, queuesResponse] = await Promise.all([
    fetch(new URL(c.agentsPath, c.baseUrl), { headers }),
    fetch(new URL(c.queuePath, c.baseUrl), { headers })
  ]);
  if (!usersResponse.ok) throw new Error(`Users endpoint returned ${usersResponse.status}`);
  if (!queuesResponse.ok) throw new Error(`Queues endpoint returned ${queuesResponse.status}`);
  return normalise3cx(await usersResponse.json(), await queuesResponse.json());
}
function values(payload) { return Array.isArray(payload) ? payload : payload?.value || payload?.items || []; }
function normalise3cx(usersPayload, queuesPayload) {
  const users = values(usersPayload);
  const queues = values(queuesPayload);
  const memberships = new Map();
  for (const q of queues) {
    const queueName = q.Name || q.name || q.Number || q.number || 'Queue';
    for (const member of q.Agents || q.agents || q.Members || q.members || []) {
      const key = String(member.Number || member.number || member.DN || member.dn || member.Id || member.id || '');
      if (!key) continue;
      memberships.set(key, { queue: queueName, signedIn: Boolean(member.LoggedIn ?? member.loggedIn ?? member.IsLoggedIn ?? member.isLoggedIn) });
    }
  }
  return users.map((u) => {
    const extension = String(u.Number || u.number || u.DN || u.dn || u.Id || u.id || '');
    const member = memberships.get(extension) || {};
    return {
      id: extension,
      name: u.DisplayName || u.displayName || [u.FirstName, u.LastName].filter(Boolean).join(' ') || extension,
      extension,
      queue: member.queue || 'Unassigned',
      signedIn: member.signedIn ?? Boolean(u.LoggedIn ?? u.loggedIn ?? u.IsLoggedIn ?? u.isLoggedIn),
      phoneStatus: u.CurrentProfileName || u.currentProfileName || u.Status || u.status || 'Unknown',
      callsToday: Number(u.CallsToday || u.callsToday || 0)
    };
  }).filter(a => a.id);
}

let state = readJson(DATA_FILE, { agents:{}, events:[], lastPoll:null, lastError:null });
async function poll() {
  try {
    state = updateStates(state, await get3cxSnapshot(), new Date().toISOString());
    state.lastError = null;
  } catch (error) {
    state.lastError = error.message;
    state.lastPoll = new Date().toISOString();
  }
  writeJson(DATA_FILE, state);
}
function send(res, status, body, type='application/json') {
  res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control':'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}
function serveStatic(req, res) {
  const requested = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const safe = path.normalize(requested).replace(/^([.][.][/\\])+/, '');
  const file = path.join(__dirname, 'public', safe);
  if (!file.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(file)) return send(res,404,{error:'Not found'});
  const ext = path.extname(file);
  const types = {'.html':'text/html','.css':'text/css','.js':'text/javascript'};
  send(res,200,fs.readFileSync(file),types[ext] || 'application/octet-stream');
}
const server = http.createServer(async (req,res) => {
  if (req.url === '/api/status') return send(res,200,{...state, config:{ mode:config().mode, timezone:config().timezone, pollMs:POLL_MS }});
  if (req.url === '/api/refresh' && req.method === 'POST') { await poll(); return send(res,200,state); }
  if (req.url === '/api/health') return send(res,200,{ok:true,lastPoll:state.lastPoll,lastError:state.lastError});
  return serveStatic(req,res);
});
await poll();
setInterval(poll, POLL_MS).unref();
server.listen(PORT, () => console.log(`3CX dashboard running at http://localhost:${PORT}`));
