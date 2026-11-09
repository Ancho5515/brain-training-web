import type { ComponentType } from 'react';
export interface GameResult { score:number; accuracy:number; durationMs:number; metrics:Record<string,number|string|boolean>; }
export interface GameProps { level:number; seed:number; onFinish:(result:GameResult)=>void; }
export type GameRegistry = Record<number,ComponentType<GameProps>>;
