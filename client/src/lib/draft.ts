import type {GameResult} from '../games/types';
import {averageRounds,nextSeed,uuid,type Run} from './api';
export interface Draft {level:number;seed:number;rounds:GameResult[];id:string;currentResult?:GameResult}
export function loadDraft(key:string,level:number):Draft {
 try {const d=JSON.parse(localStorage.getItem(key)??'null');if(d&&d.level===level&&Number.isInteger(d.seed)&&Array.isArray(d.rounds)&&d.rounds.length<3&&typeof d.id==='string')return d;}catch{}
 return {level,seed:nextSeed(),rounds:[],id:uuid()};
}
export function completedRun(draft:Draft,gameId:number):Run {
 if(draft.rounds.length!==2||!draft.currentResult)throw new Error('本局尚未完成');
 return {...averageRounds([...draft.rounds,draft.currentResult]),id:draft.id,gameId,level:draft.level,seed:draft.seed};
}
export function removeDraft(key:string,id:string){try{if(JSON.parse(localStorage.getItem(key)??'null')?.id===id)localStorage.removeItem(key);}catch{}}
