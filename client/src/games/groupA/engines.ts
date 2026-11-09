import { randInt, seeded, shuffle } from '../shared';

export type Cell = [number, number];
export interface Card { shape: number; striped: boolean; rotation: number; }
export interface TrackingBall { id: number; x: number; y: number; vx: number; vy: number; }
const levelOf = (level: number) => Math.max(1, Math.min(30, Math.round(level)));
const indices = (n: number) => Array.from({ length: n }, (_, i) => i);
const direction = (r: number) => ((r % 360) + 360) % 360;
export function generateSchulte(level:number,seed:number) {
  const l=levelOf(level), rng=seeded(seed);
  return { cells:shuffle(indices(30).map(i=>i+1),rng).map((number,i)=>({number,span:2+(i%3)})), timeMs:42000-l*650 };
}

export const countDots = (items: { shape: number }[]) => items.filter(i => i.shape === 0).length;
export const pathAccuracy = (expected: number[], actual: number[]) => expected.length === 0 ? 0 : expected.filter((v, i) => actual[i] === v).length / Math.max(expected.length, actual.length);
export function setAccuracy(expected: number[], actual: number[]) {
  const targets = new Set(expected), selected = new Set(actual);
  const hits = [...selected].filter(x => targets.has(x)).length;
  const falsePositives = selected.size - hits;
  return { accuracy: hits / Math.max(1, targets.size + falsePositives), hits, misses: targets.size - hits, falsePositives };
}
export const digitsToRemember = (cells: { value: string; underlined: boolean }[]) => cells.filter(c => c.underlined && /^\d$/.test(c.value)).map(c => c.value).join('');
export const exactCardMatch = (a: Card, b: Card) => a.shape === b.shape && a.striped === b.striped && direction(a.rotation) === direction(b.rotation);

export function normalizeCells(cells: Cell[]): Cell[] {
  if (!cells.length) return [];
  const minX = Math.min(...cells.map(c => c[0])), minY = Math.min(...cells.map(c => c[1]));
  return cells.map(([x, y]): Cell => [x - minX, y - minY]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}
function rotate(cells: Cell[], turns: number): Cell[] {
  let result = cells;
  for (let i = 0; i < turns; i++) result = result.map(([x, y]) => [-y, x]);
  return normalizeCells(result);
}
export function rotationEquivalent(a: Cell[], b: Cell[]) {
  const key = JSON.stringify(normalizeCells(b));
  return a.length === b.length && indices(4).some(r => JSON.stringify(rotate(a, r)) === key);
}

/** A small arithmetic parser; no eval, and multiplication/division bind before addition. */
export function evaluateExpression(expression: string): number {
  const source = expression.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s/g, '');
  const tokens = source.match(/\d+(?:\.\d+)?|[()+*/-]/g) ?? [];
  if (tokens.join('') !== source || !tokens.length) throw new Error('无效算式');
  let at = 0;
  function atom(): number {
    if (tokens[at] === '+' || tokens[at] === '-') { const sign = tokens[at++]; return (sign === '-' ? -1 : 1) * atom(); }
    if (tokens[at] === '(') { at++; const result = sum(); if (tokens[at++] !== ')') throw new Error('括号不匹配'); return result; }
    const token = tokens[at++];
    if (token === undefined || !/^\d/.test(token)) throw new Error('缺少数字');
    return Number(token);
  }
  function product(): number {
    let value = atom();
    while (tokens[at] === '*' || tokens[at] === '/') {
      const op = tokens[at++], right = atom();
      if (op === '/' && right === 0) throw new Error('不能除以零');
      value = op === '*' ? value * right : value / right;
    }
    return value;
  }
  function sum(): number {
    let value = product();
    while (tokens[at] === '+' || tokens[at] === '-') { const op = tokens[at++], right = product(); value = op === '+' ? value + right : value - right; }
    return value;
  }
  const result = sum();
  if (at !== tokens.length || !Number.isFinite(result)) throw new Error('无效算式');
  return result;
}

export function rhythmAccuracy(expected: number[], actual: number[]) {
  const total = Math.max(expected.length, actual.length);
  if (!total) return 0;
  return expected.reduce((score, gap, i) => score + (actual[i] === undefined ? 0 : Math.max(0, 1 - Math.abs(gap - actual[i]) / gap)), 0) / total;
}
function reflect(position: number, low: number, high: number) {
  const width = high - low, offset = ((position - low) % (width * 2) + width * 2) % (width * 2);
  return low + (offset <= width ? offset : width * 2 - offset);
}
export const trackingPosition = (ball: TrackingBall, seconds: number) => ({ x: reflect(ball.x + ball.vx * seconds, 7, 93), y: reflect(ball.y + ball.vy * seconds, 9, 91) });

export function generateCount(level: number, seed: number) {
  const l = levelOf(level), rng = seeded(seed), answer = 3 + Math.floor((l - 1) * 0.4), distractors = 2 + Math.floor(l / 3);
  const shapes = shuffle([...Array<number>(answer).fill(0), ...indices(distractors).map(() => randInt(rng, 1, 2))], rng);
  return { items: shapes.map(shape => ({ shape, size: randInt(rng, 27, 40), color: randInt(rng, 0, 2) })), answer, exposureMs: 2100 - 35 * l };
}
export function generateTracking(level: number, seed: number) {
  const l = levelOf(level), rng = seeded(seed), count = 3 + Math.floor((l - 1) / 5), travelMs = 2600 + 70 * l;
  const balls: TrackingBall[] = [], cols = Math.ceil(Math.sqrt(count));
  for (let i = 0; i < count; i++) {
    const x = 18 + (i % cols) * 64 / Math.max(1, cols - 1), y = 20 + Math.floor(i / cols) * 60 / Math.max(1, Math.ceil(count / cols) - 1);
    let ball: TrackingBall = { id: i, x, y, vx: 0, vy: 0 };
    for (let attempt = 0; attempt < 300; attempt++) {
      const angle = rng() * Math.PI * 2, speed = 11 + l * 0.8;
      ball = { id: i, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
      const end = trackingPosition(ball, travelMs / 1000);
      if (balls.every(b => { const p = trackingPosition(b, travelMs / 1000); return Math.hypot(p.x - end.x, p.y - end.y) >= 17; })) break;
    }
    balls.push(ball);
  }
  return { balls, target: randInt(rng, 0, count - 1), travelMs, cueMs: 1600 - l * 10 };
}
export function generateSequence(level: number, seed: number) {
  const l = levelOf(level), rng = seeded(seed), period = shuffle(indices(7), rng).slice(0, 2 + Math.floor((l - 1) / 7));
  const length = period.length * 2 + randInt(rng, 0, period.length - 1);
  const items = indices(length).map(i => ({ shape: period[i % period.length], color: randInt(rng, 0, 5), size: randInt(rng, 35, 49) - (i % 3 === 1 ? (l - 1) * 0.45 : 0) }));
  return { period, items, answer: period[length % period.length], options: shuffle(indices(7), rng).slice(0, 7) };
}
export function generateStroop(level: number, seed: number) {
  const l = levelOf(level), rng = seeded(seed), count = 3 + Math.floor((l - 1) / 9), options = shuffle(indices(6), rng).slice(0, count);
  const ink = options[randInt(rng, 0, options.length - 1)], other = options.filter(c => c !== ink);
  return { ink, word: l > 4 || rng() > 0.35 ? other[randInt(rng, 0, other.length - 1)] : ink, sides: indices(2 + Math.floor(l / 8) * 2).map(() => randInt(rng, 0, 5)), options, sideFontSize: 13 + l * 0.55 };
}
export function generatePath(level: number, seed: number) {
  const l = levelOf(level), rng = seeded(seed), side = 3 + Math.floor((l - 1) / 12), length = 3 + Math.floor((l - 1) / 5), distractors = 1 + Math.floor(l / 7);
  const cells = shuffle(indices(side * side), rng), targets = cells.slice(0, length), hollow = cells.slice(length, length + distractors);
  const marks = shuffle([...Array<boolean>(length).fill(true), ...Array<boolean>(distractors).fill(false)], rng);
  let t = 0, d = 0;
  return { side, targets, frames: marks.map(solid => ({ solid, cell: solid ? targets[t++] : hollow[d++] })), stepMs: 1000 - 15 * l };
}
export function generateDigits(level: number, seed: number) {
  const l = levelOf(level), rng = seeded(seed), count = 3 + Math.floor((l - 1) / 4), cols = 4 + Math.floor((l - 1) / 12), total = cols * Math.ceil((count * 2 + 3) / cols);
  const positions = new Set(shuffle(indices(total), rng).slice(0, count));
  const distractors = 'ABCXYZ#?';
  const cells = indices(total).map(i => positions.has(i) ? { value: String(randInt(rng, 0, 9)), underlined: true } : { value: rng() > 0.5 ? String(randInt(rng, 0, 9)) : distractors[randInt(rng, 0, distractors.length - 1)], underlined: false });
  const letterIndex = indices(total).find(i => !positions.has(i))!;
  cells[letterIndex] = { value: 'X', underlined: true };
  return { cols, cells, answer: digitsToRemember(cells), exposureMs: 3200 + count * 180 - l * 38 };
}
export function generateLocations(level: number, seed: number) {
  const l = levelOf(level), rng = seeded(seed), side = 3 + Math.floor((l - 1) / 12), count = 3 + Math.floor((l - 1) / 5), stripes = 1 + Math.floor(l / 8);
  const cells: ('solid' | 'striped' | 'empty')[] = Array(side * side).fill('empty');
  const positions = shuffle(indices(side * side), rng);
  positions.slice(0, count).forEach(i => cells[i] = 'solid');
  positions.slice(count, count + stripes).forEach(i => cells[i] = 'striped');
  return { side, cells, targets: indices(cells.length).filter(i => cells[i] === 'solid'), exposureMs: 2500 - 30 * l };
}
const cardCatalog = () => [1, 5, 6].flatMap(shape => [false, true].flatMap(striped => [0, 90, 180, 270].map(rotation => ({ shape, striped, rotation }))));
export function generatePairs(level: number, seed: number) {
  const l = levelOf(level), rng = seeded(seed), pairCount = 3 + Math.floor((l - 1) / 4), identities = shuffle(cardCatalog(), rng).slice(0, pairCount);
  return { cards: shuffle(identities.flatMap(c => [{ ...c }, { ...c }]), rng), pairCount, timeMs: 50000 - l * 550 };
}
export function generateRotation(level: number, seed: number) {
  const l = levelOf(level), rng = seeded(seed), size = 4 + Math.floor((l - 1) / 4);
  let shape: Cell[] = [[0, 0], [0, 1], [0, 2], [1, 2]];
  for (let attempt = 0; attempt < 100; attempt++) {
    let candidate: Cell[] = [[0, 0], [0, 1], [0, 2], [1, 2]];
    while (candidate.length < size) {
      const [x, y] = candidate[randInt(rng, 0, candidate.length - 1)], [dx, dy] = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as Cell[])[randInt(rng, 0, 3)];
      if (!candidate.some(c => c[0] === x + dx && c[1] === y + dy)) candidate.push([x + dx, y + dy]);
    }
    candidate = normalizeCells(candidate);
    if (!rotationEquivalent(candidate, candidate.map(([x, y]) => [-x, y]))) { shape = candidate; break; }
  }
  const same = rng() > 0.5;
  return { left: rotate(shape, randInt(rng, 0, 3)), right: rotate(same ? shape : shape.map(([x, y]) => [-x, y]), randInt(rng, 1, 3)), same, displayAngle: ((l - 1) % 4) * 15 };
}
export function generateSearch(level: number, seed: number) {
  const l = levelOf(level), rng = seeded(seed), count = 8 + l, totalTargets = 2 + Math.floor(l / 5), catalog = cardCatalog();
  const target = catalog[randInt(rng, 0, catalog.length - 1)], alternatives = catalog.filter(c => !exactCardMatch(c, target));
  const items = shuffle([...indices(totalTargets).map(() => ({ ...target })), ...indices(count - totalTargets).map(() => ({ ...alternatives[randInt(rng, 0, alternatives.length - 1)] }))], rng);
  return { target, items, targets: indices(items.length).filter(i => exactCardMatch(items[i], target)) };
}
export function generateRhythm(level: number, seed: number) {
  const l = levelOf(level), rng = seeded(seed), length = 2 + Math.floor((l - 1) / 5), choices = [400, 650, 900, 1150].slice(0, 2 + Math.floor((l - 1) / 10));
  return { gaps: indices(length).map(() => choices[randInt(rng, 0, choices.length - 1)]), distractorGap: 680 - l * 7 };
}
export function generateArithmetic(level: number, seed: number) {
  const l = levelOf(level), rng = seeded(seed), max = 5 + l, n = () => randInt(rng, 2, max), a = n(), b = n(), c = randInt(rng, 2, 9), d = n(), e = randInt(rng, 2, 8), f = n();
  const expression = l <= 5 ? `${a} + ${b} − ${c}` : l <= 10 ? `${a} + ${b} × ${c}` : l <= 15 ? `(${a} + ${b}) × ${c} − ${d}` : l <= 20 ? `${a * c} ÷ ${c} + ${b} × ${e}` : l <= 25 ? `${a} × (${b} + ${c}) − ${d} × ${e}` : `(${a} + ${b} × ${c}) − (${d * e} ÷ ${e} + ${f})`;
  return { expression, answer: evaluateExpression(expression) };
}
export interface SwitchTrial { rule:'color'|'shape';color:number;shape:number;options:number[];timeLimitMs:number; }
export function generateSwitch(level: number, seed: number): SwitchTrial[] {
  const l = levelOf(level), rng = seeded(seed), count = 3 + Math.floor((l - 1) / 10), length = 4 + Math.floor((l - 1) / 4), trials: SwitchTrial[] = [];
  for (let i = 0; i < length; i++) {
    const previous = trials[i - 1]?.rule ?? 'shape';
    const change = i === 1 || (i !== 2 && rng() < 0.35 + l * 0.01);
    const rule = change ? previous === 'color' ? 'shape' : 'color' : previous;
    trials.push({ rule, color: randInt(rng, 0, count - 1), shape: randInt(rng, 0, count - 1), options: shuffle(indices(count), rng), timeLimitMs:12000-l*200 });
  }
  return trials;
}
