import { describe, expect, it } from 'vitest';
import { evaluateCircle, evaluateTrackingSample, unfoldHoles, foldNet, cubeView, validatePassword, validateBudget, moveHanoi, shortestHanoi, routeStep, optimalRouteCost, generateRoute, generatePassword, generateBudget, generateLogic, checkLogic } from './engines';
import { seeded } from '../shared';

describe('fixed-center circle validity', () => {
 const arc=(radius:number,turns=1)=>Array.from({length:181},(_,i)=>({x:200+radius*Math.cos(i/180*Math.PI*2*turns),y:180+radius*Math.sin(i/180*Math.PI*2*turns)}));
 it('rewards a full sufficiently large circle around the solid center',()=>expect(evaluateCircle(arc(100),{x:200,y:180},360).score).toBeGreaterThan(95));
 it('rejects tiny circles, partial arcs and circles around a false center',()=>{expect(evaluateCircle(arc(25),{x:200,y:180},360).valid).toBe(false);expect(evaluateCircle(arc(100,.25),{x:200,y:180},360).valid).toBe(false);expect(evaluateCircle(arc(100),{x:30,y:30},360).valid).toBe(false);});
});
describe('paper reflections and physical cube folding',()=>{
 it('reverses each fold, including multiple folds on the same axis',()=>{const p=unfoldHoles([{x:.125,y:.25}],[{axis:'x',line:.5,toward:'low'},{axis:'x',line:.25,toward:'low'},{axis:'y',line:.5,toward:'low'}]);expect(p).toHaveLength(8);expect(p.some(q=>q.x===.875&&q.y===.75)).toBe(true);});
 it('folds six faces to six outward normals and preserves arrow orientation',()=>{const net=[{id:0,x:1,y:0,arrow:0},{id:1,x:0,y:1,arrow:1},{id:2,x:1,y:1,arrow:0},{id:3,x:2,y:1,arrow:2},{id:4,x:1,y:2,arrow:3},{id:5,x:1,y:3,arrow:1}];const f=foldNet(net);expect(new Set(f.map(v=>v.n.join(','))).size).toBe(6);const v=cubeView(f,[1,0,0],[0,1,0],[0,0,1]);expect(v.front.id).toBe(2);expect(v.front.arrow).toBe(0);expect(v.right.id).toBe(3);expect(v.right.arrow).toBe(2);expect(v.top.id).toBe(0);expect(v.top.arrow).toBe(0);});
});
describe('accept every satisfying password and procurement solution',()=>{
 it('accepts different legal password permutations and rejects a broken constraint',()=>{const p={cols:2,sum:10,evenCount:2,rowOrder:true};expect(validatePassword([1,2,3,4],p).every(Boolean)).toBe(true);expect(validatePassword([2,1,4,3],p).every(Boolean)).toBe(true);expect(validatePassword([1,1,4,4],p).every(Boolean)).toBe(false);});
 it('accepts quantities above one and multiple valid purchases',()=>{const p={prices:[5,10,15],minimumTotal:6,minimumFirst:1,minimumGroup:2,minimumSpend:0};expect(validateBudget([2,2,2],p).every(Boolean)).toBe(true);expect(validateBudget([3,2,2],p).every(Boolean)).toBe(true);expect(validateBudget([10,10,10],p).every(Boolean)).toBe(false);});
 it('generates feasible constraints and unique relational assignments at all 30 levels',()=>{for(let level=1;level<=30;level++){const rng=seeded(level*923);const p=generatePassword(level,rng);expect(validatePassword(p.witness,p).every(Boolean)).toBe(true);const b=generateBudget(level,rng);expect(validateBudget(b.witness,b).every(Boolean)).toBe(true);const logic=generateLogic(level,rng);expect(checkLogic(logic.items,logic.colors,logic).every(Boolean)).toBe(true);expect(new Set(logic.items).size).toBe(logic.n);expect(new Set(logic.colors).size).toBe(logic.n);}});
});
describe('directed weighted route with ordered checkpoints',()=>{
 const graph={size:2,costs:[1,8,1,2],edges:[[0,1],[0,2],[2,3],[1,3],[3,2]] as [number,number][],checkpoints:[2],start:0,end:3};
 it('rejects reverse edges and early arrival at a later checkpoint',()=>{expect(routeStep(graph,{node:1,next:0,cost:0},0)).toBeNull();const g={...graph,checkpoints:[1,2]};expect(routeStep(g,{node:0,next:0,cost:0},2)).toBeNull();});
 it('forbids reaching the end before visiting all checkpoints',()=>expect(routeStep(graph,{node:1,next:0,cost:8},3)).toBeNull());
 it('uses destination terrain costs and checkpoint state for the optimum',()=>{expect(optimalRouteCost(graph)).toBe(3);expect(routeStep(graph,{node:0,next:0,cost:0},2)).toEqual({node:2,next:1,cost:1});});
 it('has a finite route at all levels',()=>{for(let l=1;l<=30;l++)expect(Number.isFinite(optimalRouteCost(generateRoute(l,seeded(l))))).toBe(true);});
});
describe('Hanoi legality and arbitrary targets',()=>{
 it('moves only the top disc and prohibits larger on smaller',()=>{expect(moveHanoi([[3,2],[1],[]],0,1)).toBeNull();expect(moveHanoi([[3,2],[1],[]],0,2)).toEqual([[3],[1],[2]]);expect(moveHanoi([[3],[],[2,1]],1,0)).toBeNull();});
 it('finds an arbitrary split target, not just the last peg',()=>expect(shortestHanoi([[3,2,1],[],[]],[[3],[2],[1]])).toBe(2));
});

describe('time-based escort measurement',()=>{
 it('stops all success accumulation when the pointer is released or cancelled',()=>{const path=[{x:0,y:0},{x:100,y:0}],p={x:50,y:0};expect(evaluateTrackingSample(true,p,p,path,20).onTarget).toBe(true);expect(evaluateTrackingSample(false,p,p,path,20).onTarget).toBe(false);expect(evaluateTrackingSample(false,p,p,path,20).onTrack).toBe(false);});
 it('requires both the corridor and the moving solid target',()=>{const path=[{x:0,y:0},{x:100,y:0}],target={x:50,y:0};expect(evaluateTrackingSample(true,{x:0,y:0},target,path,20).onTarget).toBe(false);expect(evaluateTrackingSample(true,{x:50,y:40},target,path,20).onTrack).toBe(false);});
});
