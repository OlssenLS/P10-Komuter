import { TransportType } from '@prisma/client';
import { StationSeedData } from './types.js';

export const tangerangLineStations: StationSeedData[] = [
  {
    name: 'Stasiun Duri',
    isTransitHub: true,
    supportedTypes: [TransportType.KRL, TransportType.TRANSIT],
    lineNames: ['Tangerang Line', 'Cikarang Line', 'Soekarno-Hatta Line'],
    latitude: -6.1553,
    longitude: 106.8012,
  },
  {
    name: 'Stasiun Grogol',
    isTransitHub: false,
    supportedTypes: [TransportType.KRL],
    lineNames: ['Tangerang Line'],
    latitude: -6.1604,
    longitude: 106.7894,
  },
];
