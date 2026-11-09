import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameProps, GameResult } from '../types';
import { makeResult, useElapsed } from '../shared';
export function useRound(onFinish:GameProps['onFinish']){const elapsed=useElapsed();const done=useRef(false);const callback=useRef(onFinish);callback.current=onFinish;return useCallback((accuracy:number,metrics:GameResult['metrics']={})=>{if(done.current)return;done.current=true;callback.current(makeResult(accuracy,elapsed(),metrics));},[]);}
export const sceneStyle={width:'100%',maxWidth:440,display:'block',margin:'0 auto',touchAction:'none',background:'#f7faf8',borderRadius:16} as const;
export const arrowChars=['↑','→','↓','←'];
export function Feedback({message}:{message:string}){return <p role="status" className="muted" style={{minHeight:24}}>{message}</p>;}
export function RuleList({rules,checks}:{rules:string[];checks?:boolean[]}){return <ul style={{paddingLeft:22}}>{rules.map((r,i)=><li key={r} style={{color:checks?(checks[i]?'#167b68':'#a34735'):undefined}}>{checks?(checks[i]?'✓ ':'○ '):''}{r}</li>)}</ul>;}

export function RoundClock({level,onExpire,baseMs=210000,stepMs=3000}:{level:number;onExpire:()=>void;baseMs?:number;stepMs?:number}){
 const limit=Math.max(30000,baseMs-level*stepMs),callback=useRef(onExpire),[remaining,setRemaining]=useState(limit);callback.current=onExpire;
 useEffect(()=>{const start=performance.now();const timer=setInterval(()=>{const left=Math.max(0,limit-(performance.now()-start));setRemaining(left);if(left===0){clearInterval(timer);callback.current();}},250);return()=>clearInterval(timer);},[limit]);
 return <p className="muted" aria-label="本题剩余时间">本题限时 {Math.round(limit/1000)} 秒 · 剩余 {Math.ceil(remaining/1000)} 秒</p>;
}
