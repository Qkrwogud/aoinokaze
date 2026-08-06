export function updateStates(previous, snapshot, nowIso) {
  const next = { agents:{...previous.agents}, events:[...(previous.events || [])], lastPoll:nowIso, lastError:null };
  for (const incoming of snapshot) {
    const id = String(incoming.id || incoming.extension);
    const old = next.agents[id];
    const changed = !old || old.signedIn !== incoming.signedIn;
    next.agents[id] = { ...incoming, id, stateSince: changed ? nowIso : old.stateSince, updatedAt: nowIso };
    if (old && changed) next.events.unshift({ id:`${id}-${nowIso}`, agentId:id, name:incoming.name, queue:incoming.queue, signedIn:incoming.signedIn, at:nowIso });
  }
  next.events = next.events.slice(0, 250);
  return next;
}
