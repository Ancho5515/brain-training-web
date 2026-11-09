import type { GameRegistry } from './types';
import { CircleGame, ClockGame, EscortGame } from './groupC/motor';
import { CubeGame, PaperGame, StarGame } from './groupC/spatial';
import { BalanceGame, LogicGame, MatrixGame, PasswordGame } from './groupC/reasoning';
import { BudgetGame, HanoiGame, RouteGame } from './groupC/planning';
export const groupC:GameRegistry={28:CircleGame,29:EscortGame,30:ClockGame,31:PaperGame,32:CubeGame,33:StarGame,34:LogicGame,35:BalanceGame,36:MatrixGame,37:PasswordGame,38:BudgetGame,39:RouteGame,40:HanoiGame};
