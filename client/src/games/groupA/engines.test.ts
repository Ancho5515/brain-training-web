import { describe, expect, it } from 'vitest';
import { countDots, digitsToRemember, evaluateExpression, exactCardMatch, generateArithmetic, generateCount, generateDigits, generateLocations, generatePairs, generatePath, generateRhythm, generateRotation, generateSchulte, generateSearch, generateSequence, generateStroop, generateSwitch, generateTracking, normalizeCells, pathAccuracy, rhythmAccuracy, rotationEquivalent, setAccuracy, trackingPosition } from './engines';

describe('group A special rules', () => {
  it('counts circles while excluding triangles and squares', () => {
    expect(countDots([{shape:0},{shape:1},{shape:0},{shape:2}])).toBe(2);
  });
  it('requires the exact order for paths but an unordered set for locations', () => {
    expect(pathAccuracy([2,5,1],[1,5,2])).toBeCloseTo(1/3);
    expect(pathAccuracy([2,5,1],[2,5,1])).toBe(1);
    expect(setAccuracy([2,5,1],[1,2,5]).accuracy).toBe(1);
    expect(setAccuracy([2,5,1],[1,2,5,8]).falsePositives).toBe(1);
    expect(setAccuracy([2,5,1],[1,1,2,5]).accuracy).toBe(1);
  });
  it('filters only underlined digits in the original row-major order', () => {
    expect(digitsToRemember([{value:'8',underlined:true},{value:'X',underlined:true},{value:'4',underlined:false},{value:'1',underlined:true}])).toBe('81');
  });
  it('checks shape, texture and orientation in card matching', () => {
    const a={shape:6,striped:false,rotation:90};
    expect(exactCardMatch(a,{...a})).toBe(true);
    expect(exactCardMatch(a,{...a,striped:true})).toBe(false);
    expect(exactCardMatch(a,{...a,rotation:270})).toBe(false);
    expect(exactCardMatch(a,{...a,shape:1})).toBe(false);
  });
  it('accepts rotations and rejects a reflection of an asymmetric shape', () => {
    const shape:[[number,number],[number,number],[number,number],[number,number]]=[[0,0],[0,1],[0,2],[1,2]];
    expect(rotationEquivalent(shape,shape.map(([x,y])=>[-y,x]))).toBe(true);
    expect(rotationEquivalent(shape,shape.map(([x,y])=>[-x,y]))).toBe(false);
    expect(normalizeCells([[3,4],[3,5]])).toEqual([[0,0],[0,1]]);
  });
  it('evaluates precedence, parentheses and signed arithmetic without a chain accumulator', () => {
    expect(evaluateExpression('2 + 3 × 4')).toBe(14);
    expect(evaluateExpression('(2 + 3) × 4')).toBe(20);
    expect(evaluateExpression('18 ÷ (2 + 1) − 9')).toBe(-3);
    expect(evaluateExpression('-2 + 3 * (4 - 1)')).toBe(7);
    expect(()=>evaluateExpression('2 + nope')).toThrow();
  });
  it('compares recalled rhythm gaps and penalizes extra or missing taps', () => {
    expect(rhythmAccuracy([500,800],[500,800])).toBe(1);
    expect(rhythmAccuracy([500,800],[800,500])).toBeLessThan(0.7);
    expect(rhythmAccuracy([500,800],[500])).toBeLessThan(1);
    expect(rhythmAccuracy([500,800],[500,800,500])).toBeLessThan(1);
  });
  it('moves tracking balls according to time and reflects inside the field', () => {
    const ball={id:0,x:20,y:20,vx:80,vy:0};
    expect(trackingPosition(ball,0)).toEqual({x:20,y:20});
    expect(trackingPosition(ball,1).x).toBeGreaterThan(20);
    for (const t of [0,0.2,1,2,30]) {
      const p=trackingPosition(ball,t);
      expect(p.x).toBeGreaterThanOrEqual(7);expect(p.x).toBeLessThanOrEqual(93);
      expect(p.y).toBeGreaterThanOrEqual(9);expect(p.y).toBeLessThanOrEqual(91);
    }
  });
});

describe('group A seeded generation at all 30 levels', () => {
  it.each([
    ['sequence', generateSequence], ['Stroop', generateStroop], ['rotation', generateRotation], ['search', generateSearch], ['switching', generateSwitch],
  ])('changes the actual task parameters on every %s level', (_name, generate) => {
    for(let level=2;level<=30;level++) expect(generate(level,43)).not.toEqual(generate(level-1,43));
  });
  it('keeps all thirty Schulte numbers in uneven cells and shortens the search window', () => {
    for(let level=1;level<=30;level++) {
      const table=generateSchulte(level,42);
      expect(table.cells.map(c=>c.number).sort((a,b)=>a-b)).toEqual(Array.from({length:30},(_,i)=>i+1));
      expect(new Set(table.cells.map(c=>c.span)).size).toBeGreaterThan(1);
    }
    expect(generateSchulte(30,42).timeMs).toBeLessThan(generateSchulte(1,42).timeMs);
  });
  it('generates bounded, deterministic tasks with real targets and distractors', () => {
    for (let level=1;level<=30;level++) for (const seed of [1,42,991]) {
      const dots=generateCount(level,seed);
      expect(dots).toEqual(generateCount(level,seed));
      expect(countDots(dots.items)).toBe(dots.answer);
      expect(dots.answer).toBeGreaterThan(0);
      expect(dots.items.some(x=>x.shape!==0)).toBe(true);
      const track=generateTracking(level,seed);
      expect(track.balls.length).toBeGreaterThanOrEqual(3);
      expect(track.balls.some(b=>b.id===track.target)).toBe(true);
      const sequence=generateSequence(level,seed);
      expect(sequence.answer).toBe(sequence.period[sequence.items.length%sequence.period.length]);
      expect(new Set(sequence.options).size).toBe(sequence.options.length);
      const stroop=generateStroop(level,seed);
      expect(stroop.options).toContain(stroop.ink);
      expect(stroop.sides.length).toBeGreaterThanOrEqual(2);
      const path=generatePath(level,seed);
      expect(path.frames.filter(f=>f.solid).map(f=>f.cell)).toEqual(path.targets);
      expect(path.frames.some(f=>!f.solid)).toBe(true);
      expect(path.targets.length).toBeGreaterThanOrEqual(3);
      const digits=generateDigits(level,seed);
      expect(digitsToRemember(digits.cells)).toBe(digits.answer);
      expect(digits.answer.length).toBeGreaterThanOrEqual(3);
      const locations=generateLocations(level,seed);
      expect(locations.cells.flatMap((c,i)=>c==='solid'?[i]:[])).toEqual(locations.targets);
      expect(locations.cells).toContain('striped');
      const pairs=generatePairs(level,seed);
      expect(pairs.cards.length).toBe(pairs.pairCount*2);
      for(const c of pairs.cards) expect(pairs.cards.filter(d=>exactCardMatch(c,d))).toHaveLength(2);
      const rotation=generateRotation(level,seed);
      expect(rotationEquivalent(rotation.left,rotation.right)).toBe(rotation.same);
      const search=generateSearch(level,seed);
      expect(search.items.flatMap((c,i)=>exactCardMatch(c,search.target)?[i]:[])).toEqual(search.targets);
      expect(search.targets.length).toBeGreaterThan(0);
      expect(search.targets.length).toBeLessThan(search.items.length);
      const rhythm=generateRhythm(level,seed);
      expect(rhythm.gaps.length).toBeGreaterThanOrEqual(2);
      expect(rhythm.gaps.every(g=>g>=300)).toBe(true);
      const arithmetic=generateArithmetic(level,seed);
      expect(evaluateExpression(arithmetic.expression)).toBe(arithmetic.answer);
      expect(Number.isInteger(arithmetic.answer)).toBe(true);
      const switching=generateSwitch(level,seed);
      expect(switching.some((t,i)=>i>0&&t.rule!==switching[i-1].rule)).toBe(true);
      expect(switching.every(t=>t.options.includes(t.rule==='color'?t.color:t.shape))).toBe(true);
    }
  });
  it('increases the load between low and high levels', () => {
    expect(generateCount(30,5).items.length).toBeGreaterThan(generateCount(1,5).items.length);
    expect(generateTracking(30,5).travelMs).toBeGreaterThan(generateTracking(1,5).travelMs);
    expect(generatePath(30,5).targets.length).toBeGreaterThan(generatePath(1,5).targets.length);
    expect(generateDigits(30,5).answer.length).toBeGreaterThan(generateDigits(1,5).answer.length);
    expect(generateLocations(30,5).targets.length).toBeGreaterThan(generateLocations(1,5).targets.length);
    expect(generatePairs(30,5).pairCount).toBeGreaterThan(generatePairs(1,5).pairCount);
    expect(generateSearch(30,5).items.length).toBeGreaterThan(generateSearch(1,5).items.length);
    expect(generateRhythm(30,5).gaps.length).toBeGreaterThan(generateRhythm(1,5).gaps.length);
  });
});
