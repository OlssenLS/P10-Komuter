import { StationSeedData } from '../types.js';
import { CibuburLine } from './cibubur-line.js';
import { BekasiLine } from './bekasi-line.js';

export * from './cibubur-line.js';
export * from './bekasi-line.js'

export const lrtJabodebekStations: StationSeedData[] = [
    ...CibuburLine,
    ...BekasiLine
];
