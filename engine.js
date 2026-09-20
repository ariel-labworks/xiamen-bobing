// Standalone Xiamen Bo Bing rules and session state. No app-specific imports.
export const PRIZE_ORDER = ['一秀', '二举', '三红', '四进', '对堂'];

export function evaluate(dice) {
  if (!Array.isArray(dice) || dice.length !== 6 || dice.some(n => !Number.isInteger(n) || n < 1 || n > 6)) {
    throw new Error('需要六颗 1–6 点的骰子');
  }
  const counts = Array.from({ length: 7 }, (_, n) => dice.filter(x => x === n).length);
  const red = counts[4];
  const largest = Math.max(...counts.slice(1));
  if (red === 6) return { label: '六勃红·状元', score: [6, 0] };
  if (largest === 6) return { label: `六勃黑·状元（${dice[0]}点）`, score: [5, dice[0]] };
  if (red === 4 && counts[1] === 2) return { label: '状元插金花', score: [4, 0] };
  if (red === 5) return { label: `五红状元·带${dice.find(n => n !== 4)}`, score: [3, dice.find(n => n !== 4)] };
  if (largest === 5) {
    const face = counts.findIndex(count => count === 5);
    const kicker = dice.find(n => n !== face);
    return { label: `五子登科·带${kicker}`, score: [2, kicker] };
  }
  if (red === 4) {
    const carried = dice.filter(n => n !== 4).reduce((a, b) => a + b, 0);
    return { label: `四红状元·带${carried}`, score: [1, carried] };
  }
  if (counts.slice(1).every(count => count === 1)) return { label: '对堂', score: null };
  if (largest === 4) return { label: '四进', score: null };
  if (red === 3) return { label: '三红', score: null };
  if (red === 2) return { label: '二举', score: null };
  if (red === 1) return { label: '一秀', score: null };
  return { label: '无奖', score: null };
}

export function stronger(a, b) {
  if (!a) return false;
  if (!b) return true;
  return a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);
}

export function die() {
  const buffer = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / 6) * 6;
  do { crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
  return buffer[0] % 6 + 1;
}

export function normalize(text) {
  return String(text || '').normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\p{Z}\s]/gu, '');
}

export function parseDice(text) {
  const values = String(text || '').match(/[1-6]/g)?.map(Number) || [];
  if (values.length !== 6) throw new Error('请填六个点数，例如 4、4、4、4、5、6');
  return values;
}

export function createGame(players) {
  const names = players.map(p => String(p.name || '').trim());
  if (names.length < 1 || new Set(names).size !== names.length || names.some(name => !name)) {
    throw new Error('至少需要一位玩家，名字不能重复或留空');
  }
  return {
    version: 1, phase: 'ordering',
    players: players.map((p, i) => ({ id: `p${i + 1}`, name: names[i], kind: p.kind === 'physical' ? 'physical' : 'virtual' })),
    orderPoints: {}, order: [], turn: 0, rolls: [], champion: null, log: [],
  };
}

export function setOrderPoint(game, playerId, point) {
  if (game.phase !== 'ordering') throw new Error('已经开始正式博饼');
  if (!game.players.some(p => p.id === playerId)) throw new Error('找不到玩家');
  if (!Number.isInteger(point) || point < 1 || point > 6) throw new Error('定序点数只能是 1–6');
  game.orderPoints[playerId] = point;
}

export function resolveOrder(game) {
  if (game.phase !== 'ordering') throw new Error('不在定序阶段');
  if (game.players.some(p => !game.orderPoints[p.id])) throw new Error('还有玩家没有定序点数');
  const groups = new Map();
  for (const p of game.players) {
    const point = game.orderPoints[p.id];
    groups.set(point, [...(groups.get(point) || []), p]);
  }
  const ties = [...groups.values()].filter(group => group.length > 1);
  if (ties.length) {
    for (const group of ties) for (const p of group) {
      if (p.kind === 'virtual') game.orderPoints[p.id] = die();
      else delete game.orderPoints[p.id];
    }
    return { ready: false, ties: ties.map(group => group.map(p => p.id)) };
  }
  game.order = [...game.players].sort((a, b) => game.orderPoints[b.id] - game.orderPoints[a.id]).map(p => p.id);
  game.phase = 'play';
  return { ready: true, order: game.order };
}

export function setOrder(game, ids) {
  if (game.phase !== 'ordering') throw new Error('不在定序阶段');
  if (ids.length !== game.players.length || new Set(ids).size !== ids.length ||
      ids.some(id => !game.players.some(p => p.id === id))) throw new Error('顺序必须包含每位玩家且只出现一次');
  game.order = [...ids];
  game.turn = 0;
  game.phase = 'play';
}

export function currentPlayer(game) {
  return game.phase === 'play' ? game.players.find(p => p.id === game.order[game.turn]) : null;
}

export function roll(game, playerId, dice) {
  const player = currentPlayer(game);
  if (!player || player.id !== playerId) throw new Error(`现在轮到${player?.name || '无人'}`);
  if (player.kind === 'physical' && !dice) throw new Error('现场玩家请录入现实掷出的六颗骰子');
  const values = dice ? [...dice] : Array.from({ length: 6 }, die);
  const result = evaluate(values);
  const entry = { playerId, dice: values, label: result.label, score: result.score, at: new Date().toISOString() };
  game.rolls.push(entry);
  if (stronger(result.score, game.champion?.score)) game.champion = entry;
  game.turn = (game.turn + 1) % game.order.length;
  return entry;
}

export function totals(game) {
  const output = Object.fromEntries(game.players.map(p => [p.id, {}]));
  for (const entry of game.rolls) if (entry.label !== '无奖') {
    const prizes = output[entry.playerId];
    prizes[entry.label] = (prizes[entry.label] || 0) + 1;
  }
  return output;
}

export function finish(game) {
  if (game.phase === 'finished') return summary(game);
  if (game.phase !== 'play') throw new Error('还没有确定正式顺序');
  game.phase = 'finished';
  return summary(game);
}

export function summary(game) {
  const counts = totals(game);
  const lines = game.players.map(p => {
    const prizes = Object.entries(counts[p.id]);
    return `${p.name}：${prizes.length ? prizes.map(([label, count]) => `${label}×${count}`).join('、') : '暂无中奖'}`;
  });
  const champion = game.champion;
  const winner = champion ? `${game.players.find(p => p.id === champion.playerId)?.name}（${champion.label}）` : '本场没有状元';
  return `本场博饼结束！\n${lines.join('\n')}\n最终状元：${winner}`;
}
