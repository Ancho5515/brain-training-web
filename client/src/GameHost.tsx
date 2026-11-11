import {Component,useEffect,useRef,useState,type ReactNode} from 'react';
import type {GameInfo} from './lib/catalog';
import type {Bootstrap} from './lib/api';
import {api,ApiError,averageRounds,enqueue,nextSeed,removePending,uuid} from './lib/api';
import {completedRun,loadDraft,removeDraft} from './lib/draft';
import {registry} from './games';
import type {GameResult} from './games/types';

export function focusGameHeading(heading: HTMLHeadingElement | null) {
 if (!heading) return;
 heading.focus({preventScroll:true});
 window.scrollTo(0,0);
}

class ExerciseBoundary extends Component<{children:ReactNode},{error:string}> {
 state={error:''};static getDerivedStateFromError(e:Error){return {error:e.message};}
 render(){return this.state.error?<div role="alert" className="notice error">这道练习暂时未能显示：{this.state.error}。请返回目录重试。</div>:this.props.children;}
}
export default function GameHost({game,session,initialLevel,onBack,onSaved,onRefresh}:{game:GameInfo;session:Bootstrap;initialLevel:number;onBack:()=>void;onSaved:()=>void;onRefresh:()=>Promise<Bootstrap>}) {
 const user=session.user!;
 const draftKey='btw.draft.'+user.id+'.'+game.id;
 const [draft,setDraft]=useState(()=>loadDraft(draftKey,Math.max(1,Math.min(30,initialLevel))));
 const [interrupted,setInterrupted]=useState(document.hidden);
 const [saveState,setSaveState]=useState('');const [saved,setSaved]=useState(false);const [busy,setBusy]=useState(false);
 const finished=useRef(!!draft.currentResult);const Player=registry[game.id];const result=draft.currentResult??null;
 useEffect(()=>{try{localStorage.setItem(draftKey,JSON.stringify(draft));}catch{setSaveState('浏览器空间不足。请保持页面，完成后直接保存到主机。');}},[draft,draftKey]);
 useEffect(()=>{const hide=()=>{if(document.hidden&&!finished.current)setInterrupted(true);};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[]);
 function restart(level=draft.level){
  if(busy)return;
  finished.current=false;setSaveState('');setSaved(false);setInterrupted(false);
  // Keep refresh/bookmark recovery aligned with the selected difficulty.
  history.replaceState(null,'','#/game/'+game.id+'?level='+level);
  setDraft({level,seed:nextSeed(),rounds:[],id:uuid()});
 }
 function finish(r:GameResult){
  if(finished.current)return;
  if(![r.score,r.accuracy,r.durationMs].every(Number.isFinite))throw new Error('练习结果无效');
  finished.current=true;setDraft(d=>({...d,currentResult:r}));
 }
 async function next(){
  if(!result||busy||saved)return;
  if(draft.rounds.length<2){finished.current=false;setDraft({...draft,rounds:[...draft.rounds,result],currentResult:undefined,seed:nextSeed()});return;}
  const run=completedRun(draft,game.id);setBusy(true);
  // Persist the full run under its owner BEFORE any request or auth refresh.
  let queued=false;try{enqueue(user.id,run);queued=true;}catch{}
  try{
   await api('/records','POST',run,session.csrfToken);
   try{removePending(user.id,run.id);}catch{}
   removeDraft(draftKey,run.id);setSaveState('已保存到主机');setSaved(true);onSaved();
  }catch(e){
   const recoverable=!(e instanceof ApiError)||e.status>=500||e.status===401||e.status===429||e.code==='csrf_required';
   if(recoverable&&queued){
    removeDraft(draftKey,run.id);setSaved(true);
    setSaveState('已暂存到此浏览器，重新连接或登录本账号后会补存');
    if(e instanceof ApiError&&(e.status===401||e.code==='csrf_required')){try{await onRefresh();}catch{}}
   }else{
    if(queued){try{removePending(user.id,run.id);}catch{}}
    setSaveState(recoverable?'未能连接主机，浏览器也无法暂存。请保持页面并重试保存。':(e as Error).message);
   }
  }finally{setBusy(false);}
 }
 const complete=draft.rounds.length===2&&!!result;
 const displayed=complete?averageRounds([...draft.rounds,result!]):result;
 return <main className="page play-page">
  <button className="text-button" onClick={onBack}>← 返回全部游戏</button>
  <div className="play-heading"><div><span className="eyebrow">{game.category} / {user.displayName}</span><h1 ref={focusGameHeading} tabIndex={-1}>{game.name}</h1></div><label className="level-picker">训练难度 <select aria-label="训练难度" disabled={busy} value={draft.level} onChange={e=>restart(Number(e.target.value))}>{Array.from({length:30},(_,i)=><option value={i+1} key={i}>第 {i+1} 级</option>)}</select></label></div>
  <div className="play-meta"><span>{game.ageLabel}</span><span>{game.numberBasics}</span><span>每局 3 回合</span></div>
  <div className="round-track" aria-label={'第'+(draft.rounds.length+1)+'回合'}>{[0,1,2].map(i=><span key={i} className={i<=draft.rounds.length?'active':''}/>)}</div>
  {interrupted&&!result?<section className="panel centered"><div className="big-icon">Ⅱ</div><h2>练习已暂停</h2><p>刚才离开了页面。重新开始当前回合，已完成的回合会保留。</p><button className="primary" onClick={()=>{finished.current=false;setInterrupted(false);setDraft({...draft,seed:nextSeed()});}}>重新开始当前回合</button></section>:result&&displayed?<section className="panel centered result-panel">
   <span className="eyebrow">{complete?'本局练习完成':'本回合完成'}</span><div className="result-number">{Math.round(displayed.score)}<small> 分</small></div>
   <p>正确率 {Math.round(displayed.accuracy*100)}% · 用时 {(displayed.durationMs/1000).toFixed(1)} 秒</p><p className="muted">与自己同一游戏、同一难度的历史表现比较。</p>
   {saveState&&<div role="status" className="notice">{saveState}</div>}
   {saved?<div className="actions"><button className="primary" onClick={()=>restart()}>再练一局</button><button className="secondary" onClick={onBack}>查看全部游戏</button></div>:<button className="primary" disabled={busy} onClick={next}>{busy?'正在保存…':complete?(saveState?'重试保存':'保存本局训练'):'下一回合 →'}</button>}
   <details className="metric-details"><summary>{complete?'本局记录':'本回合记录'}</summary><dl>{Object.entries(displayed.metrics).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{String(v)}</dd></div>)}</dl></details>
  </section>:Player?<ExerciseBoundary key={draft.seed}><Player level={draft.level} seed={draft.seed} previousResult={draft.rounds[draft.rounds.length-1]} onFinish={finish}/></ExerciseBoundary>:<div className="notice error" role="alert">游戏尚未加载，请刷新页面。</div>}
  <p className="play-note">练习规则：{game.summary}</p>
 </main>;
}
