import { KPattern } from 'cubing/kpuzzle';

export const ORDER = 'URFDLB';
export const COLOR = Object.freeze({
  U: '#f8fafc', R: '#dc2626', F: '#16a34a',
  D: '#facc15', L: '#f97316', B: '#2563eb',
});
export const LABEL = Object.freeze({
  U: 'Trắng', R: 'Đỏ', F: 'Xanh lá',
  D: 'Vàng', L: 'Cam', B: 'Xanh dương',
});

export const solved = () => [...ORDER].map((face) => face.repeat(9)).join('');

// Facelets are row-major, viewed head-on. U points up (+y), F forward (+z).
const CORNER_FACELETS = [
  [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
  [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51],
];
const CORNER_COLORS = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];
const EDGE_FACELETS = [
  [5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25],
  [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14],
];
const EDGE_COLORS = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];

function parity(pieces) {
  let result = 0;
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      if (pieces[i] > pieces[j]) result ^= 1;
    }
  }
  return result;
}

function decode(state) {
  if (typeof state !== 'string' || state.length !== 54) {
    return { error: 'Cần đúng 54 ô.' };
  }
  const counts = Object.fromEntries([...ORDER].map((face) => [face, 0]));
  for (const color of state) {
    if (!Object.hasOwn(counts, color)) return { error: 'Có ô mang mã màu không hợp lệ.' };
    counts[color]++;
  }
  for (const face of ORDER) {
    if (counts[face] !== 9) return { error: `Màu ${LABEL[face]} phải có đúng 9 ô.` };
    if (state[ORDER.indexOf(face) * 9 + 4] !== face) {
      return { error: `Tâm mặt ${face} không đúng.` };
    }
  }

  const corners = [], cornerOrientation = [], edges = [], edgeOrientation = [];
  for (const [position, indices] of CORNER_FACELETS.entries()) {
    const colors = indices.map((index) => state[index]);
    const orientation = colors.findIndex((color) => color === 'U' || color === 'D');
    const piece = orientation < 0 ? -1 : CORNER_COLORS.findIndex((candidate) => (
      candidate[0] === colors[orientation]
      && candidate[1] === colors[(orientation + 1) % 3]
      && candidate[2] === colors[(orientation + 2) % 3]
    ));
    if (piece < 0) {
      return { error: `Viên góc vị trí ${position + 1} có tổ hợp hoặc thứ tự màu không hợp lệ.` };
    }
    corners.push(piece);
    cornerOrientation.push(orientation);
  }
  for (const [position, indices] of EDGE_FACELETS.entries()) {
    const colors = indices.map((index) => state[index]).join('');
    let piece = EDGE_COLORS.indexOf(colors);
    let orientation = 0;
    if (piece < 0) {
      piece = EDGE_COLORS.indexOf(colors[1] + colors[0]);
      orientation = 1;
    }
    if (piece < 0) return { error: `Viên cạnh vị trí ${position + 1} có cặp màu không hợp lệ.` };
    edges.push(piece);
    edgeOrientation.push(orientation);
  }
  if (new Set(corners).size !== 8 || new Set(edges).size !== 12) {
    return { error: 'Có viên cạnh hoặc góc bị trùng / thiếu.' };
  }
  if (cornerOrientation.reduce((sum, value) => sum + value, 0) % 3) {
    return { error: 'Tổng hướng viên góc không hợp lệ (không thể xoắn riêng 1 góc).' };
  }
  if (edgeOrientation.reduce((sum, value) => sum + value, 0) % 2) {
    return { error: 'Tổng hướng viên cạnh không hợp lệ (không thể lật riêng 1 cạnh).' };
  }
  if (parity(corners) !== parity(edges)) return { error: 'Hoán vị góc/cạnh sai parity.' };
  return { corners, cornerOrientation, edges, edgeOrientation };
}

export function validate(state) {
  return decode(state).error ?? null;
}

const BASIS = {
  U: { normal: [0, 1, 0], right: [1, 0, 0], down: [0, 0, 1] },
  D: { normal: [0, -1, 0], right: [1, 0, 0], down: [0, 0, -1] },
  F: { normal: [0, 0, 1], right: [1, 0, 0], down: [0, -1, 0] },
  B: { normal: [0, 0, -1], right: [-1, 0, 0], down: [0, -1, 0] },
  R: { normal: [1, 0, 0], right: [0, 0, -1], down: [0, -1, 0] },
  L: { normal: [-1, 0, 0], right: [0, 0, 1], down: [0, -1, 0] },
};
const ROTATIONS = {
  U: ['y', 1, -1], D: ['y', -1, 1], R: ['x', 1, -1],
  L: ['x', -1, 1], F: ['z', 1, -1], B: ['z', -1, 1],
};
const add = (a, b, scale) => a.map((value, index) => value + scale * b[index]);
const key = (position, normal) => `${position.join(',')}|${normal.join(',')}`;

function rotateVector([x, y, z], axis, sign) {
  if (axis === 'x') return [x, -sign * z, sign * y];
  if (axis === 'y') return [sign * z, y, -sign * x];
  return [-sign * y, sign * x, z];
}

// Build all 18 permutations once, rather than rotating geometry on each turn.
function buildPermutations() {
  const stickers = [...ORDER].flatMap((face, faceIndex) => {
    const basis = BASIS[face];
    return Array.from({ length: 9 }, (_, index) => ({
      position: add(add(basis.normal, basis.right, index % 3 - 1), basis.down, Math.floor(index / 3) - 1),
      normal: basis.normal,
      index: faceIndex * 9 + index,
    }));
  });
  const indices = new Map(stickers.map((sticker) => [key(sticker.position, sticker.normal), sticker.index]));
  const result = new Map();
  for (const face of ORDER) {
    const [axis, layer, sign] = ROTATIONS[face];
    const coordinate = { x: 0, y: 1, z: 2 }[axis];
    const quarter = Array.from({ length: 54 }, (_, index) => index);
    for (const sticker of stickers) {
      if (sticker.position[coordinate] !== layer) continue;
      const target = indices.get(key(
        rotateVector(sticker.position, axis, sign),
        rotateVector(sticker.normal, axis, sign),
      ));
      quarter[target] = sticker.index;
    }
    const half = quarter.map((source) => quarter[source]);
    result.set(face, quarter);
    result.set(`${face}2`, half);
    result.set(`${face}'`, half.map((source) => quarter[source]));
  }
  return result;
}
const PERMUTATIONS = buildPermutations();

export function move(state, notation) {
  if (typeof state !== 'string' || !/^[URFDLB]{54}$/.test(state)) {
    throw new Error('Trạng thái xoay phải gồm đúng 54 mã màu U/R/F/D/L/B.');
  }
  const permutation = PERMUTATIONS.get(notation);
  if (!permutation) throw new Error(`Nước xoay không hợp lệ: ${notation}`);
  return permutation.map((source) => state[source]).join('');
}

export function inverse(algorithm) {
  if (typeof algorithm !== 'string') throw new Error('Dãy xoay phải là chuỗi ký tự.');
  const moves = algorithm.trim().split(/\s+/).filter(Boolean);
  return moves.reverse().map((notation) => {
    if (!PERMUTATIONS.has(notation)) throw new Error(`Nước xoay không hợp lệ: ${notation}`);
    return notation.endsWith('2') ? notation : notation.endsWith("'") ? notation.slice(0, -1) : `${notation}'`;
  }).join(' ');
}

// cubing 0.63.3 uses UF/UR/UB/UL/... edges and UFR/UBR/ULB/UFL/... corners.
// Orientations use the same U/D-first corner and U/D-or-F/B-first edge axes.
const CUBING_EDGE_ORDER = [1, 0, 3, 2, 5, 4, 7, 6, 8, 9, 11, 10];
const CUBING_CORNER_ORDER = [0, 3, 2, 1, 4, 5, 6, 7];
const CUBING_EDGE_INDEX = Array.from({ length: 12 }, (_, index) => CUBING_EDGE_ORDER.indexOf(index));
const CUBING_CORNER_INDEX = Array.from({ length: 8 }, (_, index) => CUBING_CORNER_ORDER.indexOf(index));

export function toPattern(state, kpuzzle) {
  const decoded = decode(state);
  if (decoded.error) throw new Error(decoded.error);
  return new KPattern(kpuzzle, {
    EDGES: {
      pieces: CUBING_EDGE_ORDER.map((position) => CUBING_EDGE_INDEX[decoded.edges[position]]),
      orientation: CUBING_EDGE_ORDER.map((position) => decoded.edgeOrientation[position]),
    },
    CORNERS: {
      pieces: CUBING_CORNER_ORDER.map((position) => CUBING_CORNER_INDEX[decoded.corners[position]]),
      orientation: CUBING_CORNER_ORDER.map((position) => decoded.cornerOrientation[position]),
    },
    // Plain centers have no visible orientation; facelets do not encode logos.
    CENTERS: {
      pieces: [0, 1, 2, 3, 4, 5],
      orientation: [0, 0, 0, 0, 0, 0],
      orientationMod: [1, 1, 1, 1, 1, 1],
    },
  });
}
