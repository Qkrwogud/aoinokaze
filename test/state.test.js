import test from 'node:test';
import assert from 'node:assert/strict';
import { updateStates } from '../state.js';

test('keeps original stateSince while state is unchanged', () => {
  let state = updateStates({agents:{},events:[]}, [{id:'1',name:'A',signedIn:true}], '2026-01-01T00:00:00Z');
  state = updateStates(state, [{id:'1',name:'A',signedIn:true}], '2026-01-01T00:05:00Z');
  assert.equal(state.agents['1'].stateSince, '2026-01-01T00:00:00Z');
  assert.equal(state.events.length, 0);
});

test('records a queue state transition', () => {
  let state = updateStates({agents:{},events:[]}, [{id:'1',name:'A',queue:'Support',signedIn:true}], '2026-01-01T00:00:00Z');
  state = updateStates(state, [{id:'1',name:'A',queue:'Support',signedIn:false}], '2026-01-01T00:05:00Z');
  assert.equal(state.agents['1'].stateSince, '2026-01-01T00:05:00Z');
  assert.equal(state.events.length, 1);
  assert.equal(state.events[0].signedIn, false);
});
