import { TransportType } from '@prisma/client';
import { StationSeedData } from './types.js';

export const tanjungPriokLineStations: StationSeedData[] = [
  {
    name: 'Stasiun Jakarta Kota',
    isTransitHub: true,
    supportedTypes: [TransportType.KRL, TransportType.TRANSIT],
    lineNames: ['Tanjung Priok Line', 'Bogor Line'],
    latitude: -6.1376,
    longitude: 106.8146,
  },
  {
    name: 'Stasiun Kampung Bandan',
    isTransitHub: true,
    supportedTypes: [TransportType.KRL, TransportType.TRANSIT],
    lineNames: ['Tanjung Priok Line', 'Cikarang Line'],
    latitude: -6.1347,
    longitude: 106.8281,
  },
];
