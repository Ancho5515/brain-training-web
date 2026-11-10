import type { ComponentType } from 'react';
import { BigArrow, ChangeDetective, DoubleFlash } from './groupB/attention';
import { FeatureCounting, GridOverlay, MirrorRecognition, SemanticConflict, SequenceReorder } from './groupB/perception';
import { IconRebuild, MemoryRelay, ResponseInhibition, ShelfManager, WitnessSearch } from './groupB/workingMemory';
import type { GameProps, GameRegistry } from './types';

function round(Component: ComponentType<GameProps>): ComponentType<GameProps> {
  return ({ level, seed, onFinish }) => <Component key={`${level}:${seed}`} level={level} seed={seed}
    onFinish={result => onFinish({ ...result, metrics: { ...result.metrics, parameterVersion: 'group-b-1' } })} />;
}

export const groupB: GameRegistry = {
  15: round(MirrorRecognition),
  16: round(SequenceReorder),
  17: round(GridOverlay),
  18: round(SemanticConflict),
  19: round(FeatureCounting),
  20: round(ResponseInhibition),
  21: round(IconRebuild),
  22: round(WitnessSearch),
  23: round(MemoryRelay),
  24: round(ShelfManager),
  25: round(ChangeDetective),
  26: round(DoubleFlash),
  27: round(BigArrow),
};
