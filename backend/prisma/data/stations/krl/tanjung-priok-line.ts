import { TransportType } from '@prisma/client';
import { StationSeedData } from '../types.js';

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
  {
    name: 'Stasiun Ancol',
    isTransitHub: false,
    supportedTypes: [TransportType.KRL],
    lineNames: ['Tanjung Priok Line'],
    latitude: -6.1280,
    longitude: 106.8451,
  },
  {
    name: 'Stasiun Jakarta International Stadium',
    isTransitHub: false,
    supportedTypes: [TransportType.KRL],
    lineNames: ['Tanjung Priok Line'],
    latitude: -6.1229,
    longitude: 106.8617,
  },
  {
    name: 'Stasiun Tanjung Priok',
    isTransitHub: false,
    supportedTypes: [TransportType.KRL],
    lineNames: ['Tanjung Priok Line'],
    latitude: -6.1110,
    longitude: 106.8812,
  },
];
