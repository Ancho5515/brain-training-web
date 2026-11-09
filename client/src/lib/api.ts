import type {GameResult} from '../games/types';
export interface Account {id:string;displayName:string}
export interface Device {id:string;name:string;firstSeenUtc:string;lastSeenUtc:string}
export interface Bootstrap {device:Device;accounts:Account[];user:Account|null;csrfToken:string;isHost:boolean;version:string}
export interface Run extends GameResult {id:string;gameId:number;level:number;seed:number;completedAtUtc?:string}
export interface Progress {gameId:number;lastLevel:number;highestLevel:number;bestScore:number;plays:number;lastPlayedAtUtc:string}
export interface Records {records:Run[];progress:Progress[]}
export interface HostDevice extends Device {userAgent:string;lastIp:string;accountCount:number}
export class ApiError extends Error {status:number;code?:string;constructor(message:string,status:number,code?:string){super(message);this.status=status;this.code=code;}}
export async function api<T>(path:string,method='GET',body?:unknown,csrf?:string):Promise<T>{
 const response=await fetch('/api'+path,{method,credentials:'same-origin',headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(csrf?{'X-CSRF-TOKEN':csrf}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 if(!response.ok){let message=response.status===401?'账号或密码不正确，或登录已失效':response.status===429?'尝试较频繁，请稍等后重试':'请求失败，请稍后重试';let code:string|undefined;try{const d=await response.json();message=d.error??d.detail??d.title??message;code=d.code;}catch{}throw new ApiError(message,response.status,code);}
 const text=await response.text();return text?JSON.parse(text) as T:undefined as T;
}
export function uuid(){const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const s=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20);}
export function nextSeed(){return crypto.getRandomValues(new Uint32Array(1))[0]&0x7fffffff;}
export function averageRounds(rounds:GameResult[]):GameResult {if(!rounds.length)throw new Error('没有可保存的回合');return {score:Math.round(rounds.reduce((s,x)=>s+x.score,0)/rounds.length),accuracy:rounds.reduce((s,x)=>s+x.accuracy,0)/rounds.length,durationMs:rounds.reduce((s,x)=>s+x.durationMs,0),metrics:{roundCount:rounds.length,roundScores:rounds.map(x=>Math.round(x.score)).join(','),...Object.fromEntries(rounds.flatMap((r,i)=>Object.entries(r.metrics).map(([k,v])=>['round'+(i+1)+'.'+k,v])))}};}
const pendingKey=(userId:string)=>'btw.pending.'+userId;
export function pendingRuns(userId:string):Run[]{try{const raw=JSON.parse(localStorage.getItem(pendingKey(userId))??'[]');return Array.isArray(raw)?raw:[];}catch{return [];}}
export function enqueue(userId:string,run:Run){const items=pendingRuns(userId).filter(x=>x.id!==run.id);localStorage.setItem(pendingKey(userId),JSON.stringify([...items,run]));}
export function removePending(userId:string,id:string){localStorage.setItem(pendingKey(userId),JSON.stringify(pendingRuns(userId).filter(x=>x.id!==id)));}
let flushing=false;
export async function flushPending(userId:string,csrf:string){if(flushing)return;flushing=true;try{for(const run of pendingRuns(userId)){await api('/records','POST',run,csrf);removePending(userId,run.id);}}finally{flushing=false;}}
