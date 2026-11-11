import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties } from 'react';
import type { GameProps, GameRegistry, GameResult } from './types';
import { ChoiceButtons, COLORS, GameFrame, Glyph, makeResult, useElapsed } from './shared';
import { exactCardMatch, generateArithmetic, generateCount, generateDigits, generateLocations, generatePairs, generatePath, generateRhythm, generateRotation, generateSchulte, generateSearch, generateSequence, generateStroop, generateSwitch, generateTracking, normalizeCells, pathAccuracy, rhythmAccuracy, setAccuracy, trackingPosition, type Card, type Cell } from './groupA/engines';

const colorNames = ['青绿', '珊瑚红', '蓝色', '金黄', '紫色', '草绿'];
const cells = (n: number) => Array.from({ length: n }, (_, i) => i);
const gridStyle = (columns: number, maxWidth = 440): CSSProperties => ({ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(44px, 1fr))`, gap: 7, maxWidth, margin: '20px auto' });
const toggle = (selected: number[], item: number) => selected.includes(item) ? selected.filter(n => n !== item) : [...selected, item];

function useRound({ level, onFinish }: GameProps) {
  const done = useRef(false), callback = useRef(onFinish), elapsed = useElapsed(), elapsedRef = useRef(elapsed);
  callback.current = onFinish;
  const finish = useCallback((accuracy: number, metrics: GameResult['metrics'] = {}) => {
    if (done.current) return;
    done.current = true;
    callback.current(makeResult(accuracy, elapsedRef.current(), { parameterVersion: 'group-a-1', level, ...metrics }));
  }, [level]);
  return finish;
}

/** One animation clock per presentation; timers and frames are removed on unmount. */
function useTimeline(active: boolean, duration: number, onEnd: () => void, resetKey?: number) {
  const [ms, setMs] = useState(0), end = useRef(onEnd);
  end.current = onEnd;
  useEffect(() => {
    if (!active) { setMs(0); return; }
    const start = performance.now();
    let frame = 0, cancelled = false;
    setMs(0);
    function tick() {
      if (cancelled) return;
      const time = Math.min(duration, performance.now() - start);
      setMs(time);
      if (time >= duration) end.current(); else frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [active, duration, resetKey]);
  return ms;
}
function useVisibilityReset(reset: () => void) {
  const callback = useRef(reset); callback.current = reset;
  useEffect(() => {
    const listener = () => { if (document.hidden) callback.current(); };
    document.addEventListener('visibilitychange', listener);
    return () => document.removeEventListener('visibilitychange', listener);
  }, []);
}
function usePresentation(exposureMs: number) {
  const [stage, setStage] = useState<'ready' | 'show' | 'recall'>('ready');
  const [interrupted, setInterrupted] = useState(false);
  useTimeline(stage === 'show', exposureMs, () => setStage('recall'));
  useVisibilityReset(() => { if (stage === 'show') { setStage('ready'); setInterrupted(true); } });
  return { stage, start: () => { setInterrupted(false); setStage('show'); }, interrupted };
}
function Ready({ onStart, text = '开始观察', interrupted = false }: { onStart: () => void; text?: string; interrupted?: boolean }) {
  return <div style={{ padding: '32px 8px' }}><p className="muted">{interrupted ? '刚才的展示被中断，请重新观察本题。' : '准备好后开始，展示结束再作答。'}</p><button className="primary" onClick={onStart}>{text}</button></div>;
}
function NumberAnswer({ label, onSubmit, min, max }: { label: string; onSubmit: (answer: number) => void; min?: number; max?: number }) {
  const [value, setValue] = useState('');
  const answer = Number(value), valid = value.trim() !== '' && Number.isInteger(answer) && (min === undefined || answer >= min) && (max === undefined || answer <= max);
  return <form onSubmit={e => { e.preventDefault(); if (valid) onSubmit(answer); }}><label className="form-label">{label}<input className="field" aria-label={label} type="number" inputMode={min !== undefined && min >= 0 ? 'numeric' : 'decimal'} min={min} max={max} step="1" value={value} onChange={e => setValue(e.target.value)} autoComplete="off" autoFocus /></label>{min === undefined && <button className="secondary" type="button" disabled={!valid || answer === 0} onClick={() => setValue(String(-answer))}>切换正负</button>}<button className="primary" type="submit" disabled={!valid}>提交答案</button></form>;
}
function CardGlyph({ card, size = 45 }: { card: Card; size?: number }) { return <Glyph shape={card.shape} striped={card.striped} rotation={card.rotation} size={size} />; }

const flashColors = ['#90e3bd', '#ffc58b', '#b4c6ff'];

function FlashCount(props: GameProps) {
  const previous = props.previousResult?.metrics?.expectedCount;
  const task = useMemo(() => generateCount(props.level, props.seed, typeof previous === 'number' ? previous : undefined), [props.level, props.seed, previous]);
  const { stage, start, interrupted } = usePresentation(task.exposureMs), finish = useRound(props);
  function submit(answer: number) {
    const absoluteError = Math.abs(answer - task.answer);
    finish(Math.max(0, 1 - absoluteError / task.answer), {
      parameterVersion: 'flash-count-2', expectedCount: task.answer, answerCount: answer, absoluteError, exposureMs: task.exposureMs,
    });
  }
  return <GameFrame title="瞬时记忆" instructions="只记圆点的数量，忽略三角形和方形。图案消失后，再填写你看到的圆点数。">
    <div className="flash-board" role={stage === 'show' ? 'group' : undefined} aria-label={stage === 'show' ? '计数画面' : undefined}>
      {stage === 'ready' ? <div className="flash-ready">
        <div className="flash-rule" aria-hidden="true">
          <span><Glyph shape={0} color={flashColors[0]} size={34} />记数量</span>
          <span><Glyph shape={1} color={flashColors[1]} size={34} /><Glyph shape={2} color={flashColors[2]} size={34} />忽略</span>
        </div>
        {interrupted && <p className="muted">刚才的展示被中断，请重新观察本题。</p>}
        <button className="primary" onClick={start}>开始闪现</button>
      </div> : stage === 'show' ? task.items.map((item, i) => (
        <span className="flash-item" key={i} style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.size}%` }}>
          <Glyph shape={item.shape} color={flashColors[item.color]} />
        </span>
      )) : <NumberAnswer label="刚才有几个圆点？" min={0} max={99} onSubmit={submit} />}
    </div>
  </GameFrame>;
}

function VisualTracking(props: GameProps) {
  const task = useMemo(() => generateTracking(props.level, props.seed), [props.level, props.seed]);
  const [stage, setStage] = useState<'ready' | 'cue' | 'moving' | 'answer'>('ready'), [interrupted, setInterrupted] = useState(false), finish = useRound(props);
  useTimeline(stage === 'cue', task.cueMs, () => setStage('moving'));
  const movingMs = useTimeline(stage === 'moving', task.travelMs, () => setStage('answer'));
  useVisibilityReset(() => { if (stage === 'cue' || stage === 'moving') { setStage('ready'); setInterrupted(true); } });
  const seconds = stage === 'answer' ? task.travelMs / 1000 : stage === 'moving' ? movingMs / 1000 : 0;
  return <GameFrame title="视觉追踪" instructions="认准最初的红球。所有球变成蓝色后会运动；停下后，点出最初的红球。">
    {stage === 'ready' ? <Ready onStart={() => { setInterrupted(false); setStage('cue'); }} text="开始追踪" interrupted={interrupted} /> : <><p className="status" aria-live="polite">{stage === 'cue' ? '认准红球' : stage === 'moving' ? '保持追踪，暂时不能选择' : '运动停止，请选择'}</p><div aria-label="追踪场地" style={{ position: 'relative', width: '100%', maxWidth: 610, height: 300, margin: 'auto', border: '1px solid #d7e2d1', borderRadius: 18, background: '#f4f7f2' }}>{task.balls.map(ball => { const p = trackingPosition(ball, seconds); return <button key={ball.id} aria-label={`球 ${ball.id + 1}`} disabled={stage !== 'answer'} onClick={() => { if (stage === 'answer') finish(ball.id === task.target ? 1 : 0, { targetId: task.target, chosenId: ball.id, ballCount: task.balls.length, motionMs: task.travelMs }); }} style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -50%)', width: 44, height: 44, minHeight: 44, padding: 0, border: '2px solid white', borderRadius: '50%', background: stage === 'cue' && ball.id === task.target ? '#d94e42' : '#337bc0', opacity: 1, boxShadow: '0 2px 6px #203c3420', color: 'white' }}>{stage === 'answer' ? ball.id + 1 : ''}</button>; })}</div></>}
  </GameFrame>;
}

function Schulte(props: GameProps) {
  const task = useMemo(() => generateSchulte(props.level, props.seed), [props.level, props.seed]);
  const [stage, setStage] = useState<'ready' | 'search' | 'answer'>('ready'), [interrupted, setInterrupted] = useState(false), finish = useRound(props);
  const ms = useTimeline(stage === 'search', task.timeMs, () => setStage('answer'));
  useVisibilityReset(() => { if (stage === 'search') { setStage('ready'); setInterrupted(true); } });
  return <GameFrame title="舒尔特方格" instructions="在不等大的格子里，用眼睛依次寻找 1 到 30，无需点击。时间结束后如实填入最后找到的数；没有找到 1 就填 0。">
    {stage === 'ready' ? <Ready onStart={() => { setInterrupted(false); setStage('search'); }} text={`开始寻找（${Math.round(task.timeMs / 1000)} 秒）`} interrupted={interrupted} /> : stage === 'search' ? <><p className="status">剩余 {Math.ceil((task.timeMs - ms) / 1000)} 秒</p><div className="game-grid" aria-label="不规则数字表" style={{ display: 'grid', gridTemplateColumns: 'repeat(12,minmax(0,1fr))', gridAutoFlow: 'dense', maxWidth: 560, gap: 5, margin: 'auto' }}>{task.cells.map(item => <div className="tile" key={item.number} style={{ gridColumn: `span ${item.span}`, minHeight: 44, padding: 3, fontSize: '1.25rem', fontWeight: 650 }}>{item.number}</div>)}</div></> : <NumberAnswer label="最后找到的数字（0–30，自报）" min={0} max={30} onSubmit={answer => finish(answer / 30, { lastFound: answer, totalNumbers: 30, selfReported: true, searchWindowMs: task.timeMs })} />}
  </GameFrame>;
}

function ShapeSequence(props: GameProps) {
  const task = useMemo(() => generateSequence(props.level, props.seed), [props.level, props.seed]), finish = useRound(props);
  return <GameFrame title="图形序列" instructions="只观察形状的重复规律，忽略颜色与大小。下一个应当是什么形状？">
    <div aria-label="形状序列" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: 5, margin: '25px auto' }}>{task.items.map((item, i) => <div className="tile" key={i} style={{ width: 58, height: 62, padding: 0 }}><Glyph shape={item.shape} color={COLORS[item.color]} size={item.size} /></div>)}<div className="tile" style={{ width: 58, height: 62, fontSize: 32 }}>?</div></div>
    <ChoiceButtons options={task.options.map(shape => ({ id: String(shape), label: <Glyph shape={shape} color="#425b4b" /> }))} onChoose={answer => finish(Number(answer) === task.answer ? 1 : 0, { correctShape: task.answer, chosenShape: Number(answer), periodLength: task.period.length, shownItems: task.items.length })} />
  </GameFrame>;
}

function Stroop(props: GameProps) {
  const task = useMemo(() => generateStroop(props.level, props.seed), [props.level, props.seed]), finish = useRound(props);
  return <GameFrame title="颜色干扰" instructions="选择中央框内文字的墨水颜色。不要读字义，也不要看两侧的干扰词。">
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', alignItems: 'center', gap: 5, margin: '25px auto', maxWidth: 620 }}><div aria-label="左侧干扰词">{task.sides.slice(0, task.sides.length / 2).map((word, i) => <p key={i} style={{ color: COLORS[(word + 2) % 6], fontSize: task.sideFontSize }}>{colorNames[word]}</p>)}</div><div style={{ border: '3px solid #526753', padding: '22px 6px', borderRadius: 12 }}><span className="muted">中央</span><strong aria-label="中央色词" style={{ display: 'block', fontSize: 'clamp(26px,5vw,44px)', color: COLORS[task.ink], lineHeight: 1.8 }}>{colorNames[task.word]}</strong></div><div aria-label="右侧干扰词">{task.sides.slice(task.sides.length / 2).map((word, i) => <p key={i} style={{ color: COLORS[(word + 3) % 6], fontSize: task.sideFontSize }}>{colorNames[word]}</p>)}</div></div>
    <ChoiceButtons options={task.options.map(color => ({ id: String(color), label: <><span aria-hidden="true" style={{ display: 'inline-block', width: 22, height: 22, borderRadius: '50%', background: COLORS[color], verticalAlign: 'middle', marginRight: 6 }} />{colorNames[color]}</> }))} onChoose={answer => finish(Number(answer) === task.ink ? 1 : 0, { inkColor: task.ink, wordMeaning: task.word, chosenColor: Number(answer), incongruent: task.word !== task.ink, distractorWords: task.sides.length })} />
  </GameFrame>;
}

function PathMemory(props: GameProps) {
  const task = useMemo(() => generatePath(props.level, props.seed), [props.level, props.seed]);
  const [stage, setStage] = useState<'ready' | 'show' | 'recall'>('ready'), [answers, setAnswers] = useState<number[]>([]), [interrupted, setInterrupted] = useState(false), finish = useRound(props);
  const ms = useTimeline(stage === 'show', task.frames.length * task.stepMs, () => setStage('recall'));
  useVisibilityReset(() => { if (stage === 'show') { setStage('ready'); setInterrupted(true); } });
  const frame = task.frames[Math.floor(ms / task.stepMs)], visible = ms % task.stepMs < task.stepMs * 0.74;
  return <GameFrame title="路径记忆" instructions="按顺序记住实心圆标记出现的格子，跳过空心圆。展示结束后，再按原顺序点击格子并提交。">
    {stage === 'ready' ? <Ready onStart={() => { setInterrupted(false); setAnswers([]); setStage('show'); }} interrupted={interrupted} /> : <><p className="status">{stage === 'show' ? '观察中：实心记住，空心跳过' : `回忆顺序：已输入 ${answers.length} / ${task.targets.length}`}</p><div className="game-grid" aria-label={stage === 'show' ? '路径展示' : '路径作答'} style={gridStyle(task.side, 400)}>{cells(task.side * task.side).map(i => stage === 'show' ? <div className="tile" key={i} style={{ aspectRatio: '1', minHeight: 48 }}>{visible && frame?.cell === i && <Glyph shape={0} outline={!frame.solid} size={42} />}</div> : <button className={`tile ${answers.includes(i) ? 'selected' : ''}`} key={i} aria-label={`位置 ${i + 1}`} style={{ aspectRatio: '1', minHeight: 48 }} onClick={() => setAnswers(old => old.length < task.targets.length && !old.includes(i) ? [...old, i] : old)}>{answers.includes(i) ? answers.indexOf(i) + 1 : ''}</button>)}</div>{stage === 'recall' && <div className="controls"><button className="secondary" onClick={() => setAnswers(old => old.slice(0, -1))} disabled={!answers.length}>撤销一步</button><button className="primary" disabled={!answers.length} onClick={() => finish(pathAccuracy(task.targets, answers), { expectedLength: task.targets.length, enteredLength: answers.length, exactSequence: pathAccuracy(task.targets, answers) === 1, distractors: task.frames.filter(f => !f.solid).length, enteredSequence: answers.join(',') })}>提交路径</button></div>}</>}
  </GameFrame>;
}

function DigitMemory(props: GameProps) {
  const task = useMemo(() => generateDigits(props.level, props.seed), [props.level, props.seed]);
  const { stage, start, interrupted } = usePresentation(task.exposureMs), finish = useRound(props), [value, setValue] = useState('');
  const answer = value.replace(/\s/g, '');
  return <GameFrame title="数字闪记" instructions="只记带下划线的数字，忽略其他字符。按从左到右、从上到下的行优先顺序记忆，消失后输入；保留开头的 0。">
    {stage === 'ready' ? <Ready onStart={start} interrupted={interrupted} /> : stage === 'show' ? <div className="game-grid" aria-label="字符记忆画面" style={gridStyle(task.cols, 420)}>{task.cells.map((c, i) => <div className="tile" key={i} style={{ height: 66, fontSize: 30, fontWeight: 650 }}><span style={{ textDecoration: c.underlined ? 'underline' : 'none', textDecorationThickness: 3, textUnderlineOffset: 7 }}>{c.value}</span></div>)}</div> : <form onSubmit={e => { e.preventDefault(); if (!/^\d+$/.test(answer)) return; const correct = [...task.answer].filter((n, i) => answer[i] === n).length; finish(correct / Math.max(answer.length, task.answer.length), { expectedLength: task.answer.length, enteredLength: answer.length, correctPositions: correct, exactSequence: task.answer === answer, enteredDigits: answer, exposureMs: task.exposureMs }); }}><label className="form-label">按行顺序输入数字<input className="field" aria-label="按行顺序输入数字" type="text" inputMode="numeric" autoComplete="off" maxLength={30} value={value} onChange={e => setValue(e.target.value)} autoFocus /></label><button className="primary" disabled={!/^\d+$/.test(answer)}>提交数字</button></form>}
  </GameFrame>;
}

function LocationMemory(props: GameProps) {
  const task = useMemo(() => generateLocations(props.level, props.seed), [props.level, props.seed]);
  const { stage, start, interrupted } = usePresentation(task.exposureMs), finish = useRound(props), [selected, setSelected] = useState<number[]>([]);
  return <GameFrame title="位置复原" instructions="记住实心亮格，忽略条纹格。画面隐藏后选出全部实心格的位置，一次提交，不要求顺序。">
    {stage === 'ready' ? <Ready onStart={start} interrupted={interrupted} /> : <><p className="status">{stage === 'show' ? '记住实心，忽略条纹' : `已选 ${selected.length} 格`}</p><div className="game-grid" aria-label={stage === 'show' ? '位置展示' : '位置作答'} style={gridStyle(task.side, 400)}>{task.cells.map((mark, i) => stage === 'show' ? <div className="tile" key={i} style={{ aspectRatio: '1', minHeight: 48 }}><div style={{ width: '72%', height: '72%', minHeight: 30, borderRadius: 5, background: mark === 'solid' ? '#167b68' : mark === 'striped' ? 'repeating-linear-gradient(135deg,#167b68 0 3px,#edf5ee 3px 8px)' : 'transparent' }} /></div> : <button key={i} className={`tile ${selected.includes(i) ? 'selected' : ''}`} aria-label={`位置 ${i + 1}`} aria-pressed={selected.includes(i)} style={{ aspectRatio: '1', minHeight: 48 }} onClick={() => setSelected(old => toggle(old, i))}>{selected.includes(i) ? '●' : ''}</button>)}</div>{stage === 'recall' && <div className="controls"><button className="secondary" onClick={() => setSelected([])} disabled={!selected.length}>清空选择</button><button className="primary" disabled={!selected.length} onClick={() => { const r = setAccuracy(task.targets, selected); finish(r.accuracy, { hits: r.hits, misses: r.misses, falsePositives: r.falsePositives, selectedCount: selected.length, targetCount: task.targets.length, unorderedRecall: true, exposureMs: task.exposureMs }); }}>提交位置</button></div>}</>}
  </GameFrame>;
}

function MatchingPairs(props: GameProps) {
  const task = useMemo(() => generatePairs(props.level, props.seed), [props.level, props.seed]), finish = useRound(props);
  const [stage, setStage] = useState<'ready' | 'playing' | 'expired' | 'complete'>('ready'), [open, setOpen] = useState<number[]>([]), [matched, setMatched] = useState<number[]>([]), [attempts, setAttempts] = useState(0), [interrupted, setInterrupted] = useState(false);
  const openRef = useRef<number[]>([]), matchedRef = useRef<number[]>([]), attemptsRef = useRef(0), flips = useRef(0), closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearClose = () => { if (closeTimer.current !== null) { clearTimeout(closeTimer.current); closeTimer.current = null; } };
  useEffect(() => () => { if (closeTimer.current !== null) clearTimeout(closeTimer.current); }, []);
  const ms = useTimeline(stage === 'playing', task.timeMs, () => { clearClose(); openRef.current = []; setOpen([]); setStage('expired'); });
  useVisibilityReset(() => {
    if (stage !== 'playing') return;
    clearClose(); setStage('ready'); setInterrupted(true); openRef.current = []; matchedRef.current = []; attemptsRef.current = 0; flips.current = 0; setOpen([]); setMatched([]); setAttempts(0);
  });
  const submit = (timeout: boolean) => finish(matchedRef.current.length / task.cards.length, { matchedPairs: matchedRef.current.length / 2, totalPairs: task.pairCount, attempts: attemptsRef.current, cardFlips: flips.current, timedOut: timeout, timeLimitMs: task.timeMs });
  function flip(index: number) {
    if (stage !== 'playing' || matchedRef.current.includes(index) || openRef.current.includes(index) || openRef.current.length >= 2) return;
    flips.current++;
    const next = [...openRef.current, index]; openRef.current = next; setOpen(next);
    if (next.length !== 2) return;
    attemptsRef.current++; setAttempts(attemptsRef.current);
    const match = exactCardMatch(task.cards[next[0]], task.cards[next[1]]);
    if (match) {
      matchedRef.current = [...matchedRef.current, ...next]; setMatched(matchedRef.current);
      if (matchedRef.current.length === task.cards.length) { setStage('complete'); submit(false); return; }
    }
    closeTimer.current = setTimeout(() => { openRef.current = []; setOpen([]); closeTimer.current = null; }, match ? 350 : 850);
  }
  return <GameFrame title="配对翻牌" instructions="每次翻两张。形状、实心或条纹、朝向全部相同才算一对。倒计时结束后按已配对的数量计分。">
    {stage === 'ready' ? <Ready onStart={() => { setInterrupted(false); setStage('playing'); }} interrupted={interrupted} text="开始翻牌" /> : <><p className="status">{stage === 'expired' ? '时间到' : `剩余 ${Math.ceil((task.timeMs - ms) / 1000)} 秒`} · 已配对 {matched.length / 2} / {task.pairCount} · 尝试 {attempts} 次</p><div className="game-grid" aria-label="配对牌面" style={gridStyle(task.cards.length <= 6 ? 3 : task.cards.length <= 12 ? 4 : 5, 470)}>{task.cards.map((card, i) => { const faceUp = matched.includes(i) || (stage === 'playing' && open.includes(i)); return <button key={i} aria-label={`牌 ${i + 1}`} className={`tile ${matched.includes(i) ? 'selected' : ''}`} style={{ height: 68, padding: 3 }} disabled={stage !== 'playing' || matched.includes(i)} onClick={() => flip(i)}>{faceUp ? <CardGlyph card={card} size={48} /> : <span style={{ fontSize: 26, color: '#6f8974' }}>?</span>}</button>; })}</div>{stage === 'expired' && <button className="primary" onClick={() => submit(true)}>提交本轮</button>}</>}
  </GameFrame>;
}

function BlockShape({ points, dimension, label, rotation = 0 }: { points: Cell[]; dimension: number; label: string; rotation?: number }) {
  const normalized = normalizeCells(points), width = Math.max(...normalized.map(c => c[0])) + 1, height = Math.max(...normalized.map(c => c[1])) + 1;
  return <svg role="img" aria-label={label} viewBox={`0 0 ${dimension * 24} ${dimension * 24}`} width="100%" height="210"><g transform={`rotate(${rotation} ${dimension * 12} ${dimension * 12})`}><g transform={`translate(${(dimension - width) * 12} ${(dimension - height) * 12})`}>{normalized.map(([x, y]) => <rect key={`${x}:${y}`} x={x * 24 + 1} y={y * 24 + 1} width="22" height="22" rx="2" fill="#3d8b78" stroke="#155c4e" strokeWidth="1.2" />)}</g></g></svg>;
}
function MentalRotation(props: GameProps) {
  const task = useMemo(() => generateRotation(props.level, props.seed), [props.level, props.seed]), finish = useRound(props);
  const dimension = Math.ceil(1.5 * Math.max(...[task.left, task.right].flatMap(p => { const n = normalizeCells(p); return [Math.max(...n.map(c => c[0])) + 2, Math.max(...n.map(c => c[1])) + 2]; })));
  return <GameFrame title="旋转判断" instructions="右图能否只靠在平面内旋转，与左图完全重合？镜像翻转不算。">
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, maxWidth: 580, margin: 'auto' }}><div><p className="muted">左图</p><BlockShape points={task.left} dimension={dimension} label="左图" /></div><div><p className="muted">右图</p><BlockShape points={task.right} dimension={dimension} label="右图" rotation={task.displayAngle} /></div></div><ChoiceButtons options={[{ id: 'same', label: '可以旋转重合' }, { id: 'different', label: '不能旋转重合' }]} onChoose={answer => finish((answer === 'same') === task.same ? 1 : 0, { isRotationEquivalent: task.same, answeredEquivalent: answer === 'same', blockCount: task.left.length })} />
  </GameFrame>;
}

function TargetSearch(props: GameProps) {
  const task = useMemo(() => generateSearch(props.level, props.seed), [props.level, props.seed]), finish = useRound(props), [selected, setSelected] = useState<number[]>([]);
  return <GameFrame title="目标搜索" instructions="找到所有与顶部目标的形状、纹理、方向都相同的图案。可以多选，再一次提交。">
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 15, border: '2px solid #80aa87', borderRadius: 12, padding: '6px 22px' }}><strong>目标</strong><CardGlyph card={task.target} size={54} /></div><div className="game-grid" aria-label="目标搜索画面" style={gridStyle(task.items.length <= 12 ? 3 : task.items.length <= 20 ? 4 : 5, 500)}>{task.items.map((card, i) => <button key={i} aria-label={`图案 ${i + 1}`} aria-pressed={selected.includes(i)} className={`tile ${selected.includes(i) ? 'selected' : ''}`} style={{ minHeight: 62, padding: 3 }} onClick={() => setSelected(old => toggle(old, i))}><CardGlyph card={card} size={44} /></button>)}</div><p className="muted">已选 {selected.length} 个</p><button className="primary" disabled={!selected.length} onClick={() => { const result = setAccuracy(task.targets, selected); finish(result.accuracy, { targetCount: task.targets.length, hits: result.hits, misses: result.misses, falsePositives: result.falsePositives, itemCount: task.items.length }); }}>提交全部目标</button>
  </GameFrame>;
}

function RhythmRecall(props: GameProps) {
  const task = useMemo(() => generateRhythm(props.level, props.seed), [props.level, props.seed]), finish = useRound(props);
  const [stage, setStage] = useState<'ready' | 'show' | 'recall'>('ready'), [taps, setTaps] = useState<number[]>([]), [interrupted, setInterrupted] = useState(false), tapsRef = useRef<number[]>([]);
  const pulseTimes = useMemo(() => task.gaps.reduce((times, gap) => [...times, times[times.length - 1] + gap], [650]), [task]);
  const ms = useTimeline(stage === 'show', pulseTimes[pulseTimes.length - 1] + 550, () => setStage('recall'));
  useVisibilityReset(() => { if (stage === 'show') { setStage('ready'); setInterrupted(true); } });
  const centralOn = stage === 'show' && pulseTimes.some(t => ms >= t && ms < t + 145);
  function tap() {
    if (stage !== 'recall' || tapsRef.current.length >= task.gaps.length + 3) return;
    const next = [...tapsRef.current, performance.now()]; tapsRef.current = next; setTaps(next);
  }
  function submit() {
    const gaps = tapsRef.current.slice(1).map((time, i) => time - tapsRef.current[i]);
    const error = task.gaps.reduce((sum, gap, i) => sum + Math.abs((gaps[i] ?? 0) - gap), 0) / task.gaps.length;
    finish(rhythmAccuracy(task.gaps, gaps), { expectedTaps: task.gaps.length + 1, actualTaps: tapsRef.current.length, meanGapErrorMs: Math.round(error), expectedGapsMs: task.gaps.join(','), actualGapsMs: gaps.map(Math.round).join(','), intervalScoring: true });
  }
  return <GameFrame title="节奏复刻" instructions="记住中央带边框圆点的闪烁节奏，忽略外围伴奏。展示结束后再敲击，按相邻敲击间隔计分，第一次敲击不需要抢时间。">
    {stage === 'ready' ? <Ready onStart={() => { setInterrupted(false); setStage('show'); }} text="播放节奏" interrupted={interrupted} /> : stage === 'show' ? <><p className="status">只记中央，稍后再敲</p><div aria-label="节奏展示" style={{ position: 'relative', width: '100%', maxWidth: 400, height: 260, margin: 'auto' }}>{cells(8).map(i => { const angle = i * Math.PI / 4, on = (ms + i * 190) % task.distractorGap < 120; return <span key={i} aria-hidden="true" style={{ position: 'absolute', left: `${50 + 38 * Math.cos(angle)}%`, top: `${50 + 36 * Math.sin(angle)}%`, width: 19, height: 19, borderRadius: '50%', transform: 'translate(-50%,-50%)', background: on ? '#d3a257' : '#e9eadd' }} />; })}<div aria-label="中央圆点" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 86, height: 86, padding: 10, border: '3px solid #344f42', borderRadius: 14, display: 'grid', placeItems: 'center' }}><div style={{ width: 55, height: 55, borderRadius: '50%', background: centralOn ? '#168774' : '#edf2e9' }} /></div></div></> : <><p className="status">现在复刻节奏：目标 {task.gaps.length + 1} 次，已敲 {taps.length} 次</p><button className="primary" aria-label="敲击节奏" style={{ width: 190, height: 130, fontSize: 25, borderRadius: 28, touchAction: 'none', userSelect: 'none' }} onPointerDown={e => { e.preventDefault(); tap(); }} onKeyDown={e => { if (!e.repeat && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); tap(); } }}>敲击</button><div className="controls"><button className="secondary" onClick={() => { tapsRef.current = []; setTaps([]); }} disabled={!taps.length}>重新敲击</button><button className="primary" onClick={submit} disabled={taps.length < 2}>提交节奏</button></div></>}
  </GameFrame>;
}

function Arithmetic(props: GameProps) {
  const task = useMemo(() => generateArithmetic(props.level, props.seed), [props.level, props.seed]), finish = useRound(props);
  return <GameFrame title="快速心算" instructions="按算式计算结果：先括号，再乘除，最后加减。结果可能为负数。">
    <p aria-label="心算算式" style={{ margin: '32px auto', fontSize: 'clamp(23px,4vw,36px)', fontWeight: 650, lineHeight: 1.9 }}>{task.expression} = ?</p><NumberAnswer label="计算结果" onSubmit={answer => finish(answer === task.answer ? 1 : 0, { expression: task.expression, correctAnswer: task.answer, enteredAnswer: answer, absoluteError: Math.abs(answer - task.answer), arithmeticPrecedence: true })} />
  </GameFrame>;
}

function RuleSwitching(props: GameProps) {
  const trials = useMemo(() => generateSwitch(props.level, props.seed), [props.level, props.seed]), finish = useRound(props), [index, setIndex] = useState(0);
  const responses = useRef<{ correct: boolean; switched: boolean; rt: number; late:boolean }[]>([]), started = useRef(performance.now()), answered = useRef(-1);
  const trial = trials[index];
  const ms=useTimeline(true,trial.timeLimitMs,()=>{},index);
  function choose(value: string) {
    if (answered.current === index) return;
    answered.current = index;
    const late=performance.now()-started.current>trial.timeLimitMs;
    const correct = !late && Number(value) === (trial.rule === 'color' ? trial.color : trial.shape), switched = index > 0 && trial.rule !== trials[index - 1].rule;
    const result = { correct, switched, late, rt: Math.max(0, performance.now() - started.current) }; responses.current.push(result);
    if (index + 1 < trials.length) { started.current = performance.now(); setIndex(index + 1); return; }
    const all = responses.current, switches = all.filter(r => r.switched), repeats = all.filter((r, i) => i > 0 && !r.switched);
    const mean = (items: typeof all) => items.length ? Math.round(items.reduce((sum, r) => sum + r.rt, 0) / items.length) : 0;
    finish(all.filter(r => r.correct).length / all.length, { trialCount: all.length, lateTrials:all.filter(r=>r.late).length, trialTimeLimitMs:trial.timeLimitMs, correctCount: all.filter(r => r.correct).length, switchTrials: switches.length, switchCorrect: switches.filter(r => r.correct).length, repeatTrials: repeats.length, repeatCorrect: repeats.filter(r => r.correct).length, meanSwitchRtMs: mean(switches), meanRepeatRtMs: mean(repeats) });
  }
  return <GameFrame title="规则切换" instructions="每次先看顶部提示。提示“颜色”就选图案的颜色；提示“形状”就选图案的形状。每次只作答一次，提示会切换。请在时限内选择，超时后仍需作答，该项记为未正确。">
    <p className="muted">第 {index + 1} / {trials.length} 个 · {ms>=trial.timeLimitMs?'本项已超时，请作答继续':`剩余 ${Math.ceil((trial.timeLimitMs-ms)/1000)} 秒`}</p><div role="status" aria-label="当前规则" style={{ display: 'inline-block', padding: '10px 35px', borderRadius: 10, background: trial.rule === 'color' ? '#fff0d2' : '#e4edf8', fontWeight: 750, fontSize: 24 }}>{trial.rule === 'color' ? '颜色' : '形状'}</div><div style={{ margin: '24px auto' }}><Glyph shape={trial.shape} color={COLORS[trial.color]} size={92} /></div><ChoiceButtons key={index} options={trial.options.map(option => ({ id: String(option), label: trial.rule === 'shape' ? <Glyph shape={option} color="#4e5f55" size={44} /> : <><span aria-hidden="true" style={{ display: 'inline-block', width: 20, height: 20, borderRadius: '50%', background: COLORS[option], marginRight: 5, verticalAlign: 'middle' }} />{colorNames[option]}</> }))} onChoose={choose} />
  </GameFrame>;
}

// A change in seed or level always starts a fresh exercise, even when the host reuses a registry entry.
function fresh(Component: ComponentType<GameProps>): ComponentType<GameProps> { return props => <Component key={`${props.level}:${props.seed}`} {...props} />; }
export const groupA: GameRegistry = {
  1: fresh(FlashCount), 2: fresh(VisualTracking), 3: fresh(Schulte), 4: fresh(ShapeSequence), 5: fresh(Stroop), 6: fresh(PathMemory), 7: fresh(DigitMemory), 8: fresh(LocationMemory), 9: fresh(MatchingPairs), 10: fresh(MentalRotation), 11: fresh(TargetSearch), 12: fresh(RhythmRecall), 13: fresh(Arithmetic), 14: fresh(RuleSwitching),
};
