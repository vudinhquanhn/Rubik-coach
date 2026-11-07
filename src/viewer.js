import { TwistyPlayer } from 'cubing/twisty';
import { puzzles } from 'cubing/puzzles';
import { KTransformation } from 'cubing/kpuzzle';
import { toPattern } from './cube.js';

export async function createViewer(container) {
  const kpuzzle = await puzzles['3x3x3'].kpuzzle();
  const player = new TwistyPlayer({
    puzzle: '3x3x3', visualization: '3D', background: 'none',
    controlPanel: 'none', hintFacelets: 'none', viewerLink: 'none',
    experimentalMovePressInput: 'none', experimentalDragInput: 'auto',
    cameraLatitude: 25, cameraLongitude: 35,
  });
  container.replaceChildren(player);
  await player.experimentalCurrentThreeJSPuzzleObject();
  const canvases = await player.experimentalCurrentCanvases();
  if (!canvases.length) { player.remove(); throw new Error('Trình duyệt không tạo được canvas 3D.'); }
  let disposed = false;
  function setup(state) {
    const pattern = toPattern(state, kpuzzle);
    const data = Object.fromEntries(Object.entries(pattern.patternData).map(([name, orbit]) => [name, {
      permutation: orbit.pieces,
      orientationDelta: orbit.orientation,
    }]));
    player.experimentalModel.setupTransformation.set(new KTransformation(kpuzzle, data));
    player.alg = '';
    player.timestamp = 0;
  }
  return {
    async setState(state) {
      if (disposed) throw new Error('Mô hình đã đóng.');
      player.pause(); setup(state);
      await player.experimentalModel.legacyPosition.get();
    },
    async turn(before, move, after) {
      if (disposed) throw new Error('Mô hình đã đóng.');
      player.pause(); setup(before);
      player.alg = move;
      player.timestamp = 0;
      await player.experimentalModel.legacyPosition.get();
      await new Promise((resolve, reject) => {
        const model = player.experimentalModel;
        let started = false;
        const timer = setTimeout(() => { model.playingInfo.removeFreshListener(listener); reject(new Error('Hoạt ảnh chưa hoàn tất. Bấm thử tải lại 3D.')); }, 10000);
        const listener = info => {
          if (info.playing) started = true;
          else if (started) { clearTimeout(timer); model.playingInfo.removeFreshListener(listener); resolve(); }
        };
        model.playingInfo.addFreshListener(listener);
        player.play();
      });
      setup(after);
      await player.experimentalModel.legacyPosition.get();
    },
    dispose() { disposed = true; player.pause(); player.remove(); },
  };
}
