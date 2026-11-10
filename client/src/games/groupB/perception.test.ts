import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { rotationEquivalent } from '../groupA/engines';
import { COLORS } from '../shared';
import { countTargets, makeCount, makeMirror, makeOverlay, makeSorting, makeWords, MirrorRecognition } from './perception';

const levels = Array.from({ length: 30 }, (_, index) => index + 1);

describe('第 15–19 款练习的题目规则', () => {
  it('左右翻转保持行坐标，旋转不能冒充镜像', () => {
    const outcomes = new Set<boolean>();
    for (const level of levels) {
      const seed = level * 137;
      const { left, right, mirrored, displayAngle } = makeMirror(level, seed);
      const lastColumn = Math.max(...left.map(([x]) => x));
      expect(Math.max(...right.map(([x]) => x))).toBe(lastColumn);
      expect(Math.max(...right.map(([, y]) => y))).toBe(Math.max(...left.map(([, y]) => y)));
      expect(mirrored).toBe(left.every(([x, y]) => right.some(([rx, ry]) => rx === lastColumn - x && ry === y)));
      expect(rotationEquivalent(left, right)).toBe(!mirrored);
      if (displayAngle) {
        const markup = renderToStaticMarkup(createElement(MirrorRecognition, { level, seed, onFinish: () => {} }));
        expect(markup).toMatch(new RegExp(`aria-label="右图"[^>]*><g transform="rotate\\(-${displayAngle} `));
      }
      outcomes.add(mirrored);
    }
    expect(outcomes.size).toBe(2);
  });

  it('按数值升序或降序，较高难度会混合一位和两位数字', () => {
    const directions = new Set<boolean>();
    for (const level of levels) {
      const { numbers, ascending, answer } = makeSorting(level, level * 137);
      expect(answer).toEqual(numbers.map(item => item.value).sort((a, b) => ascending ? a - b : b - a));
      expect(new Set(numbers.map(item => item.size)).size).toBeGreaterThan(1);
      directions.add(ascending);
    }
    expect(directions.size).toBe(2);
    const { numbers } = makeSorting(30, 9);
    expect(numbers.some(item => item.value < 10)).toBe(true);
    expect(numbers.some(item => item.value >= 10)).toBe(true);
  });

  it('叠合题保留重叠格，候选图只有一个并集', () => {
    for (const level of levels) {
      const { left, right, options, answerIndex } = makeOverlay(level, level * 137);
      const overlap = left.filter(cell => right.includes(cell));
      expect(overlap.length).toBeGreaterThan(0);
      expect(options[answerIndex]).toEqual([...new Set([...left, ...right])].sort((a, b) => a - b));
      expect(options.filter(cells => cells.length === options[answerIndex].length)).toHaveLength(2);
      expect(options.some(cells => overlap.every(cell => !cells.includes(cell)))).toBe(true);
      expect(new Set(options.map(cells => cells.join(','))).size).toBe(options.length);
    }
  });

  it('词义选择有单一完整词义答案和有相关汉字的干扰词', () => {
    const wordsByCategory: Record<string, string[]> = {
      水果: ['苹果', '西瓜', '香蕉', '柚子', '柠檬'],
      动物: ['老虎', '海豚', '大象', '狐狸', '燕子'],
      交通工具: ['火车', '轮船', '飞机', '地铁', '公交车'],
      乐器: ['钢琴', '二胡', '长笛', '小提琴', '扬琴'],
    };
    for (const level of levels) {
      const { category, options, answer } = makeWords(level, level * 137);
      expect(options.filter(option => wordsByCategory[category].includes(option.word)).map(option => option.word)).toEqual([answer]);
      expect(options.some(option => option.word !== answer && wordsByCategory[category].some(word => [...word].some(char => option.word.includes(char))))).toBe(true);
      expect(options.every(option => COLORS.includes(option.color))).toBe(true);
    }
  });

  it('计数同时匹配颜色与形状，单独匹配任一特征不计入', () => {
    const target = { color: 1, shape: 2 };
    expect(countTargets([target, { color: 1, shape: 3 }, { color: 2, shape: 2 }, target], target)).toBe(2);
    for (const level of levels) {
      const { items, target, answer, exposureMs } = makeCount(level, level * 137);
      expect(answer).toBe(countTargets(items, target));
      expect(answer).toBeGreaterThan(0);
      expect(exposureMs).toBeGreaterThan(1000);
      expect(items.some(item => item.shape === target.shape && item.color !== target.color)).toBe(true);
      expect(items.some(item => item.color === target.color && item.shape !== target.shape)).toBe(true);
    }
  });
});
