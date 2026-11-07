import { ORDER, COLOR, solved, validate, move, inverse } from './cube.js';

const TOP = { U: 'B', R: 'U', F: 'U', D: 'F', L: 'U', B: 'U' };
const RIGHT = { U: 'R', R: 'B', F: 'R', D: 'R', L: 'F', B: 'L' };
const has = (object, key) => Object.hasOwn(object, key);
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function assertState(state, name) {
  const error = validate(state);
  if (error) throw new Error(`${name}: ${error}`);
}

function assertMove(value) {
  if (typeof value !== 'string' || (value.length !== 1 && value.length !== 2)
      || !ORDER.includes(value[0])
      || (value.length === 2 && value[1] !== "'" && value[1] !== '2')) {
    throw new Error('Nước xoay không hợp lệ; chỉ dùng U/R/F/D/L/B, dấu \' hoặc số 2.');
  }
}

function readMoves(value, name) {
  if (!Array.isArray(value)) throw new Error(`${name} phải là danh sách nước xoay.`);
  for (const entry of value) assertMove(entry);
  return [...value];
}

function assertDraft(draft) {
  if (typeof draft !== 'string' || draft.length !== 54 || /[^URFDLB]/u.test(draft)) {
    throw new Error('Bản nháp phải có đúng 54 ký hiệu màu U/R/F/D/L/B.');
  }
  for (let face = 0; face < ORDER.length; face++) {
    if (draft[face * 9 + 4] !== ORDER[face]) {
      throw new Error('Bản nháp phải giữ nguyên sáu tâm mặt.');
    }
  }
  // A draft is an unfinished editor buffer, not necessarily a reachable cube.
}

function assertFaceMap(value, expected, name) {
  if (!isObject(value) || Object.keys(value).length !== ORDER.length
      || [...ORDER].some((face) => value[face] !== expected[face])) {
    throw new Error(`${name} không khớp quy ước của Rubik Coach.`);
  }
}

function assertMetadata(object, exact) {
  if ((exact || has(object, 'puzzle')) && object.puzzle !== '3x3x3') {
    throw new Error('Chỉ hỗ trợ khối 3x3x3.');
  }
  if ((exact || has(object, 'faceletOrder')) && object.faceletOrder !== ORDER) {
    throw new Error('Thứ tự mặt phải là URFDLB.');
  }
  if (exact || has(object, 'colorMap')) assertFaceMap(object.colorMap, COLOR, 'Bảng màu');
  if (exact || has(object, 'orientation')) {
    const orientation = object.orientation;
    if (!isObject(orientation) || orientation.up !== 'U' || orientation.front !== 'F') {
      throw new Error('Hướng khối phải giữ U ở trên và F ở trước.');
    }
    if (exact || has(orientation, 'facelets')) {
      if (orientation.facelets !== 'outside-view-row-major') {
        throw new Error('Các ô phải được ghi theo hàng khi nhìn trực diện từ ngoài mặt.');
      }
    }
    if (exact || has(orientation, 'top')) assertFaceMap(orientation.top, TOP, 'Cạnh trên mỗi mặt');
    if (exact || has(orientation, 'right')) assertFaceMap(orientation.right, RIGHT, 'Cạnh phải mỗi mặt');
  }
}

function readSession(object, exact, historyKey) {
  assertState(object.state, 'Trạng thái hiện tại không hợp lệ');
  const otherKey = historyKey === 'moves' ? 'history' : 'moves';
  const historyPresent = has(object, historyKey) || has(object, otherKey);
  if (exact && !has(object, historyKey)) throw new Error('Thiếu lịch sử nước xoay.');
  const history = historyPresent
    ? readMoves(has(object, historyKey) ? object[historyKey] : object[otherKey], 'Lịch sử')
    : [];
  if (has(object, historyKey) && has(object, otherKey)) {
    const other = readMoves(object[otherKey], 'Lịch sử');
    if (other.length !== history.length || other.some((entry, index) => entry !== history[index])) {
      throw new Error('Hai danh sách lịch sử không khớp nhau.');
    }
  }
  if (!has(object, 'base') && (exact || historyPresent)) {
    throw new Error('Thiếu mốc gốc để đối chiếu lịch sử.');
  }
  const base = has(object, 'base') ? object.base : object.state;
  assertState(base, 'Mốc gốc không hợp lệ');
  let replayed = base;
  for (const entry of history) replayed = move(replayed, entry);
  if (replayed !== object.state) {
    throw new Error('Trạng thái hiện tại không khớp mốc gốc và lịch sử nước xoay.');
  }
  if (exact && (!has(object, 'future') || !has(object, 'draft'))) {
    throw new Error('Thiếu danh sách làm lại hoặc bản nháp của buổi học.');
  }
  const future = has(object, 'future') ? readMoves(object.future, 'Danh sách làm lại') : [];
  const draft = has(object, 'draft') ? object.draft : object.state;
  assertDraft(draft);
  return { state: object.state, draft, base, history, future };
}

export function createSession() {
  const state = solved();
  return { state, draft: state, base: state, history: [], future: [] };
}

export function restoreSession(object) {
  if (!isObject(object)) throw new Error('Dữ liệu buổi học phải là một đối tượng JSON.');
  if (has(object, 'schemaVersion')) {
    if (object.schemaVersion !== 1 && object.schemaVersion !== 2) {
      throw new Error('Phiên bản JSON không được hỗ trợ.');
    }
    const exact = object.schemaVersion === 2;
    assertMetadata(object, exact);
    return readSession(object, exact, 'moves');
  }
  if (object.version !== 1) throw new Error('Phiên bản dữ liệu lưu không được hỗ trợ.');
  assertMetadata(object, false);
  return readSession(object, false, 'history');
}

export function exportSession(session) {
  if (!isObject(session)) throw new Error('Buổi học không hợp lệ.');
  const checked = readSession(session, true, 'history');
  return {
    schemaVersion: 2,
    puzzle: '3x3x3',
    faceletOrder: ORDER,
    state: checked.state,
    base: checked.base,
    moves: checked.history,
    future: checked.future,
    draft: checked.draft,
    colorMap: { ...COLOR },
    orientation: {
      up: 'U',
      front: 'F',
      facelets: 'outside-view-row-major',
      top: { ...TOP },
      right: { ...RIGHT },
    },
    validated: true,
  };
}

export function applyMove(session, entry) {
  assertMove(entry);
  const state = move(session.state, entry);
  session.history.push(entry);
  session.future.length = 0;
  session.state = state;
  session.draft = state;
  return session;
}

export function undo(session) {
  if (!session.history.length) return session;
  const entry = session.history[session.history.length - 1];
  assertMove(entry);
  const state = move(session.state, inverse(entry));
  session.history.pop();
  session.future.push(entry);
  session.state = state;
  session.draft = state;
  return session;
}

export function redo(session) {
  if (!session.future.length) return session;
  const entry = session.future[session.future.length - 1];
  assertMove(entry);
  const state = move(session.state, entry);
  session.future.pop();
  session.history.push(entry);
  session.state = state;
  session.draft = state;
  return session;
}

export function setBase(session, state) {
  assertState(state, 'Không thể áp dụng trạng thái');
  session.state = state;
  session.draft = state;
  session.base = state;
  session.history.length = 0;
  session.future.length = 0;
  return session;
}
