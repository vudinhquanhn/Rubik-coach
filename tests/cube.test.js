import test from 'node:test';
import assert from 'node:assert/strict';
import { cube3x3x3 } from 'cubing/puzzles';
import { KPattern } from 'cubing/kpuzzle';
import { COLOR, LABEL, ORDER, inverse, move, solved, toPattern, validate } from '../src/cube.js';

const kpuzzle = await cube3x3x3.kpuzzle();
const allMoves = [...ORDER].flatMap((face) => [face, `${face}'`, `${face}2`]);

function applyAlgorithm(state, algorithm) {
  return algorithm.trim().split(/\s+/).filter(Boolean).reduce(move, state);
}

function replace(state, replacements) {
  const stickers = [...state];
  for (const [index, color] of replacements) stickers[index] = color;
  return stickers.join('');
}

function exchange(state, first, second) {
  return replace(state, first.flatMap((index, offset) => [
    [index, state[second[offset]]], [second[offset], state[index]],
  ]));
}

function assertPattern(state, algorithm) {
  const actual = toPattern(state, kpuzzle);
  const expected = kpuzzle.defaultPattern().applyAlg(algorithm);
  assert.ok(actual instanceof KPattern);
  assert.deepEqual(actual.patternData, expected.patternData, algorithm || 'solved');
  assert.ok(actual.isIdentical(expected), algorithm || 'solved');
}

test('solved facelets and Vietnamese color convention match the default 3D pattern', () => {
  assert.equal(ORDER, 'URFDLB');
  assert.equal(solved(), 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
  assert.equal(COLOR.U, '#f8fafc');
  assert.equal(COLOR.F, '#16a34a');
  assert.equal(COLOR.R, '#dc2626');
  assert.equal(LABEL.U, 'Trắng');
  assert.equal(validate(solved()), null);
  assertPattern(solved(), '');
});

for (const notation of allMoves) {
  test(`${notation} has the exact cubing permutation from solved and scrambled states`, () => {
    assertPattern(move(solved(), notation), notation);
    const setup = "R U2 F' L D B2 R' F U L2 D' B";
    const state = move(applyAlgorithm(solved(), setup), notation);
    assert.equal(validate(state), null);
    assertPattern(state, `${setup} ${notation}`);
  });
}

for (const face of ORDER) {
  test(`${face}: inverse, four turns and double-turn identities preserve every sticker`, () => {
    const state = applyAlgorithm(solved(), "R F2 U' B L2 D R2 U F'");
    assert.equal(move(move(state, face), `${face}'`), state);
    assert.equal(move(move(state, `${face}'`), face), state);
    assert.equal(applyAlgorithm(state, `${face} ${face} ${face} ${face}`), state);
    assert.equal(move(state, `${face}2`), move(move(state, face), face));
    assert.equal(move(move(state, `${face}2`), `${face}2`), state);
    assertPattern(applyAlgorithm(solved(), `${face} ${face} ${face} ${face}`), '');
    assertPattern(applyAlgorithm(solved(), `${face} ${face}'`), '');
  });
}

test('mixed arbitrary scrambles agree with cubing at every prefix and reverse exactly', () => {
  // Seeded, deterministic coverage; never relies on the solver or on app history.
  let seed = 0x63c0be;
  for (let sample = 0; sample < 12; sample++) {
    const algorithm = [];
    let state = solved();
    for (let step = 0; step < 48; step++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const notation = allMoves[seed % allMoves.length];
      algorithm.push(notation);
      state = move(state, notation);
      assert.equal(validate(state), null, algorithm.join(' '));
      assertPattern(state, algorithm.join(' '));
    }
    const undo = inverse(algorithm.join(' '));
    assert.equal(applyAlgorithm(state, undo), solved());
    assertPattern(solved(), `${algorithm.join(' ')} ${undo}`);
  }
});

test('direct facelet conversion works without knowing any scramble or solving it', () => {
  // Fixed R U facelets entered/imported independently of any move history.
  const facelets = [
    'UUUUUUFFF', 'UBBRRRRRR', 'RRRFFDFFD',
    'DDBDDBDDB', 'FFDLLLLLL', 'LLLUBBUBB',
  ].join('');
  assert.equal(validate(facelets), null);
  assertPattern(facelets, 'R U');
});

test('algorithm inverse normalizes whitespace and reverses primes and half turns', () => {
  assert.equal(inverse("  R U'\nF2\tD L' B2 "), "B2 L D' F2 U R'");
  assert.equal(inverse(' \n\t '), '');
  const algorithm = "R U' F2 D L' B2";
  assert.equal(inverse(inverse(algorithm)), algorithm);
});

test('malformed states, unknown colors, counts and displaced centers are rejected', () => {
  for (const state of [null, undefined, [], 54, '', solved().slice(1)]) {
    assert.match(validate(state), /54/);
  }
  assert.match(validate(replace(solved(), [[0, 'X']])), /mã màu/);
  assert.match(validate(replace(solved(), [[0, 'R']])), /đúng 9/);
  assert.match(validate(exchange(solved(), [4], [13])), /Tâm/);
});

test('a single flipped edge is physically impossible', () => {
  const state = exchange(solved(), [5], [10]);
  assert.match(validate(state), /hướng viên cạnh/);
  assert.throws(() => toPattern(state, kpuzzle), /hướng viên cạnh/);
});

test('a single twisted corner is physically impossible', () => {
  const state = replace(solved(), [[8, 'F'], [9, 'U'], [20, 'R']]);
  assert.match(validate(state), /hướng viên góc/);
  assert.throws(() => toPattern(state, kpuzzle), /hướng viên góc/);
});

test('swapping just two complete edges or two complete corners violates parity', () => {
  const swappedEdges = exchange(solved(), [5, 10], [7, 19]);
  const swappedCorners = exchange(solved(), [8, 9, 20], [6, 18, 38]);
  assert.match(validate(swappedEdges), /parity/);
  assert.match(validate(swappedCorners), /parity/);
});

test('duplicate/missing edges and corners are rejected even with nine of each color', () => {
  // Replace UF + DB with UB + DF, duplicating both existing pieces.
  const duplicateEdges = replace(solved(), [[19, 'B'], [52, 'F']]);
  assert.match(validate(duplicateEdges), /trùng/);
  // Replace ULB + DFR with URF + DBL, preserving all six color counts.
  const duplicateCorners = replace(solved(), [[36, 'R'], [47, 'F'], [26, 'B'], [15, 'L']]);
  assert.match(validate(duplicateCorners), /trùng/);
});

test('mirrored corners and U/D-swapped corner identities are rejected', () => {
  assert.match(validate(exchange(solved(), [9], [20])), /Viên góc/);
  // Regression: the old validator matched only the two side colors, accepting
  // impossible DRF and UFR pieces after exchanging these U/D stickers.
  const swappedUD = exchange(solved(), [8], [29]);
  assert.match(validate(swappedUD), /Viên góc/);
  assert.throws(() => toPattern(swappedUD, kpuzzle), /Viên góc/);
});

test('malformed notation is rejected rather than silently treated as a quarter turn', () => {
  for (const notation of ['', 'X', 'R3', "R2'", 'Rw', 'R U', null, undefined]) {
    assert.throws(() => move(solved(), notation), /Nước xoay/);
  }
  for (const algorithm of ['R garbage', 'U3', 'Rw', "F2'"]) {
    assert.throws(() => inverse(algorithm), /Nước xoay/);
  }
  assert.throws(() => inverse(null), /chuỗi/);
  assert.throws(() => move('invalid', 'R'), /54/);
});

test('each converted pattern owns its arrays and ignores unobservable center logos', () => {
  const first = toPattern(solved(), kpuzzle);
  const second = toPattern(solved(), kpuzzle);
  first.patternData.EDGES.pieces[0] = 10;
  first.patternData.CENTERS.orientationMod[0] = 0;
  assert.deepEqual(second.patternData, kpuzzle.defaultPattern().patternData);
  assert.deepEqual(toPattern(solved(), kpuzzle).patternData, second.patternData);
});
