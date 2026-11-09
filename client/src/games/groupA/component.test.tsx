import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { groupA } from '../groupA';

const names = ['瞬时记忆','视觉追踪','舒尔特方格','图形序列','颜色干扰','路径记忆','数字闪记','位置复原','配对翻牌','旋转判断','目标搜索','节奏复刻','快速心算','规则切换'];
describe('group A registration and initial lifecycle', () => {
  it('registers each of the fourteen distinct exercises', () => {
    expect(Object.keys(groupA).map(Number).sort((a,b)=>a-b)).toEqual(Array.from({length:14},(_,i)=>i+1));
  });
  it('renders every exercise at low, middle and maximum load without finishing on mount', () => {
    let finishes=0;
    for (const level of [1,15,30]) for(let id=1;id<=14;id++) {
      const component=groupA[id];
      expect(typeof component).toBe('function');
      const html=renderToStaticMarkup(createElement(component,{level,seed:43,onFinish:()=>finishes++}));
      expect(html).toContain(names[id-1]);
      expect(html).not.toContain('NaN');
    }
    expect(finishes).toBe(0);
  });
  it('provides a sign toggle for arithmetic on mobile number keyboards',()=>{
    const html=renderToStaticMarkup(createElement(groupA[13],{level:30,seed:43,onFinish:()=>{}}));
    expect(html).toContain('切换正负');
  });
});
