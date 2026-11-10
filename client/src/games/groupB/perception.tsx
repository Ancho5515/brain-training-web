import { useEffect, useMemo, useRef, useState } from 'react';
import { generateRotation, normalizeCells, pathAccuracy, type Cell } from '../groupA/engines';
import { ChoiceButtons, COLORS, GameFrame, Glyph, makeResult, randInt, RoundClock, seeded, shuffle, useElapsed } from '../shared';
import type { GameProps, GameResult } from '../types';

export function makeMirror(level: number, seed: number) {
  const { left, displayAngle } = generateRotation(level, seed);
  const mirrored = seeded(seed ^ 0x4d495252)() < 0.5;
  const right = normalizeCells(left.map(([x, y]) => [-x, mirrored ? y : -y]));
  const width = 1 + Math.max(...left.map(([x]) => x));
  const height = 1 + Math.max(...left.map(([, y]) => y));
  return { left, right, mirrored, width, height, displayAngle };
}

export function makeSorting(level: number, seed: number) {
  const rng = seeded(seed);
  const count = 3 + Math.floor((level - 1) / 5);
  const digits = shuffle(Array.from({ length: 9 }, (_, i) => i + 1), rng);
  const twoDigits = shuffle(Array.from({ length: 10 + 2 * level }, (_, i) => i + 10), rng);
  const longCount = Math.floor((level - 1) / 6);
  const values = shuffle([...digits.slice(0, count - longCount), ...twoDigits.slice(0, longCount)], rng);
  const sizes = shuffle([20, 24, 28, 32, 36, 26, 30, 34], rng);
  const ascending = rng() < 0.5;
  return {
    numbers: values.map((value, i) => ({ value, size: sizes[i] })),
    ascending,
    answer: [...values].sort((a, b) => ascending ? a - b : b - a),
    exposureMs: 2400 + count * 350 - level * 36,
  };
}

export function makeOverlay(level: number, seed: number) {
  const rng = seeded(seed);
  const tier = Math.floor((level - 1) / 10);
  const load = (level - 1) % 10;
  const size = 3 + tier;
  const sharedCount = 1 + tier + Math.floor(load / 3);
  const leftCount = 1 + tier + load % 3;
  const rightCount = 1 + tier + Math.floor(load / 5);
  const filledCount = sharedCount + leftCount + rightCount;
  const slots = shuffle(Array.from({ length: size * size }, (_, i) => i), rng);
  const overlap = slots.slice(0, sharedCount);
  const leftOnly = slots.slice(sharedCount, sharedCount + leftCount);
  const rightOnly = slots.slice(sharedCount + leftCount, filledCount);
  const left = [...overlap, ...leftOnly];
  const right = [...overlap, ...rightOnly];
  const merged = [...new Set([...left, ...right])].sort((a, b) => a - b);
  const shifted = [...merged.slice(0, -1), slots[filledCount]];
  const options = shuffle([merged, shifted, left, [...leftOnly, ...rightOnly]], rng);
  return { size, left, right, options, answerIndex: options.indexOf(merged) };
}

const wordCategories = [
  { name: '水果', words: ['苹果', '西瓜', '香蕉', '柚子', '柠檬'], distractors: ['果汁', '水果刀', '香蕉皮', '苹果树', '柠檬茶'] },
  { name: '动物', words: ['老虎', '海豚', '大象', '狐狸', '燕子'], distractors: ['虎牙', '象棋', '海豚馆', '燕尾服', '狐狸面具'] },
  { name: '交通工具', words: ['火车', '轮船', '飞机', '地铁', '公交车'], distractors: ['车站', '船票', '飞机餐', '铁轨', '公交站'] },
  { name: '乐器', words: ['钢琴', '二胡', '长笛', '小提琴', '扬琴'], distractors: ['琴谱', '笛膜', '钢琴凳', '琴房', '钢丝'] },
];

export function makeWords(level: number, seed: number) {
  const rng = seeded(seed);
  const category = wordCategories[randInt(rng, 0, wordCategories.length - 1)];
  const answer = category.words[randInt(rng, 0, category.words.length - 1)];
  const distractorCount = 2 + Math.floor((level - 1) / 9);
  const relatedCount = Math.min(distractorCount, 1 + Math.floor((level - 1) / 7));
  const related = shuffle(category.distractors, rng).slice(0, relatedCount);
  const unrelated = shuffle(wordCategories.filter(group => group !== category).flatMap(group => group.words), rng)
    .slice(0, distractorCount - relatedCount);
  const options = shuffle([answer, ...related, ...unrelated], rng)
    .map(word => ({ word, color: COLORS[randInt(rng, 0, COLORS.length - 1)] }));
  return { category: category.name, options, answer };
}

type CountItem = { shape: number; color: number };

export function countTargets(items: CountItem[], target: CountItem) {
  return items.filter(item => item.shape === target.shape && item.color === target.color).length;
}

export function makeCount(level: number, seed: number) {
  const rng = seeded(seed);
  const target = { shape: randInt(rng, 0, 5), color: randInt(rng, 0, COLORS.length - 1) };
  const answer = randInt(rng, 1, 3 + Math.floor((level - 1) / 6));
  const items = Array<CountItem>(answer).fill(target);
  const otherShape = () => (target.shape + randInt(rng, 1, 5)) % 6;
  const otherColor = () => (target.color + randInt(rng, 1, COLORS.length - 1)) % COLORS.length;
  const similarPairs = 2 + Math.floor((level - 1) / 4);
  for (let i = 0; i < similarPairs; i++) {
    items.push({ shape: otherShape(), color: target.color }, { shape: target.shape, color: otherColor() });
  }
  for (let i = 0; i < 4; i++) items.push({ shape: otherShape(), color: otherColor() });
  return { target, answer: countTargets(items, target), items: shuffle(items, rng), exposureMs: 4500 - level * 65 };
}

function useFinish({ onFinish }: GameProps) {
  const done = useRef(false);
  const elapsed = useElapsed();
  return (accuracy: number, metrics: GameResult['metrics']) => {
    if (done.current) return;
    done.current = true;
    onFinish(makeResult(accuracy, elapsed(), metrics));
  };
}

function usePresentation(exposureMs: number) {
  const [stage, setStage] = useState<'ready' | 'show' | 'answer'>('ready');
  useEffect(() => {
    if (stage !== 'show') return;
    const timer = window.setTimeout(() => setStage('answer'), exposureMs);
    return () => window.clearTimeout(timer);
  }, [stage, exposureMs]);
  return { stage, start: () => setStage('show') };
}

function CellGrid({ size, rows = size, rotation = 0, cells, label }: {
  size: number; rows?: number; rotation?: number; cells: Cell[]; label: string;
}) {
  const frame = rotation ? Math.hypot(size, rows) : Math.max(size, rows);
  return <svg role="img" aria-label={label} viewBox={`${(size - frame) / 2} ${(rows - frame) / 2} ${frame} ${frame}`} width="118" height="118">
    <g transform={rotation ? `rotate(${rotation} ${size / 2} ${rows / 2})` : undefined}>
      <rect width={size} height={rows} rx=".2" fill="#edf3eb" />
      {Array.from({ length: size * rows }, (_, i) => {
        const x = i % size, y = Math.floor(i / size);
        const filled = cells.some(([column, row]) => column === x && row === y);
        return <rect key={i} x={x + .055} y={y + .055} width=".89" height=".89" rx=".09" fill={filled ? '#167b68' : '#f8faf6'} />;
      })}
    </g>
  </svg>;
}

const gridCoordinates = (cells: number[], size: number): Cell[] => cells.map(cell => [cell % size, Math.floor(cell / size)]);

export function MirrorRecognition(props: GameProps) {
  const { left, right, width, height, displayAngle, mirrored } = useMemo(() => makeMirror(props.level, props.seed), [props.level, props.seed]);
  const finish = useFinish(props);
  return <GameFrame title="镜像辨认" instructions="把左图沿竖直方向的镜面左右翻转，判断翻转后是否与右图一致。">
    <div className="controls">
      <CellGrid size={width} rows={height} rotation={displayAngle} cells={left} label="左图" />
      <CellGrid size={width} rows={height} rotation={-displayAngle} cells={right} label="右图" />
    </div>
    <ChoiceButtons options={[{ id: 'yes', label: '是镜像' }, { id: 'no', label: '不是镜像' }]}
      onChoose={choice => finish(Number((choice === 'yes') === mirrored), { mirrored, answeredMirror: choice === 'yes' })} />
  </GameFrame>;
}

export function SequenceReorder(props: GameProps) {
  const task = useMemo(() => makeSorting(props.level, props.seed), [props.level, props.seed]);
  const { stage, start } = usePresentation(task.exposureMs);
  const [values, setValues] = useState(() => task.numbers.map(() => ''));
  const finish = useFinish(props);
  const valid = values.every(value => /^\d{1,2}$/.test(value));
  return <GameFrame title="顺序重排" instructions="记住所有数字，忽略字号。画面消失后，按提示的顺序填写。">
    {stage === 'ready' && <button className="primary" onClick={start}>开始观察</button>}
    {stage === 'show' && <div className="controls" aria-label="待记忆数字">
      {task.numbers.map(item => <div className="tile" key={item.value} style={{ fontSize: item.size, minWidth: 48 }}>{item.value}</div>)}
    </div>}
    {stage === 'answer' && <form onSubmit={event => {
      event.preventDefault();
      if (!valid) return;
      const accuracy = pathAccuracy(task.answer, values.map(Number));
      finish(accuracy, { ascending: task.ascending, count: values.length, completeSequence: accuracy === 1 });
    }}>
      <h3>{task.ascending ? '从小到大填写' : '从大到小填写'}</h3>
      <div className="controls">
        {values.map((value, i) => <label key={i}>第 {i + 1} 位 <input type="text" inputMode="numeric" autoComplete="off"
          aria-label={`第 ${i + 1} 位`} maxLength={2} style={{ width: '4.5rem' }} value={value}
          onChange={event => setValues(values.map((old, index) => index === i ? event.target.value : old))} /></label>)}
      </div>
      <button className="primary" type="submit" disabled={!valid}>提交答案</button>
    </form>}
  </GameFrame>;
}

export function GridOverlay(props: GameProps) {
  const task = useMemo(() => makeOverlay(props.level, props.seed), [props.level, props.seed]);
  const finish = useFinish(props);
  return <GameFrame title="方块叠合" instructions="合并两张方格的着色位置，只要其中一张有颜色就保留。选出合并后的图案。">
    <div className="controls">
      <CellGrid size={task.size} cells={gridCoordinates(task.left, task.size)} label="第一张方格" />
      <CellGrid size={task.size} cells={gridCoordinates(task.right, task.size)} label="第二张方格" />
    </div>
    <ChoiceButtons options={task.options.map((cells, i) => ({ id: String(i), label: <CellGrid size={task.size}
      cells={gridCoordinates(cells, task.size)} label={`候选图案 ${i + 1}`} /> }))}
      onChoose={choice => finish(Number(Number(choice) === task.answerIndex), { side: task.size })} />
  </GameFrame>;
}

export function SemanticConflict(props: GameProps) {
  const { category, options, answer } = useMemo(() => makeWords(props.level, props.seed), [props.level, props.seed]);
  const finish = useFinish(props);
  return <GameFrame title="词义冲突" instructions="按整个词的含义选择，忽略字色和碰巧出现的相关汉字。">
    <RoundClock level={props.level} baseMs={90000} stepMs={1600} onExpire={() => finish(0, { timedOut: true })} />
    <h3>请选择{category}</h3>
    <ChoiceButtons options={options.map(({ word, color }) => ({ id: word, label: <strong style={{ color }}>{word}</strong> }))}
      onChoose={word => finish(Number(word === answer), { category, chosenWord: word })} />
  </GameFrame>;
}

const colorNames = ['青绿', '珊瑚红', '蓝色', '金黄', '紫色', '草绿'];
const shapeNames = ['圆形', '三角形', '方形', '菱形', '十字', '星形'];

export function FeatureCounting(props: GameProps) {
  const task = useMemo(() => makeCount(props.level, props.seed), [props.level, props.seed]);
  const { stage, start } = usePresentation(task.exposureMs);
  const [value, setValue] = useState('');
  const finish = useFinish(props);
  const valid = /^\d{1,2}$/.test(value);
  return <GameFrame title="多目标计数" instructions="只数颜色和形状都与目标相同的图形，画面消失后填写数量。">
    <p>目标：{colorNames[task.target.color]}{shapeNames[task.target.shape]} <Glyph shape={task.target.shape} color={COLORS[task.target.color]} size={34} /></p>
    {stage === 'ready' && <button className="primary" onClick={start}>开始观察</button>}
    {stage === 'show' && <div className="game-grid" aria-label="计数画面" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', maxWidth: 400 }}>
      {task.items.map(({ shape, color }, i) => <div className="tile" key={i}><Glyph shape={shape} color={COLORS[color]} size={36} /></div>)}
    </div>}
    {stage === 'answer' && <form onSubmit={event => {
      event.preventDefault();
      if (!valid) return;
      const answer = Number(value), error = Math.abs(answer - task.answer);
      finish(Math.max(0, 1 - error / task.answer), { expectedCount: task.answer, answerCount: answer, absoluteError: error });
    }}>
      <label>目标有几个？ <input type="text" inputMode="numeric" autoComplete="off" maxLength={2}
        style={{ width: '5rem' }} value={value} onChange={event => setValue(event.target.value)} /></label>
      <button className="primary" type="submit" disabled={!valid}>提交答案</button>
    </form>}
  </GameFrame>;
}
