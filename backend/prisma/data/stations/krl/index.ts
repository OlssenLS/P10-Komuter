import { StationSeedData } from '../types.js';
import { bogorLineStations } from './bogor-line.js';
import { cikarangLineStations } from './cikarang-line.js';
import { rangkasbitungLineStations } from './rangkasbitung-line.js';
import { tangerangLineStations } from './tangerang-line.js';
import { tanjungPriokLineStations } from './tanjung-priok-line.js';

export * from './bogor-line.js';
export * from './cikarang-line.js';
export * from './rangkasbitung-line.js';
export * from './tangerang-line.js';
export * from './tanjung-priok-line.js';

export const krlStations: StationSeedData[] = [
  ...bogorLineStations,
  ...cikarangLineStations,
  ...rangkasbitungLineStations,
  ...tangerangLineStations,
  ...tanjungPriokLineStations,
];
