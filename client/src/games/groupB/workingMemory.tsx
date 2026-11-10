import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChoiceButtons, COLORS, GameFrame, Glyph, makeResult, randInt, seeded, shuffle, useElapsed } from '../shared';
import type { GameProps, GameResult } from '../types';

type RelayCard = { shape: number; color: number };
type RelayState = { index: number; hits: number; misses: number; falseAlarms: number; correctRejections: number };
type RelayAnswer = 'next' | 'same' | 'different';
type InventorySlip = { item: number; delta: number; valid: boolean };
type WitnessClue = { kind: 'clue' | 'correction'; trait: number; value: number } | { kind: 'aside'; text: string };

const SHAPES = ['圆形', '三角形', '方形', '菱形', '十字', '星形', '箭头'];
const COLOR_NAMES = ['青色', '珊瑚红', '蓝色', '赭黄色', '紫色', '绿色'];
const INVENTORY_ITEMS = ['铅笔', '方巾', '积木', '卡片', '夹子', '徽章'];
const WITNESS_TRAITS = [
  ['帽子', ['鸭舌帽', '渔夫帽', '针织帽']],
  ['围巾', ['蓝色', '黄色', '绿色']],
  ['眼镜', ['圆框', '方框', '没戴眼镜']],
  ['包', ['单肩包', '双肩包', '手提袋']],
] as const;
const ASIDES = [
  '我自己今天围的是蓝围巾。', '公交刚从站台开走。', '长椅上放着一顶针织帽。',
  '旁边的商店正在打烊。', '我把自己的手提袋落在车里了。', '广场上的钟刚响过。',
];

function differentIndex(value: number, count: number, rng: () => number) {
  return (value + randInt(rng, 1, count - 1)) % count;
}

function useFinish(onFinish: GameProps['onFinish']) {
  const elapsed = useElapsed();
  const completed = useRef(false);
  const callback = useRef(onFinish);
  callback.current = onFinish;
  return useCallback((accuracy: number, metrics: GameResult['metrics']) => {
    if (completed.current) return;
    completed.current = true;
    callback.current(makeResult(accuracy, elapsed(), metrics));
  }, []);
}

function useObservation(durationMs: number) {
  const [stage, setStage] = useState<'ready' | 'observe' | 'recall'>('ready');
  useEffect(() => {
    if (stage !== 'observe') return;
    const timer = setTimeout(() => setStage('recall'), durationMs);
    return () => clearTimeout(timer);
  }, [stage, durationMs]);
  return { stage, start: () => setStage(current => current === 'ready' ? 'observe' : current) };
}

function makeInhibition(level: number, seed: number) {
  const rng = seeded(seed);
  const count = 8 + Math.floor((level - 1) / 4);
  const redCount = Math.ceil(count * (0.28 + (level - 1) / 180));
  const colors = shuffle(Array.from({ length: count }, (_, i) => i >= redCount), rng);
  const trials = colors.map((green, i) => {
    const left = rng() < 0.5;
    const conflicting = i === 0 || rng() < 0.55;
    const wordGreen = conflicting ? !green : green;
    return {
      green,
      left,
      right: left === green ? !green : rng() < 0.5,
      word: wordGreen ? '点' : '停',
      pauseMs: randInt(rng, 320, 620),
    };
  });
  return { trials, responseMs: 1500 - (level - 1) * 22 };
}

function makeIcon(level: number, seed: number) {
  const rng = seeded(seed);
  const side = level <= 18 ? 3 : 4;
  const pieceCount = 3 + Math.floor((level - 1) / 6);
  const pool = Array.from({ length: SHAPES.length * COLORS.length }, (_, i) => i);
  const parts = shuffle(pool, rng).slice(0, pieceCount + 2 + Math.floor((level - 1) / 10));
  const cells = Array<number | null>(side * side).fill(null);
  const locations = shuffle(cells.map((_, i) => i), rng);
  for (let i = 0; i < pieceCount; i++) cells[locations[i]] = parts[i];
  return { side, cells, palette: shuffle(parts, rng), pieceCount, exposureMs: 6600 - (level - 1) * 100 };
}

export function makeWitness(level: number, seed: number) {
  const rng = seeded(seed);
  const traitCount = 2 + Math.floor((level - 1) / 10);
  const active = shuffle(WITNESS_TRAITS.map((_, i) => i), rng).slice(0, traitCount);
  const corrections = new Set(active.slice(0, traitCount - 1));
  const target = WITNESS_TRAITS.map(() => randInt(rng, 0, 2));
  const oldValues = target.map(value => differentIndex(value, 3, rng));
  const initial: WitnessClue[] = active.map(trait => ({
    kind: 'clue', trait, value: corrections.has(trait) ? oldValues[trait] : target[trait],
  }));
  const updates: WitnessClue[] = [...corrections].map(trait => ({ kind: 'correction', trait, value: target[trait] }));
  const asides: WitnessClue[] = shuffle(ASIDES, rng).slice(0, 1 + (level - 1) % 5)
    .map(text => ({ kind: 'aside', text }));
  const clues = [...shuffle([...initial, asides[0]], rng), ...shuffle([...updates, ...asides.slice(1)], rng)];

  const changeTrait = (trait: number, value: number) => target.map((v, i) => i === trait ? value : v);
  const decoys = active.map(trait => changeTrait(trait, oldValues[trait]));
  const others = active.map(trait => changeTrait(trait, 3 - target[trait] - oldValues[trait]));
  const candidateCount = 4 + Math.floor((level - 1) / 5);
  const candidates = shuffle([target, ...decoys, ...shuffle(others, rng).slice(0, candidateCount - traitCount - 1)], rng);
  return { active, candidates, clues };
}

export function witnessMatches(candidates: readonly (readonly number[])[], clues: readonly WitnessClue[]): number[] {
  const constraints = new Map<number, number>();
  for (const clue of clues) {
    if (clue.kind !== 'aside') constraints.set(clue.trait, clue.value);
  }
  return candidates.flatMap((candidate, i) => [...constraints].every(([trait, value]) => candidate[trait] === value) ? [i] : []);
}

export function makeRelay(level: number, seed: number) {
  const rng = seeded(seed);
  const steps = 1 + Math.floor((level - 1) / 10);
  const shapeCount = 3 + Math.floor((level - 1) / 7);
  const scoredCount = 6 + Math.floor((level - 1) / 2);
  const matchingCount = Math.floor(scoredCount * 0.4) + (level - 1) % 2;
  const matches = shuffle(Array.from({ length: scoredCount }, (_, i) => i < matchingCount), rng);
  const cards: RelayCard[] = Array.from({ length: steps }, () => ({
    shape: randInt(rng, 0, shapeCount - 1), color: randInt(rng, 0, COLORS.length - 1),
  }));
  for (const [i, match] of matches.entries()) {
    const earlier = cards[i];
    cards.push({
      shape: match ? earlier.shape : differentIndex(earlier.shape, shapeCount, rng),
      color: randInt(rng, 0, COLORS.length - 1),
    });
  }
  return { steps, cards, scoredCount };
}

export function answerRelayCard(state: RelayState, cards: readonly RelayCard[], steps: number, index: number, answer: RelayAnswer): RelayState {
  if (index !== state.index || index >= cards.length) return state;
  if (index < steps) return answer === 'next' ? { ...state, index: index + 1 } : state;
  if (answer === 'next') return state;
  const next = { ...state, index: index + 1 };
  const matches = cards[index].shape === cards[index - steps].shape;
  if (matches) {
    if (answer === 'same') next.hits++;
    else next.misses++;
  } else if (answer === 'same') next.falseAlarms++;
  else next.correctRejections++;
  return next;
}

export function applyInventorySlip(counts: readonly number[], slip: InventorySlip): readonly number[] {
  return slip.valid ? counts.map((count, item) => item === slip.item ? count + slip.delta : count) : counts;
}

export function makeInventory(level: number, seed: number) {
  const rng = seeded(seed);
  const itemCount = 3 + Math.floor((level - 1) / 10);
  const items = shuffle(INVENTORY_ITEMS, rng).slice(0, itemCount);
  const initial = items.map(() => randInt(rng, 3, 6 + Math.floor((level - 1) / 5)));
  const slipCount = 6 + Math.floor((level - 1) / 3);
  const voidCount = 1 + Math.floor((level - 1) / 8);
  const amount = 2 + Math.floor((level - 1) / 7);
  const statuses = shuffle(Array.from({ length: slipCount }, (_, i) => i >= voidCount), rng);
  let finalCounts: readonly number[] = initial;
  let validSeen = 0;
  const startsWithRemoval = rng() < 0.5;
  const slips = statuses.map((valid, i) => {
    const item = i < itemCount ? i : randInt(rng, 0, itemCount - 1);
    const removing = valid && validSeen < 2 ? (validSeen === 0) === startsWithRemoval : rng() < 0.5;
    const maxRemoval = valid ? Math.min(finalCounts[item], amount) : amount;
    const delta = removing && maxRemoval > 0 ? -randInt(rng, 1, maxRemoval) : randInt(rng, 1, amount);
    const slip = { item, delta, valid };
    finalCounts = applyInventorySlip(finalCounts, slip);
    if (valid) validSeen++;
    return slip;
  });
  return { items, initial, slips, finalCounts, exposureMs: 7300 - (level - 1) * 100 };
}

function signalColor(green?: boolean) {
  if (green === undefined) return '#e0e8df';
  return green ? '#167b68' : '#b8423b';
}

export function ResponseInhibition({ level, seed, onFinish }: GameProps) {
  const { trials, responseMs } = useMemo(() => makeInhibition(level, seed), [level, seed]);
  const finish = useFinish(onFinish);
  // Each trial starts with an unlit pause followed by its response window.
  const [step, setStep] = useState(-1);
  const index = Math.floor(step / 2);
  const trial = trials[index];
  const showing = step % 2 === 1;
  const active = useRef<{ step: number; startedAt: number; reactionMs: number | null } | null>(null);
  const stats = useRef({ hits: 0, misses: 0, falseAlarms: 0, correctRejections: 0, totalReactionMs: 0 });

  useEffect(() => {
    if (!trial) return;
    if (!showing) {
      const timer = setTimeout(() => setStep(step + 1), trial.pauseMs);
      return () => clearTimeout(timer);
    }
    const window = { step, startedAt: performance.now(), reactionMs: null as number | null };
    active.current = window;
    const timer = setTimeout(() => {
      active.current = null;
      const totals = stats.current;
      if (trial.green) {
        if (window.reactionMs === null) totals.misses++;
        else {
          totals.hits++;
          totals.totalReactionMs += window.reactionMs;
        }
      } else if (window.reactionMs === null) totals.correctRejections++;
      else totals.falseAlarms++;
      setStep(step + 1);
      if (index + 1 === trials.length) {
        const { hits, misses, falseAlarms, correctRejections, totalReactionMs } = totals;
        finish((hits + correctRejections) / trials.length, {
          hits, misses, falseAlarms, correctRejections, responseWindowMs: responseMs,
          meanHitReactionMs: hits ? Math.round(totalReactionMs / hits) : 0,
        });
      }
    }, responseMs);
    return () => {
      clearTimeout(timer);
      if (active.current === window) active.current = null;
    };
  }, [trial, showing, step, index, trials.length, responseMs, finish]);

  function respond() {
    const window = active.current;
    if (!window || window.step !== step || window.reactionMs !== null) return;
    const elapsed = performance.now() - window.startedAt;
    if (elapsed < responseMs) window.reactionMs = elapsed;
  }

  return <GameFrame title="反应抑制" instructions="只看中央圆的颜色。绿圆出现时点一次，红圆出现时等下一次亮灯。两侧的灯和中央文字都要忽略。">
    {step === -1 ? <button className="primary" onClick={() => setStep(current => current === -1 ? 0 : current)}>开始反应</button>
      : trial ? <>
        <p className="status">亮灯 {index + 1} / {trials.length}</p>
        <div className="controls" style={{ alignItems: 'center', flexWrap: 'nowrap', gap: 'clamp(12px, 5vw, 36px)' }}>
          <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: '50%', background: signalColor(showing ? trial.left : undefined) }} />
          <button type="button" aria-label={showing ? (trial.green ? '中央绿圆' : '中央红圆') : '等待亮灯'}
            disabled={!showing} onClick={respond} style={{ width: 104, height: 104, borderRadius: '50%',
              background: signalColor(showing ? trial.green : undefined), color: 'white', fontSize: 28, fontWeight: 700 }}>
            <span aria-hidden="true">{showing ? trial.word : '·'}</span>
          </button>
          <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: '50%', background: signalColor(showing ? trial.right : undefined) }} />
        </div>
      </> : <p role="status">本回合已结束</p>}
  </GameFrame>;
}

function partLabel(part: number) {
  return COLOR_NAMES[Math.floor(part / SHAPES.length)] + SHAPES[part % SHAPES.length];
}

function IconPart({ part }: { part: number }) {
  return <Glyph shape={part % SHAPES.length} color={COLORS[Math.floor(part / SHAPES.length)]} size={40} />;
}

export function IconRebuild({ level, seed, onFinish }: GameProps) {
  const task = useMemo(() => makeIcon(level, seed), [level, seed]);
  const { stage, start } = useObservation(task.exposureMs);
  const finish = useFinish(onFinish);
  const [selected, setSelected] = useState<number | 'erase' | null>(null);
  const [placed, setPlaced] = useState<(number | null)[]>(() => task.cells.map(() => null));
  const filled = placed.filter(part => part !== null).length;
  const gridStyle = { gridTemplateColumns: `repeat(${task.side}, minmax(0, 1fr))`, maxWidth: 340 };
  const tileStyle = { aspectRatio: '1', padding: 4 };

  function place(index: number) {
    if (selected === null) return;
    setPlaced(old => old.map((part, i) => i === index ? (selected === 'erase' ? null : selected) : part));
  }

  function submit() {
    if (!filled) return;
    const correct = task.cells.filter((part, i) => part !== null && part === placed[i]).length;
    finish(correct / Math.max(task.pieceCount, filled), { correct, placed: filled, targets: task.pieceCount, exposureMs: task.exposureMs });
  }

  return <GameFrame title="图标拼绘" instructions="记住图标零件的形状、颜色和位置。图案隐藏后，先选零件再点格子。选另一零件可替换，完成后一次提交。">
    {stage === 'ready' && <button className="primary" onClick={start}>开始观察（{(task.exposureMs / 1000).toFixed(1)} 秒）</button>}
    {stage === 'observe' && <>
      <p className="status">观察零件与位置</p>
      <div className="game-grid" aria-label="原图" style={gridStyle}>
        {task.cells.map((part, i) => <div className="tile" key={i} style={tileStyle}>{part !== null && <IconPart part={part} />}</div>)}
      </div>
    </>}
    {stage === 'recall' && <>
      <p className="status">先选零件，再点下方格子</p>
      <div className="controls" aria-label="图标零件" style={{ maxWidth: 420, margin: 'auto' }}>
        {task.palette.map(part => <button key={part} className={`tile ${selected === part ? 'selected' : ''}`}
          style={{ minWidth: 48, padding: 4 }} aria-label={partLabel(part)} aria-pressed={selected === part} onClick={() => setSelected(part)}>
          <IconPart part={part} />
        </button>)}
        <button className={selected === 'erase' ? 'selected' : ''} aria-pressed={selected === 'erase'} onClick={() => setSelected('erase')}>擦除</button>
      </div>
      <div className="game-grid" aria-label="复原网格" style={gridStyle}>
        {placed.map((part, i) => <button className="tile" style={tileStyle} key={i} disabled={selected === null}
          aria-label={`第 ${i + 1} 格${part === null ? '（空）' : `（${partLabel(part)}）`}`} onClick={() => place(i)}>
          {part !== null && <IconPart part={part} />}
        </button>)}
      </div>
      <button className="primary" disabled={!filled} onClick={submit}>提交拼图</button>
    </>}
  </GameFrame>;
}

function witnessLine(clue: WitnessClue) {
  if (clue.kind === 'aside') return clue.text;
  const [label, values] = WITNESS_TRAITS[clue.trait];
  const description = `${label}是${values[clue.value]}`;
  return clue.kind === 'correction' ? `我更正一下，那个人的${description}。` : `我记得那个人的${description}。`;
}

export function WitnessSearch({ level, seed, onFinish }: GameProps) {
  const { active, candidates, clues } = useMemo(() => makeWitness(level, seed), [level, seed]);
  const [choosing, setChoosing] = useState(false);
  const finish = useFinish(onFinish);

  return <GameFrame title="特征寻人" instructions="读完证人的话，记住那个人的特征。闲聊不用记，明确更正后以最新说法为准。开始辨认后，找出符合全部线索的人。">
    {choosing ? <>
      <p className="status">选出符合最新线索的人</p>
      <ChoiceButtons options={candidates.map((candidate, i) => ({ id: String(i), label: <>
        <strong>人物 {i + 1}</strong>
        {active.map(trait => <span key={trait} style={{ display: 'block' }}>{WITNESS_TRAITS[trait][0]} · {WITNESS_TRAITS[trait][1][candidate[trait]]}</span>)}
      </> }))} onChoose={id => finish(Number(witnessMatches(candidates, clues).includes(Number(id))), {
        traits: active.length, candidates: candidates.length, corrections: clues.filter(clue => clue.kind === 'correction').length,
      })} />
    </> : <>
      <ol className="board" aria-label="证人的话" style={{ maxWidth: 500, textAlign: 'left', paddingLeft: 32 }}>
        {clues.map((clue, i) => <li key={i} style={{ marginBottom: 10 }}>{witnessLine(clue)}</li>)}
      </ol>
      <button className="primary" onClick={() => setChoosing(true)}>开始辨认</button>
    </>}
  </GameFrame>;
}

export function MemoryRelay({ level, seed, onFinish }: GameProps) {
  const { cards, steps, scoredCount } = useMemo(() => makeRelay(level, seed), [level, seed]);
  const finish = useFinish(onFinish);
  const state = useRef<RelayState>({ index: 0, hits: 0, misses: 0, falseAlarms: 0, correctRejections: 0 });
  const [index, setIndex] = useState(-1);
  const card = cards[index];

  function answer(choice: RelayAnswer) {
    const next = answerRelayCard(state.current, cards, steps, index, choice);
    if (next === state.current) return;
    state.current = next;
    setIndex(next.index);
    if (next.index === cards.length) {
      const { hits, misses, falseAlarms, correctRejections } = next;
      finish((hits + correctRejections) / scoredCount, { n: steps, hits, misses, falseAlarms, correctRejections });
    }
  }

  return <GameFrame title="记忆接力" instructions={`判断当前图形与 ${steps} 张之前的图形是否同形。忽略颜色。前 ${steps} 张用于热身，只观察记忆。之后每张只能答一次。`}>
    {index === -1 ? <button className="primary" onClick={() => setIndex(current => current === -1 ? 0 : current)}>开始接力</button>
      : card ? <>
        <p className="status">{index < steps ? `热身 ${index + 1} / ${steps}` : `作答 ${index - steps + 1} / ${scoredCount}`}</p>
        <div className="panel board" style={{ maxWidth: 220, padding: 18 }}><Glyph shape={card.shape} color={COLORS[card.color]} size={100} /></div>
        {index < steps ? <button className="primary" onClick={() => answer('next')}>记住，下一张</button>
          : <ChoiceButtons options={[{ id: 'same', label: '形状相同' }, { id: 'different', label: '形状不同' }]}
            onChoose={id => answer(id === 'same' ? 'same' : 'different')} />}
      </> : <p role="status">本回合已结束</p>}
  </GameFrame>;
}

export function ShelfManager({ level, seed, onFinish }: GameProps) {
  const task = useMemo(() => makeInventory(level, seed), [level, seed]);
  const { stage, start } = useObservation(task.exposureMs);
  const finish = useFinish(onFinish);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState(() => task.items.map(() => ''));
  const slip = task.slips[index];
  const complete = answers.every(value => value !== '' && Number.isSafeInteger(Number(value)) && Number(value) >= 0);

  function submit() {
    if (!complete) return;
    const correct = task.finalCounts.filter((count, i) => count === Number(answers[i])).length;
    const valid = task.slips.filter(s => s.valid).length;
    finish(correct / task.items.length, { correctItems: correct, items: task.items.length, validSlips: valid, voidSlips: task.slips.length - valid });
  }

  return <GameFrame title="货架管家" instructions="先记住货架上的初始数量。按顺序读单据，有效单据要按入库或出库增减，作废单据直接跳过。最后填写各物品的剩余数量。">
    {stage === 'ready' && <button className="primary" onClick={start}>观察库存（{(task.exposureMs / 1000).toFixed(1)} 秒）</button>}
    {stage === 'observe' && <>
      <p className="status">记住各物品的初始数量</p>
      <div className="game-grid" aria-label="初始库存" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', maxWidth: 380 }}>
        {task.items.map((item, i) => <div className="tile" key={item}><span>{item}<br /><strong>{task.initial[i]} 件</strong></span></div>)}
      </div>
    </>}
    {stage === 'recall' && (slip ? <>
      <p className="status">单据 {index + 1} / {task.slips.length}</p>
      <div className="panel board" aria-label="当前单据" style={{ maxWidth: 300 }}>
        <strong style={{ color: slip.valid ? '#167b68' : '#9c4037' }}>{slip.valid ? '有效单据' : '作废单据'}</strong>
        <div>{task.items[slip.item]} · {slip.delta > 0 ? '入库' : '出库'} {Math.abs(slip.delta)} 件</div>
      </div>
      <button className="primary" onClick={() => setIndex(current => current === index ? current + 1 : current)}>
        {index + 1 < task.slips.length ? '下一张单据' : '开始填写余量'}
      </button>
    </> : <form onSubmit={event => { event.preventDefault(); submit(); }}>
      <p className="status">填写每种物品的余量</p>
      <div className="controls">{task.items.map((item, i) => <label key={item}>{item}<br />
        <input type="number" min={0} step={1} inputMode="numeric" required value={answers[i]}
          onChange={event => {
            const value = event.target.value;
            setAnswers(old => old.map((answer, j) => i === j ? value : answer));
          }} />
      </label>)}</div>
      <button className="primary" disabled={!complete}>提交库存</button>
    </form>)}
  </GameFrame>;
}
