import { StationSeedData } from '../types.js';
import { NorthSouthLineStations } from './north-south-line.js';

export * from './north-south-line.js';

export const mrtStations: StationSeedData[] = [
    ...NorthSouthLineStations
];
