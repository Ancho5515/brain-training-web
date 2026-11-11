import type { ComponentType } from 'react';
export interface GameResult { score:number; accuracy:number; durationMs:number; metrics:Record<string,number|string|boolean>; }
export interface GameProps { level:number; seed:number; previousResult?:GameResult; onFinish:(result:GameResult)=>void; }
export type GameRegistry = Record<number,ComponentType<GameProps>>;
