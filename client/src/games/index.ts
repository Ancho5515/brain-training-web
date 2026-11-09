import {groupA} from './groupA';import {groupB} from './groupB';import {groupC} from './groupC';import type {GameRegistry} from './types';
export const registry:GameRegistry={...groupA,...groupB,...groupC};
