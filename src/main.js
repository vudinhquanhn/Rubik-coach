import { ORDER, COLOR, LABEL, solved, validate, inverse } from './cube.js';
import { createSession, restoreSession, exportSession, applyMove, undo, redo, setBase } from './session.js';

const $ = id => document.getElementById(id);
const KEY = 'rubik-coach-mvp-v1';
let session = createSession();
let selected = 'U';
let viewer = null;
let busy = false;
let loading = false;
let restoreWarning = '';
try {
  const saved = localStorage.getItem(KEY);
  if (saved) session = restoreSession(JSON.parse(saved));
} catch (error) {
  restoreWarning = 'Không khôi phục được buổi học: ' + error.message + '. Chưa ghi đè bản lưu cũ. Thao tác mới sẽ thay thế buổi học này.';
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(exportSession(session)));
    $('saved').textContent = 'Đã lưu trên thiết bị';
  } catch {
    $('saved').textContent = 'Không lưu được — hãy xuất JSON';
  }
}
function renderNet() {
  const layout = ['', 'U', '', '', 'L', 'F', 'R', 'B', '', 'D', '', ''];
  $('net').innerHTML = layout.map(f => !f ? '<div class="spacer"></div>' : `<div class="facewrap"><div class="face-name">${f} · ${LABEL[f]}</div><div class="face">${Array.from({length:9}, (_, n) => {
    const i = ORDER.indexOf(f) * 9 + n;
    return `<button class="tile" data-i="${i}" style="background:${COLOR[session.draft[i]]}" aria-label="${f} ô ${n+1}: ${LABEL[session.draft[i]]}${n === 4 ? ', tâm cố định' : ''}" ${n === 4 ? 'disabled' : ''}></button>`;
  }).join('')}</div></div>`).join('');
}
function controls() {
  document.querySelectorAll('[data-m]').forEach(b => b.disabled = busy);
  $('undo').disabled = busy || !session.history.length;
  $('redo').disabled = busy || !session.future.length;
  for (const id of ['apply', 'reset', 'import']) $(id).disabled = busy;
}
function render() {
  renderNet();
  $('log').replaceChildren();
  const rows = [`Trạng thái hiện tại: ${session.history.length} nước sau mốc gốc`, ...session.history.map((m, i) => `${i+1}. ${m}`).reverse()];
  for (const row of rows) { const el = document.createElement('div'); el.textContent = row; $('log').append(el); }
  controls();
}
function palette() {
  $('palette').innerHTML = [...ORDER].map(c => `<button class="swatch ${c === selected ? 'active' : ''}" data-c="${c}" style="background:${COLOR[c]}" aria-label="Chọn ${LABEL[c]}" aria-pressed="${c === selected}"></button>`).join('');
}
function lesson(m) {
  const names = {U:'tầng trên', D:'tầng dưới', F:'mặt trước', B:'mặt sau', L:'mặt trái', R:'mặt phải'};
  const angle = m.endsWith('2') ? '180°' : m.endsWith("'") ? '90° ngược chiều kim đồng hồ' : '90° theo chiều kim đồng hồ';
  $('lesson').textContent = `${m} — Xoay ${names[m[0]]} ${angle}, khi nhìn thẳng vào mặt ${m[0]}. Giữ U trắng phía trên, F xanh lá phía trước. Viên cạnh có 2 ô màu; viên góc có 3 ô màu. Kéo mô hình chỉ đổi camera, không đổi trạng thái khối.`;
}
async function change(action, m) {
  if (busy) return;
  busy = true;
  const before = session.state;
  try {
    action();
    render(); save();
    if (m) lesson(m);
    if (viewer) {
      if (m) await viewer.turn(before, m, session.state);
      else await viewer.setState(session.state);
      $('modelStatus').textContent = '3D đã đồng bộ với 54 ô màu';
    }
  } catch (error) {
    viewer?.dispose();
    viewer = null;
    $('modelStatus').textContent = 'Không thể đồng bộ 3D: ' + error.message;
    $('retry3d').hidden = false;
  } finally { busy = false; controls(); }
}
const retry = document.createElement('button');
retry.id = 'retry3d'; retry.textContent = 'Thử tải lại 3D'; retry.hidden = true;
$('modelStatus').after(retry);
$('modelStatus').setAttribute('role', 'status');
async function load3d() {
  if (loading || busy) return;
  loading = true; busy = true; controls(); retry.hidden = true;
  $('modelStatus').textContent = 'Đang khởi tạo mô hình 3D…';
  const timeout = new Promise((_, reject) => { load3d.timer = setTimeout(() => reject(new Error('Quá 30 giây. Hãy kiểm tra WebGL hoặc tải lại trang.')), 30000); });
  let candidate;
  let expired = false;
  const mount = document.createElement('div');
  mount.style.cssText = 'width:100%;height:100%';
  $('cube').replaceChildren(mount);
  try {
    const task = (async () => {
      const { createViewer } = await import('./viewer.js');
      if (expired) throw new Error('Lượt tải đã hết hạn.');
      candidate = await createViewer(mount);
      if (expired) { candidate.dispose(); throw new Error('Lượt tải đã hết hạn.'); }
      await candidate.setState(session.state);
      return candidate;
    })();
    viewer = await Promise.race([task, timeout]);
    $('modelStatus').textContent = '3D đã đồng bộ với 54 ô màu';
  } catch (error) {
    expired = true;
    mount.remove();
    candidate?.dispose(); viewer = null;
    $('modelStatus').textContent = 'Không tải được 3D: ' + error.message + ' Editor và JSON vẫn dùng được. Nếu tệp build đã đổi, hãy tải lại trang.';
    retry.hidden = false;
  } finally { clearTimeout(load3d.timer); loading = false; busy = false; controls(); }
}
retry.onclick = () => { viewer?.dispose(); viewer = null; load3d(); };
$('moves').innerHTML = [...ORDER].flatMap(f => [f, f+"'", f+'2']).map(m => `<button data-m="${m}">${m}</button>`).join('');
$('moves').onclick = e => { const m = e.target.dataset.m; if (m) change(() => applyMove(session, m), m); };
$('net').onclick = e => {
  const tile = e.target.closest('[data-i]'); if (!tile) return;
  const i = Number(tile.dataset.i); if (i % 9 === 4) return;
  const draft = [...session.draft]; draft[i] = selected; session.draft = draft.join('');
  renderNet(); save(); $('validation').textContent = 'Bản nhập đã thay đổi. Hãy kiểm tra lại trước khi áp dụng.';
};
$('palette').onclick = e => { if (e.target.dataset.c) { selected = e.target.dataset.c; palette(); } };
$('undo').onclick = () => { const m = session.history.at(-1); if (m) change(() => undo(session), inverse(m)); };
$('redo').onclick = () => { const m = session.future.at(-1); if (m) change(() => redo(session), m); };
$('validate').onclick = () => { const error = validate(session.draft); $('validation').textContent = error || 'Hợp lệ: số màu, tâm, danh tính viên, hướng và parity đều đúng.'; };
$('apply').onclick = () => {
  const error = validate(session.draft);
  if (error) { $('validation').textContent = 'Không thể áp dụng: ' + error; return; }
  if (confirm('Đặt bản nhập làm mốc gốc mới và xóa lịch sử?')) change(() => setBase(session, session.draft));
};
$('solved').onclick = () => { session.draft = solved(); renderNet(); save(); $('validation').textContent = 'Đã điền khối đã giải. Bấm Áp dụng vào 3D để dùng.'; };
$('reset').onclick = () => { if (confirm('Đặt lại khối đã giải và xóa lịch sử? Hãy xuất JSON trước nếu cần.')) change(() => setBase(session, solved())); };
$('export').onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(exportSession(session), null, 2)], {type:'application/json'}));
  const a = document.createElement('a'); a.href = url; a.download = 'rubik-coach-state.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('import').setAttribute('aria-label', 'Nhập trạng thái JSON');
$('import').onchange = async e => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const restored = restoreSession(JSON.parse(await file.text()));
    if (confirm('Thay thế buổi học hiện tại bằng JSON này?')) await change(() => { session = restored; });
  } catch (error) { $('validation').textContent = 'Không nhập được: ' + error.message; }
  finally { e.target.value = ''; }
};
palette(); render();
if (restoreWarning) { $('saved').textContent = 'Lỗi khôi phục'; $('validation').textContent = restoreWarning; }
$('cube').textContent = 'Mô hình 3D sẽ tải khi vùng này xuất hiện trên màn hình.';
$('modelStatus').textContent = 'Cuộn đến mô hình để khởi tạo 3D; editor và JSON sẵn sàng.';
const visibility = new IntersectionObserver(entries => {
  if (entries.some(entry => entry.isIntersecting)) {
    visibility.disconnect();
    load3d();
  }
});
visibility.observe($('cube'));
