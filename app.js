import { createGame, currentPlayer, die, finish, parseDice, resolveOrder, roll, setOrder, setOrderPoint, summary, totals } from './engine.js';

const $ = id => document.getElementById(id);
const key = 'xiamen-bobing-game-v1';
let game;
try { game = JSON.parse(localStorage.getItem(key) || 'null'); } catch { game = null; }
const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const name = id => game.players.find(p => p.id === id)?.name || id;
const dieFace = n => `<span class="die-face ${n === 4 ? 'red' : ''}" aria-label="${n}点">${['','⚀','⚁','⚂','⚃','⚄','⚅'][n]}</span>`;
const save = () => localStorage.setItem(key, JSON.stringify(game));
function notice(text) { alert(text); }
function addRow(value = '', kind = 'virtual') {
  const row = document.createElement('div'); row.className = 'row';
  row.innerHTML = `<input maxlength="24" aria-label="玩家名字" placeholder="玩家名字" value="${escape(value)}"><select aria-label="玩家类型"><option value="virtual">虚拟</option><option value="physical">现场</option></select><button type="button" aria-label="移除玩家">×</button>`;
  row.querySelector('select').value = kind;
  row.querySelector('button').onclick = () => row.remove();
  $('playerRows').append(row);
}
function controls() {
  if (game.phase === 'ordering') {
    $('phaseTitle').textContent = '先定顺序';
    $('instructions').textContent = '虚拟玩家自动掷一颗；现场玩家掷一颗后输入点数。同点者单独加赛。也可以在下方按列表顺序直接开始。';
    $('controls').innerHTML = game.players.map(p => `<div class="order-row"><strong>${escape(p.name)} <span class="muted">${p.kind === 'virtual' ? '虚拟' : '现场'}</span></strong>${p.kind === 'physical' ? `<input type="number" min="1" max="6" inputmode="numeric" data-point="${p.id}" value="${game.orderPoints[p.id] || ''}" placeholder="点数">` : `<span>${game.orderPoints[p.id] || '待掷'} 点</span>`}</div>`).join('');
    $('action').textContent = '确定点数并排序';
    $('finish').textContent = '按列表顺序直接开始';
  } else if (game.phase === 'play') {
    const p = currentPlayer(game);
    $('phaseTitle').textContent = `当前轮到：${p.name}`;
    $('instructions').textContent = p.kind === 'virtual' ? '点一次按钮，系统为这位玩家掷六颗骰子。中间可停下来聊天，刷新也会保留轮次。' : '请让现场玩家用真实骰子投六颗，再录入六个点数。';
    $('controls').innerHTML = p.kind === 'physical' ? '<input id="diceInput" inputmode="numeric" placeholder="例如 4、4、4、4、5、6" aria-label="六颗骰子点数">' : '';
    $('action').textContent = p.kind === 'virtual' ? `让 ${p.name} 掷六颗` : `录入 ${p.name} 的结果`;
    $('finish').textContent = '结束并公布结果';
  } else {
    $('phaseTitle').textContent = '本场已结束';
    $('instructions').textContent = summary(game);
    $('controls').innerHTML = '';
    $('action').hidden = true; $('finish').hidden = true;
  }
  if (game.phase !== 'finished') { $('action').hidden = false; $('finish').hidden = false; }
}
function render() {
  $('setup').hidden = !!game; $('game').hidden = !game;
  if (!game) return;
  controls();
  $('log').innerHTML = game.rolls.length ? game.rolls.map(entry => `<div class="entry"><strong>${escape(name(entry.playerId))}</strong> · ${escape(entry.label)}<div class="dice">${entry.dice.map(dieFace).join('')}</div></div>`).reverse().join('') : '<div class="muted">尚无正式投掷</div>';
  const counts = totals(game);
  const lines = game.players.map(p => `${p.name}：${Object.entries(counts[p.id]).map(([label,n]) => `${label}×${n}`).join('、') || '暂无中奖'}`);
  $('totals').textContent = lines.join('\n') + (game.champion ? `\n👑 ${game.phase === 'finished' ? '最终' : '当前'}状元：${name(game.champion.playerId)}（${game.champion.label}）` : '');
}
function run(fn) { try { fn(); save(); render(); } catch (error) { notice(error.message); } }
$('addPlayer').onclick = () => addRow('', 'physical');
$('start').onclick = () => run(() => {
  const players = [...$('playerRows').children].map(row => ({ name: row.querySelector('input').value.trim(), kind: row.querySelector('select').value }));
  game = createGame(players);
  for (const p of game.players) if (p.kind === 'virtual') setOrderPoint(game, p.id, die());
});
$('action').onclick = () => run(() => {
  if (game.phase === 'ordering') {
    for (const input of document.querySelectorAll('[data-point]')) if (input.value) setOrderPoint(game, input.dataset.point, Number(input.value));
    const result = resolveOrder(game);
    if (!result.ready) {
      notice('同点者加赛：' + result.ties.map(group => group.map(name).join('、')).join('；') + '。虚拟玩家已重新掷点，请现场同点者重掷。');
    }
  } else {
    const p = currentPlayer(game);
    roll(game, p.id, p.kind === 'physical' ? parseDice($('diceInput').value) : undefined);
  }
});
$('finish').onclick = () => run(() => {
  if (game.phase === 'ordering') setOrder(game, game.players.map(p => p.id));
  else finish(game);
});
$('newGame').onclick = () => {
  if (!confirm('重新开桌？当前场次会从本浏览器移除。')) return;
  localStorage.removeItem(key); game = null; render();
};
if (!game) { addRow('虚拟玩家 A'); addRow('虚拟玩家 B'); addRow('我', 'physical'); }
render();
