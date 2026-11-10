import { describe, expect, it } from 'vitest';
import { answerRelayCard, applyInventorySlip, makeInventory, makeRelay, makeWitness, witnessMatches } from './workingMemory';

describe('记忆接力', () => {
  const cards = [{ shape: 1, color: 0 }, { shape: 1, color: 3 }, { shape: 2, color: 3 }];
  const start = { index: 0, hits: 0, misses: 0, falseAlarms: 0, correctRejections: 0 };

  it('热身只前进，比较时忽略颜色', () => {
    expect(answerRelayCard(start, cards, 1, 0, 'same')).toBe(start);
    const ready = answerRelayCard(start, cards, 1, 0, 'next');
    expect(ready).toEqual({ ...start, index: 1 });
    expect(answerRelayCard(ready, cards, 1, 1, 'same')).toEqual({ ...start, index: 2, hits: 1 });
  });

  it('重复提交旧卡片不会跳过当前卡片或增加分数', () => {
    const ready = { ...start, index: 1 };
    const answered = answerRelayCard(ready, cards, 1, 1, 'same');
    expect(answerRelayCard(answered, cards, 1, 1, 'different')).toBe(answered);
    expect(answerRelayCard(answered, cards, 1, 2, 'different')).toEqual({ ...start, index: 3, hits: 1, correctRejections: 1 });
  });

  it('30 级具有不同的作答牌数与匹配牌数组合', () => {
    const levels = Array.from({ length: 30 }, (_, i) => makeRelay(i + 1, 43));
    const counts = levels.map(({ steps, cards }) => {
      const matches = cards.slice(steps).filter((card, i) => card.shape === cards[i].shape).length;
      return `${cards.length - steps}:${matches}`;
    });
    expect(new Set(counts).size).toBe(30);
  });
});

describe('货架管家', () => {
  it('只按有效单据增减指定库存', () => {
    const counts = [4, 6];
    const afterDeposit = applyInventorySlip(counts, { item: 0, delta: 2, valid: true });
    const afterVoid = applyInventorySlip(afterDeposit, { item: 1, delta: 9, valid: false });
    expect(applyInventorySlip(afterVoid, { item: 1, delta: -3, valid: true })).toEqual([6, 3]);
    expect(counts).toEqual([4, 6]);
  });

  it('各难度都存在有效出入库和作废单据，处理中库存始终非负', () => {
    for (let level = 1; level <= 30; level++) for (const seed of [0, 8, 101]) {
      const puzzle = makeInventory(level, seed);
      expect(puzzle.slips.some(slip => slip.valid && slip.delta > 0)).toBe(true);
      expect(puzzle.slips.some(slip => slip.valid && slip.delta < 0)).toBe(true);
      expect(puzzle.slips.some(slip => !slip.valid)).toBe(true);
      const counts = [...puzzle.initial];
      for (const slip of puzzle.slips) {
        if (slip.valid) counts[slip.item] += slip.delta;
        expect(counts[slip.item]).toBeGreaterThanOrEqual(0);
      }
      expect(puzzle.finalCounts).toEqual(counts);
    }
  });
});

describe('特征寻人', () => {
  it('更正只覆盖相应的旧特征，闲聊不改变条件', () => {
    const candidates = [[0, 1], [1, 1], [1, 0]];
    const clues = [
      { kind: 'clue', trait: 0, value: 0 },
      { kind: 'clue', trait: 1, value: 1 },
      { kind: 'correction', trait: 0, value: 1 },
      { kind: 'aside', text: '我自己的围巾是黄色的。' },
    ] as const;
    expect(witnessMatches(candidates, clues)).toEqual([1]);
  });

  it('每档生成的更正线索只指向一位候选人', () => {
    for (let level = 1; level <= 30; level++) for (const seed of [0, 8, 101]) {
      const puzzle = makeWitness(level, seed);
      expect(puzzle.clues.some(clue => clue.kind === 'correction')).toBe(true);
      expect(witnessMatches(puzzle.candidates, puzzle.clues)).toHaveLength(1);
    }
  });

  it('30 级具有不同的候选人数与闲聊条数组合', () => {
    const levels = Array.from({ length: 30 }, (_, i) => makeWitness(i + 1, 43));
    const counts = levels.map(({ candidates, clues }) => `${candidates.length}:${clues.filter(clue => clue.kind === 'aside').length}`);
    expect(new Set(counts).size).toBe(30);
  });
});
