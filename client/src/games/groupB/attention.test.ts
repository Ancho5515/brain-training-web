import { describe, expect, it } from 'vitest';
import { makeArrowPuzzle, makeChangeScene, makeFlashStream, scoreChangeSelection, scoreFlashAnswers } from './attention';

describe('变化侦探', () => {
  it('两幅场景保持格位一致，答案只包含物品实际变化的位置', () => {
    for (const level of [1, 15, 30]) {
      for (const seed of [0, 89, -1]) {
        const question = makeChangeScene(level, seed);
        const [first, second] = question.scenes;
        expect(first.decoration).not.toBe(second.decoration);
        expect(first.objects).toHaveLength(second.objects.length);
        const differences = first.objects.flatMap((object, index) => {
          const other = second.objects[index];
          return object.shape !== other.shape || object.color !== other.color || object.striped !== other.striped ? [index] : [];
        });
        expect(differences.length).toBeGreaterThan(0);
        expect([...question.changedSlots].sort((a, b) => a - b)).toEqual(differences);
        expect(makeChangeScene(level, seed)).toEqual(question);
      }
    }
  });

  it('误选和漏选都会降低得分', () => {
    expect(scoreChangeSelection([0, 3], new Set([0, 3]))).toEqual({ hits: 2, falseSelections: 0, accuracy: 1 });
    expect(scoreChangeSelection([0, 3], new Set([1, 0]))).toEqual({ hits: 1, falseSelections: 1, accuracy: 1 / 3 });
  });
});

describe('双闪捕捉', () => {
  it('每道题恰有两个实线目标且都在选项中', () => {
    for (const level of [1, 15, 30]) {
      for (const seed of [0, 89, -1]) {
        const { frames, options } = makeFlashStream(level, seed);
        const targets = frames.filter(frame => frame.target).map(frame => frame.shape);
        expect(new Set(targets).size).toBe(2);
        expect(targets).toHaveLength(2);
        expect(options).toEqual(expect.arrayContaining(targets));
        expect(frames[0].target).toBe(false);
        expect(frames[frames.length - 1].target).toBe(false);
      }
    }
  });

  it('按出现顺序判分，忽略同样图案的虚线干扰', () => {
    const frames = [
      { shape: 1, target: false },
      { shape: 4, target: true },
      { shape: 1, target: true },
      { shape: 4, target: false },
    ];
    expect(scoreFlashAnswers(frames, [4, 1])).toEqual({ firstCorrect: true, secondCorrect: true, accuracy: 1 });
    expect(scoreFlashAnswers(frames, [1, 4])).toEqual({ firstCorrect: false, secondCorrect: false, accuracy: 0 });
    expect(scoreFlashAnswers(frames, [4, 4]).accuracy).toBe(0.5);
  });
});

describe('大小迷局', () => {
  it('最高难度的箭头轮廓仍与整体方向一致，且有多种小箭头方向及颜色', () => {
    const directions = new Set<number>();
    for (let seed = 0; seed < 24; seed++) {
      const { direction, size, cells } = makeArrowPuzzle(30, seed);
      directions.add(direction);
      const [tip, tail] = [
        [(col: number) => col === size - 1, (col: number) => col === 0],
        [(_: number, row: number) => row === size - 1, (_: number, row: number) => row === 0],
        [(col: number) => col === 0, (col: number) => col === size - 1],
        [(_: number, row: number) => row === 0, (_: number, row: number) => row === size - 1],
      ][direction];
      expect(cells.filter(cell => tip(cell.col, cell.row))).toHaveLength(1);
      expect(cells.filter(cell => tail(cell.col, cell.row)).length).toBeGreaterThan(1);
      expect(new Set(cells.map(cell => `${cell.col}/${cell.row}`)).size).toBe(cells.length);
      expect(new Set(cells.map(cell => cell.rotation)).size).toBeGreaterThan(1);
      expect(new Set(cells.map(cell => cell.color)).size).toBeGreaterThan(1);
    }
    expect(directions.size).toBe(4);
  });
});
