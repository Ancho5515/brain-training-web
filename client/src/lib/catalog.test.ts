import {describe,it,expect} from 'vitest';import {games,filterGames} from './catalog';
import { registry } from '../games';
describe('40-game catalogue and age/numeracy discovery',()=>{
it('contains exactly original IDs1..40 once with visible prerequisites',()=>{expect(games.map(g=>g.id).sort((a,b)=>a-b)).toEqual(Array.from({length:40},(_,i)=>i+1));for(const g of games){expect(g.ageLabel.length).toBeGreaterThan(0);expect(g.numberBasics.length).toBeGreaterThan(0);expect(g.summary.length).toBeGreaterThan(0);}});
it('目录每一款游戏都有唯一对应的可运行组件', () => {
  expect(Object.keys(registry).map(Number)).toEqual(games.map(game => game.id));
  expect(Object.values(registry).every(component => typeof component === 'function')).toBe(true);
});
it('preschool and no-numbers filters never recommend arithmetic or numeric sorting',()=>{const xs=filterGames({ageMax:6,noNumbers:true});expect(xs.length).toBeGreaterThan(0);expect(xs.every(x=>x.ageMin<=6&&!x.needsNumbers)).toBe(true);expect(xs.map(x=>x.id)).not.toContain(13);expect(xs.map(x=>x.id)).not.toContain(16);});
it('search and category are intersected, and older users can see early games',()=>{expect(filterGames({query:'记忆',category:'记忆力'}).every(g=>g.category==='记忆力')).toBe(true);expect(filterGames({ageMax:99})).toHaveLength(40);});
});
