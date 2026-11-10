import { useCallback, useRef } from 'react';
import type { GameProps, GameResult } from '../types';
import { makeResult, useElapsed } from '../shared';
export { RoundClock } from '../shared';
export function useRound(onFinish:GameProps['onFinish']){const elapsed=useElapsed();const done=useRef(false);const callback=useRef(onFinish);callback.current=onFinish;return useCallback((accuracy:number,metrics:GameResult['metrics']={})=>{if(done.current)return;done.current=true;callback.current(makeResult(accuracy,elapsed(),metrics));},[]);}
export const sceneStyle={width:'100%',maxWidth:440,display:'block',margin:'0 auto',touchAction:'none',background:'#f7faf8',borderRadius:16} as const;
export const arrowChars=['↑','→','↓','←'];
export function Feedback({message}:{message:string}){return <p role="status" className="muted" style={{minHeight:24}}>{message}</p>;}
export function RuleList({rules,checks}:{rules:string[];checks?:boolean[]}){return <ul style={{paddingLeft:22}}>{rules.map((r,i)=><li key={r} style={{color:checks?(checks[i]?'#167b68':'#a34735'):undefined}}>{checks?(checks[i]?'✓ ':'○ '):''}{r}</li>)}</ul>;}
