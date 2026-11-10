import { useEffect, useMemo, useRef, useState } from 'react';
import { ChoiceButtons, COLORS, GameFrame, Glyph, makeResult, randInt, seeded, shuffle, useElapsed } from '../shared';
import type { GameProps, GameResult } from '../types';

function useAttentionRound(onFinish: GameProps['onFinish']) {
  const elapsed = useElapsed();
  const submitted = useRef(false);
  const [done, setDone] = useState(false);

  function finish(accuracy: number, metrics: GameResult['metrics'], durationMs = elapsed()) {
    if (submitted.current) return;
    submitted.current = true;
    setDone(true);
    onFinish(makeResult(accuracy, durationMs, metrics));
  }

  return { done, finish, elapsed };
}

export function makeChangeScene(level: number, seed: number) {
  const rng = seeded(seed);
  const columns = level >= 16 ? 4 : 3;
  const rows = 2 + Number(level >= 11) + Number(level >= 23);
  const objects = Array.from({ length: rows * columns }, () => ({
    shape: randInt(rng, 0, 5),
    color: randInt(rng, 0, COLORS.length - 1),
    striped: level >= 21 && rng() < 0.25,
  }));
  const changedSlots = shuffle(objects.map((_, index) => index), rng).slice(0, 1 + Math.floor((level - 1) / 9));
  const otherObjects = objects.map((object, index) => {
    if (!changedSlots.includes(index)) return object;
    if (level >= 21 && rng() < 0.5) return { ...object, striped: !object.striped };
    return {
      ...object,
      shape: (object.shape + randInt(rng, 1, 5)) % 6,
      color: level < 10 ? (object.color + randInt(rng, 1, COLORS.length - 1)) % COLORS.length : object.color,
    };
  });
  const slope = randInt(rng, 20, 70);
  return {
    columns,
    changedSlots,
    exposureMs: 1360 - (level - 1) * 21,
    blankMs: 100 + (level - 1) * 3,
    scenes: [
      { objects, decoration: `repeating-linear-gradient(${slope}deg, #f6f9f3 0 12px, #d8e8dd 12px 14px)` },
      { objects: otherObjects, decoration: `repeating-linear-gradient(${slope + 90}deg, #fbf8f0 0 12px, #e9e1cc 12px 14px)` },
    ] as const,
  };
}

export function scoreChangeSelection(changedSlots: readonly number[], selected: ReadonlySet<number>) {
  const hits = changedSlots.filter(slot => selected.has(slot)).length;
  const falseSelections = selected.size - hits;
  return { hits, falseSelections, accuracy: hits / (changedSlots.length + falseSelections) };
}

export function ChangeDetective({ level, seed, onFinish }: GameProps) {
  const question = useMemo(() => makeChangeScene(level, seed), [level, seed]);
  const { done, finish } = useAttentionRound(onFinish);
  const [phase, setPhase] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const scene = phase % 2 === 0 ? question.scenes[phase / 2] : undefined;

  useEffect(() => {
    if (done) return;
    const timer = setTimeout(() => setPhase((phase + 1) % 4), scene ? question.exposureMs : question.blankMs);
    return () => clearTimeout(timer);
  }, [phase, scene, done, question]);

  function toggle(position: number) {
    setSelected(current => {
      const next = new Set(current);
      if (next.has(position)) next.delete(position);
      else next.add(position);
      return next;
    });
  }

  function submit() {
    if (selected.size === 0) return;
    const { hits, falseSelections, accuracy } = scoreChangeSelection(question.changedSlots, selected);
    finish(accuracy, { '发现变化': hits, '变化总数': question.changedSlots.length, '误选': falseSelections });
  }

  return <GameFrame title="变化侦探" instructions="两幅场景会交替出现。选中物品发生变化的位置，忽略背景花纹，选完一起提交。"
    footer={<><span className="muted" role="status">已选 {selected.size} 处</span>{' '}<button className="primary" disabled={done || selected.size === 0} onClick={submit}>提交发现</button></>}>
    <div className="game-grid" aria-label="对比场景" style={{
      gridTemplateColumns: `repeat(${question.columns}, minmax(0, 1fr))`,
      maxWidth: 410, padding: 12, borderRadius: 16, backgroundColor: '#f6f9f3', backgroundImage: scene?.decoration,
    }}>
      {question.scenes[0].objects.map((_, index) => {
        const object = scene?.objects[index];
        return <button className={`tile${selected.has(index) ? ' selected' : ''}`} key={index}
          aria-label={`位置 ${index + 1}`} aria-pressed={selected.has(index)} disabled={done} onClick={() => toggle(index)}
          style={{ height: 58, minWidth: 0, padding: 4 }}>
          {object && <Glyph shape={object.shape} color={COLORS[object.color]} striped={object.striped} size={46} />}
        </button>;
      })}
    </div>
  </GameFrame>;
}

type FlashFrame = { shape: number; target: boolean };
const flashShapes = [0, 1, 2, 3, 4, 5, 6];

export function makeFlashStream(level: number, seed: number) {
  const rng = seeded(seed);
  const options = shuffle(flashShapes, rng).slice(0, 3 + Math.floor((level - 1) / 7));
  const [firstShape, secondShape] = shuffle(options, rng);
  const length = 8 + Math.floor((level - 1) / 5);
  const spacing = 4 - Math.floor((level - 1) / 9);
  const firstIndex = randInt(rng, 1, length - spacing - 2);
  const distractors = level >= 10 ? flashShapes : flashShapes.filter(shape => shape !== firstShape && shape !== secondShape);
  const frames: FlashFrame[] = [];
  for (let index = 0; index < length; index++) {
    if (index === firstIndex) frames.push({ shape: firstShape, target: true });
    else if (index === firstIndex + spacing) frames.push({ shape: secondShape, target: true });
    else {
      const choices = distractors.filter(shape => shape !== frames[index - 1]?.shape);
      frames.push({ shape: choices[randInt(rng, 0, choices.length - 1)], target: false });
    }
  }
  return { options, frames, exposureMs: 760 - (level - 1) * 16 };
}

export function scoreFlashAnswers(frames: readonly FlashFrame[], answers: readonly number[]) {
  const targets = frames.filter(frame => frame.target);
  const firstCorrect = answers[0] === targets[0].shape;
  const secondCorrect = answers[1] === targets[1].shape;
  return { firstCorrect, secondCorrect, accuracy: (Number(firstCorrect) + Number(secondCorrect)) / 2 };
}

export function DoubleFlash({ level, seed, onFinish }: GameProps) {
  const question = useMemo(() => makeFlashStream(level, seed), [level, seed]);
  const { done, finish } = useAttentionRound(onFinish);
  const [position, setPosition] = useState(-1);
  const [answers, setAnswers] = useState<number[]>([]);
  const frame = question.frames[position];

  useEffect(() => {
    if (!frame || done) return;
    const timer = setTimeout(() => setPosition(position + 1), question.exposureMs);
    return () => clearTimeout(timer);
  }, [position, frame, done, question.exposureMs]);

  function submit() {
    if (answers.length !== 2) return;
    const { firstCorrect, secondCorrect, accuracy } = scoreFlashAnswers(question.frames, answers);
    finish(accuracy, { '首个目标正确': firstCorrect, '第二个目标正确': secondCorrect, '顺序正确': firstCorrect && secondCorrect });
  }

  return <GameFrame title="双闪捕捉" instructions="记住实线框里的两个图案，忽略虚线框。闪现结束后，按出现顺序选择并提交。">
    {position < 0 ? <button className="primary" onClick={() => setPosition(0)}>开始观察</button> : frame ?
      <div role="group" aria-label={frame.target ? '实线框' : '虚线框'} style={{
        display: 'grid', placeItems: 'center', width: 116, height: 116, margin: '16px auto', borderRadius: 14,
        background: '#f4f8f2', border: `3px ${frame.target ? 'solid' : 'dashed'} #476c5a`,
      }}><Glyph shape={frame.shape} size={76} /></div> : <>
        <p className="status" role="status">{['先选第一个图案', '再选第二个图案', '核对顺序后提交'][answers.length]}</p>
        <div className="controls" aria-label="所选图案">
          {[0, 1].map(index => <div className="tile" key={index} style={{ width: 76, height: 55 }}>
            {answers[index] === undefined ? (index === 0 ? '先出现' : '后出现') : <Glyph shape={answers[index]} size={39} />}
          </div>)}
        </div>
        <ChoiceButtons options={question.options.map(shape => ({ id: String(shape), label: <Glyph shape={shape} size={44} /> }))}
          disabled={done || answers.length === 2} onChoose={id => setAnswers(current => current.length < 2 ? [...current, Number(id)] : current)} />
        <div className="actions">
          <button className="secondary" disabled={done || answers.length === 0} onClick={() => setAnswers(current => current.slice(0, -1))}>撤回上一个</button>
          <button className="primary" disabled={done || answers.length !== 2} onClick={submit} style={{ margin: 0 }}>提交顺序</button>
        </div>
      </>}
  </GameFrame>;
}

const turns = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
const directionLabels = ['向右 →', '向下 ↓', '向左 ←', '向上 ↑'];

export function makeArrowPuzzle(level: number, seed: number) {
  const rng = seeded(seed);
  const direction = randInt(rng, 0, turns.length - 1);
  const baseLocalDirection = randInt(rng, 0, turns.length - 1);
  const [cos, sin] = turns[direction];
  const colors = shuffle(COLORS, rng).slice(0, 2 + Math.floor((level - 1) / 7));
  const half = 3 + Math.floor((level - 1) / 9);
  const shaftHalf = Math.floor(half / 3);
  const cells = [];
  for (let row = -half; row <= half; row++) {
    const offset = Math.abs(row);
    for (let col = -half; col <= half - offset; col++) {
      if (col < 0 && offset > shaftHalf) continue;
      const localDirection = rng() < 0.36 + (level - 1) * 0.02 ? randInt(rng, 0, 3) : baseLocalDirection;
      cells.push({
        col: half + col * cos - row * sin,
        row: half + col * sin + row * cos,
        color: colors[randInt(rng, 0, colors.length - 1)],
        rotation: localDirection * 90,
      });
    }
  }
  return { direction, cells, size: half * 2 + 1, displayWidth: 330 - (level - 1) * 2 };
}

export function BigArrow({ level, seed, onFinish }: GameProps) {
  const { direction, cells, size, displayWidth } = useMemo(() => makeArrowPuzzle(level, seed), [level, seed]);
  const { done, finish, elapsed } = useAttentionRound(onFinish);
  const canvas = size * 12;
  return <GameFrame title="大小迷局" instructions="看小箭头排列出的整体轮廓，选出大箭头的朝向。忽略小箭头本身的方向和颜色。">
    <svg role="img" aria-label="小箭头排成的图案" width={displayWidth} viewBox={`0 0 ${canvas} ${canvas}`}>
      {cells.map(cell => <path key={`${cell.col}/${cell.row}`} fill={cell.color} d="M-5 -1.8H0V-4.5L5 0 0 4.5V1.8H-5Z"
        transform={`translate(${cell.col * 12 + 6} ${cell.row * 12 + 6}) rotate(${cell.rotation})`} />)}
    </svg>
    <ChoiceButtons options={directionLabels.map((label, index) => ({
      id: String(index),
      label: <span role="img" aria-label={label} style={{ fontSize: 24, lineHeight: 1 }}>{label.slice(-1)}</span>,
    }))} disabled={done}
      onChoose={id => {
        const correct = Number(id) === direction;
        const durationMs = elapsed();
        const metrics: GameResult['metrics'] = { '整体方向正确': correct };
        if (correct) metrics['正确反应时毫秒'] = durationMs;
        finish(Number(correct), metrics, durationMs);
      }} />
  </GameFrame>;
}
