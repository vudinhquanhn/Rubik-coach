import test from 'node:test';
import assert from 'node:assert/strict';
import { COLOR, ORDER, solved, move, validate } from '../src/cube.js';
import {
  createSession, restoreSession, exportSession, applyMove, undo, redo, setBase,
} from '../src/session.js';

const copy = (value) => JSON.parse(JSON.stringify(value));
const after = (state, moves) => moves.reduce((result, entry) => move(result, entry), state);
const editDraft = (state) => `${state[0] === 'U' ? 'R' : 'U'}${state.slice(1)}`;

function populatedSession() {
  const session = createSession();
  setBase(session, after(solved(), ['L2', 'B', "D'"]));
  for (const entry of ['R', 'U2', "F'", 'D']) applyMove(session, entry);
  undo(session);
  undo(session);
  session.draft = editDraft(session.state);
  return session;
}

test('a new session is solved with independent history stacks', () => {
  const session = createSession();
  assert.deepEqual(session, {
    state: solved(), draft: solved(), base: solved(), history: [], future: [],
  });
  applyMove(session, 'R');
  assert.deepEqual(createSession().history, []);
});

test('v2 JSON roundtrip preserves exact state, custom base, history, redo and unfinished draft', () => {
  const session = populatedSession();
  const exported = exportSession(session);
  assert.equal(exported.schemaVersion, 2);
  assert.equal(exported.puzzle, '3x3x3');
  assert.equal(exported.faceletOrder, ORDER);
  assert.deepEqual(exported.colorMap, COLOR);
  assert.equal(exported.orientation.facelets, 'outside-view-row-major');
  assert.deepEqual(exported.orientation.top, { U: 'B', R: 'U', F: 'U', D: 'F', L: 'U', B: 'U' });
  assert.deepEqual(exported.orientation.right, { U: 'R', R: 'B', F: 'R', D: 'R', L: 'F', B: 'L' });
  assert.equal(exported.validated, true);
  assert.notEqual(validate(session.draft), null);
  const restored = restoreSession(copy(exported));
  assert.deepEqual(restored, session);
  assert.notStrictEqual(restored.history, session.history);
  assert.notStrictEqual(restored.future, session.future);
  assert.deepEqual(exportSession(restored), exported);
});

test('exports and restored imports do not alias mutable data', () => {
  const session = populatedSession();
  const exported = exportSession(session);
  const restored = restoreSession(exported);
  exported.moves.push('L');
  exported.future.push('B');
  exported.colorMap.U = '#000000';
  exported.orientation.top.U = 'F';
  assert.deepEqual(restored, session);
  assert.deepEqual(exportSession(session).colorMap, COLOR);
  assert.equal(exportSession(session).orientation.top.U, 'B');
});

test('legacy version1 local storage restores history, redo and draft exactly', () => {
  const session = populatedSession();
  assert.deepEqual(restoreSession({ version: 1, ...copy(session) }), session);
});

test('legacy schemaVersion1 exports restore the original base and moves', () => {
  const base = after(solved(), ['F2', 'U']);
  const moves = ['R', "B'", 'D2'];
  const state = after(base, moves);
  const session = restoreSession({
    schemaVersion: 1,
    puzzle: '3x3x3',
    faceletOrder: 'URFDLB',
    state,
    base,
    moves,
    validated: true,
    orientation: { up: 'U', front: 'F' },
    exportedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.deepEqual(session, { state, base, draft: state, history: moves, future: [] });
  undo(session);
  assert.equal(session.state, after(base, moves.slice(0, -1)));
});

test('legacy state-only documents may become a base only when history is absent', () => {
  const state = after(solved(), ['U', 'R2']);
  for (const marker of [{ schemaVersion: 1 }, { version: 1 }]) {
    assert.deepEqual(restoreSession({ ...marker, state }), {
      state, draft: state, base: state, history: [], future: [],
    });
    assert.throws(() => restoreSession({ ...marker, state, moves: [] }));
    assert.throws(() => restoreSession({ ...marker, state, history: [] }));
    assert.throws(() => restoreSession({ ...marker, state, moves: ['R'] }));
  }
});

test('legacy history is rejected rather than filtered or silently discarded', () => {
  for (const bad of [null, 'R', {}, ['R', 'bad'], ['R', null], ['R\n'], ['r'], ['R3']]) {
    assert.throws(() => restoreSession({ version: 1, state: solved(), base: solved(), history: bad }));
    assert.throws(() => restoreSession({ schemaVersion: 1, state: solved(), base: solved(), moves: bad }));
  }
  assert.throws(() => restoreSession({
    schemaVersion: 1, state: solved(), base: solved(), moves: [], history: ['R'],
  }));
});

test('legacy and v2 imports reject inconsistent state, base and history', () => {
  const valid = exportSession(populatedSession());
  for (const document of [
    valid,
    { version: 1, ...populatedSession() },
    { schemaVersion: 1, state: valid.state, base: valid.base, moves: valid.moves },
  ]) {
    assert.throws(() => restoreSession({ ...document, state: move(document.state, 'L') }));
    assert.throws(() => restoreSession({ ...document, base: move(document.base, 'B') }));
  }
  assert.throws(() => restoreSession({ schemaVersion: 1, state: move(solved(), 'R'), base: solved() }));
});

test('imports reject unsupported, missing or malformed schema markers', () => {
  for (const object of [
    null, [], 'data', {}, { state: solved() }, { version: 2, state: solved() },
    { version: '1', state: solved() }, { schemaVersion: 0, state: solved() },
    { schemaVersion: 3, state: solved() }, { schemaVersion: '2', state: solved() },
  ]) assert.throws(() => restoreSession(object));
});

test('v2 requires the complete session and convention fields', () => {
  const valid = exportSession(populatedSession());
  for (const key of ['state', 'base', 'moves', 'future', 'draft', 'puzzle', 'faceletOrder', 'colorMap', 'orientation']) {
    const object = copy(valid);
    delete object[key];
    assert.throws(() => restoreSession(object), key);
  }
  for (const key of ['up', 'front', 'facelets', 'top', 'right']) {
    const object = copy(valid);
    delete object.orientation[key];
    assert.throws(() => restoreSession(object), `orientation.${key}`);
  }
});

test('imports reject incompatible cube, color and face orientation metadata', () => {
  const valid = exportSession(populatedSession());
  for (const patch of [
    { puzzle: '2x2x2' }, { faceletOrder: 'UDFBRL' }, { colorMap: {} },
    { colorMap: { ...COLOR, U: COLOR.R } },
    { orientation: { ...valid.orientation, up: 'D' } },
    { orientation: { ...valid.orientation, front: 'B' } },
    { orientation: { ...valid.orientation, facelets: 'inside-view' } },
    { orientation: { ...valid.orientation, top: { ...valid.orientation.top, D: 'B' } } },
    { orientation: { ...valid.orientation, right: { ...valid.orientation.right, R: 'F' } } },
  ]) assert.throws(() => restoreSession({ ...valid, ...patch }));
  assert.throws(() => restoreSession({ schemaVersion: 1, state: solved(), faceletOrder: 'UDFBRL' }));
  assert.throws(() => restoreSession({ schemaVersion: 1, state: solved(), orientation: { up: 'D', front: 'F' } }));
});

test('invalid current state or base is rejected even if validated claims true', () => {
  const valid = exportSession(createSession());
  const flippedEdge = [...solved()];
  [flippedEdge[7], flippedEdge[19]] = [flippedEdge[19], flippedEdge[7]];
  for (const state of [null, 54, '', 'U'.repeat(54), flippedEdge.join('')]) {
    assert.throws(() => restoreSession({ ...valid, state, validated: true }));
    assert.throws(() => restoreSession({ ...valid, base: state }));
  }
});

test('drafts retain editable impossible cubes but reject malformed data and changed centers', () => {
  const valid = exportSession(createSession());
  const draft = editDraft(valid.state);
  assert.equal(restoreSession({ ...valid, draft }).draft, draft);
  for (const bad of [null, [], '', 'U'.repeat(53), 'X'.repeat(54), `${valid.draft.slice(0, 53)}\n`, 'R'.repeat(54)]) {
    assert.throws(() => restoreSession({ ...valid, draft: bad }));
  }
});

test('invalid redo entries are rejected, not filtered', () => {
  const valid = exportSession(createSession());
  for (const future of [null, 'R', ['M'], ['R', 'U '], [null], ['R2\n']]) {
    assert.throws(() => restoreSession({ ...valid, future }));
    assert.throws(() => restoreSession({ version: 1, state: solved(), base: solved(), history: [], future }));
  }
});

test('moves accept only the exact 18 face-turn tokens and leave sessions untouched on error', () => {
  for (const face of ORDER) {
    for (const suffix of ['', "'", '2']) {
      const session = createSession();
      assert.strictEqual(applyMove(session, `${face}${suffix}`), session);
      assert.equal(session.state, move(solved(), `${face}${suffix}`));
      assert.equal(session.draft, session.state);
    }
  }
  for (const bad of [null, undefined, 1, [], {}, '', 'r', 'Rw', 'M', 'x', 'R3', 'R2\'', ' R', 'R ', 'R\n', 'R2\n', 'R U', new String('R')]) {
    const session = populatedSession();
    const before = copy(session);
    assert.throws(() => applyMove(session, bad));
    assert.deepEqual(session, before);
  }
});

test('undo/redo use LIFO order, preserve the base, and synchronize draft', () => {
  const session = createSession();
  const base = after(solved(), ['B2', 'D']);
  setBase(session, base);
  const moves = ['R', 'U2', "F'"];
  for (const entry of moves) applyMove(session, entry);
  const final = session.state;
  session.draft = editDraft(session.state);
  assert.strictEqual(undo(session), session);
  undo(session);
  assert.deepEqual(session.history, ['R']);
  assert.deepEqual(session.future, ["F'", 'U2']);
  assert.equal(session.state, move(base, 'R'));
  assert.equal(session.draft, session.state);
  assert.strictEqual(redo(session), session);
  assert.equal(session.state, after(base, ['R', 'U2']));
  assert.equal(session.draft, session.state);
  redo(session);
  assert.equal(session.state, final);
  assert.equal(session.base, base);
  assert.deepEqual(session.future, []);
  for (let index = 0; index < moves.length; index++) undo(session);
  assert.equal(session.state, base);
  assert.equal(session.draft, base);
});

test('restored redo stack retains the next-move order', () => {
  const session = populatedSession();
  const restored = restoreSession(copy(exportSession(session)));
  for (const expected of ["F'", 'D']) {
    const before = restored.state;
    redo(restored);
    assert.equal(restored.state, move(before, expected));
    assert.equal(restored.draft, restored.state);
    assert.equal(restored.history.at(-1), expected);
  }
  assert.deepEqual(restored.future, []);
});

test('a new move after undo discards the redo branch', () => {
  const session = createSession();
  applyMove(session, 'R');
  applyMove(session, 'U');
  undo(session);
  applyMove(session, 'F2');
  assert.deepEqual(session.history, ['R', 'F2']);
  assert.deepEqual(session.future, []);
  const before = copy(session);
  assert.strictEqual(redo(session), session);
  assert.deepEqual(session, before);
  assert.equal(session.state, after(solved(), ['R', 'F2']));
});

test('empty undo and redo preserve an unfinished draft', () => {
  const session = createSession();
  session.draft = editDraft(session.state);
  const before = copy(session);
  assert.strictEqual(undo(session), session);
  assert.strictEqual(redo(session), session);
  assert.deepEqual(session, before);
});

test('setBase validates before changing session and clears both history stacks', () => {
  const session = populatedSession();
  const before = copy(session);
  assert.throws(() => setBase(session, 'U'.repeat(54)));
  assert.deepEqual(session, before);
  const state = after(solved(), ['F2', 'L', 'D2']);
  assert.strictEqual(setBase(session, state), session);
  assert.deepEqual(session, { state, draft: state, base: state, history: [], future: [] });
});

test('export refuses corrupted session history rather than emitting misleading JSON', () => {
  const session = createSession();
  session.history.push('R');
  assert.throws(() => exportSession(session));
  session.history = ['bad'];
  assert.throws(() => exportSession(session));
  session.history = [];
  session.future = ['M'];
  assert.throws(() => exportSession(session));
});
