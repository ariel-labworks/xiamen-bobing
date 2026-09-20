import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, evaluate, finish, parseDice, resolveOrder, roll, setOrder, setOrderPoint, stronger, summary, totals } from './engine.js';

test('厦门状元等级与带点比较', () => {
  const cases = [
    [[4,4,4,4,5,6], '四红状元·带11', [1,11]],
    [[3,3,3,3,3,6], '五子登科·带6', [2,6]],
    [[4,4,4,4,4,3], '五红状元·带3', [3,3]],
    [[1,1,4,4,4,4], '状元插金花', [4,0]],
    [[6,6,6,6,6,6], '六勃黑·状元（6点）', [5,6]],
    [[4,4,4,4,4,4], '六勃红·状元', [6,0]],
  ];
  for (const [dice, label, score] of cases) assert.deepEqual(evaluate(dice), { label, score });
  for (let i = 1; i < cases.length; i++) assert.ok(stronger(cases[i][2], cases[i - 1][2]));
  assert.equal(stronger([2,6], [2,6]), false);
});

test('基本奖项、无奖与输入校验', () => {
  assert.equal(evaluate([1,2,3,4,5,6]).label, '对堂');
  assert.equal(evaluate([1,1,2,2,3,3]).label, '无奖');
  assert.deepEqual(parseDice('4、4、4、4、5、6'), [4,4,4,4,5,6]);
  assert.throws(() => parseDice('4、4、4'), /六个点数/);
});

test('定序、轮次、状元抢夺、累计和结算', () => {
  const game = createGame([{name:'虚拟 A'}, {name:'妈妈',kind:'physical'}, {name:'虚拟 B'}]);
  setOrderPoint(game, 'p1', 5); setOrderPoint(game, 'p2', 6); setOrderPoint(game, 'p3', 3);
  assert.deepEqual(resolveOrder(game), {ready:true, order:['p2','p1','p3']});
  roll(game, 'p2', [4,4,4,4,5,6]);
  assert.throws(() => roll(game, 'p3', [1,2,3,4,5,6]), /现在轮到/);
  roll(game, 'p1', [3,3,3,3,3,6]);
  roll(game, 'p3', [1,2,3,4,5,6]);
  assert.equal(game.champion.playerId, 'p1');
  assert.equal(totals(game).p2['四红状元·带11'], 1);
  assert.equal(totals(game).p1['五子登科·带6'], 1);
  assert.match(finish(game), /最终状元：虚拟 A（五子登科·带6）/);
  assert.equal(summary(game), finish(game));
});

test('同点只清除现场同点者，虚拟同点者自动重掷', () => {
  const game = createGame([{name:'虚拟 A'}, {name:'妈妈',kind:'physical'}, {name:'小王',kind:'physical'}]);
  setOrderPoint(game,'p1',5); setOrderPoint(game,'p2',5); setOrderPoint(game,'p3',2);
  const result = resolveOrder(game);
  assert.deepEqual(result.ties, [['p1','p2']]);
  assert.equal(game.phase, 'ordering');
  assert.equal(game.orderPoints.p2, undefined);
  assert.equal(game.orderPoints.p3, 2);
  assert.ok(game.orderPoints.p1 >= 1 && game.orderPoints.p1 <= 6);
});

test('可以按自定顺序开始，现场玩家不能由系统代掷', () => {
  const game = createGame([{name:'妈妈',kind:'physical'}, {name:'虚拟 A'}]);
  setOrder(game,['p1','p2']);
  assert.throws(() => roll(game,'p1'), /现场玩家/);
  assert.equal(game.turn,0);
});
