import { TransportType } from '@prisma/client';
import { StationSeedData } from './types.js';

export const rangkasbitungLineStations: StationSeedData[] = [
  {
    name: 'Stasiun Tanah Abang',
    isTransitHub: true,
    supportedTypes: [TransportType.KRL, TransportType.TRANSIT],
    lineNames: ['Rangkasbitung Line', 'Cikarang Line'],
    latitude: -6.1857,
    longitude: 106.8108,
  },
  {
    name: 'Stasiun Palmerah',
    isTransitHub: false,
    supportedTypes: [TransportType.KRL],
    lineNames: ['Rangkasbitung Line'],
    latitude: -6.2070,
    longitude: 106.7974,
  },
];
