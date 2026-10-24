import { TransportType } from '@prisma/client';
import { StationSeedData } from './types.js';

export const cikarangLineStations: StationSeedData[] = [
  {
    name: 'Stasiun Cikarang',
    isTransitHub: true,
    supportedTypes: [TransportType.KRL],
    lineNames: ['Cikarang Line'],
    latitude: -6.2554,
    longitude: 107.1517,
  },
  {
    name: 'Stasiun Metland Telagamurni',
    isTransitHub: false,
    supportedTypes: [TransportType.KRL],
    lineNames: ['Cikarang Line'],
    latitude: -6.2573,
    longitude: 107.1082,
  },
  {
    name: 'Stasiun Cibitung',
    isTransitHub: false,
    supportedTypes: [TransportType.KRL],
    lineNames: ['Cikarang Line'],
    latitude: -6.2588,
    longitude: 107.0784,
  },
];
