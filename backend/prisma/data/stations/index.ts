import { StationSeedData } from './types.js';
import { cikarangLineStations } from './cikarang-line.js';
import { bogorLineStations } from './bogor-line.js';
import { rangkasbitungLineStations } from './rangkasbitung-line.js';
import { tangerangLineStations } from './tangerang-line.js';
import { tanjungPriokLineStations } from './tanjung-priok-line.js';
import { defaultStations } from './default-stations.js';

export * from './types.js';
export * from './cikarang-line.js';
export * from './bogor-line.js';
export * from './rangkasbitung-line.js';
export * from './tangerang-line.js';
export * from './tanjung-priok-line.js';
export * from './default-stations.js';

/**
 * Combines station lists from multiple transit lines.
 * If a station exists on multiple lines (e.g. Manggarai),
 * it automatically merges `lineNames` and `supportedTypes`, and flags `isTransitHub = true`.
 */
export function getAllStations(): StationSeedData[] {
  const stationMap = new Map<string, StationSeedData>();

  const allStationLists: StationSeedData[] = [
    ...defaultStations,
    ...cikarangLineStations,
    ...bogorLineStations,
    ...rangkasbitungLineStations,
    ...tangerangLineStations,
    ...tanjungPriokLineStations,
  ];

  for (const station of allStationLists) {
    const existing = stationMap.get(station.name);
    if (!existing) {
      stationMap.set(station.name, { ...station });
    } else {
      const mergedLineNames = Array.from(
        new Set([...existing.lineNames, ...station.lineNames])
      );
      const mergedSupportedTypes = Array.from(
        new Set([...existing.supportedTypes, ...station.supportedTypes])
      );
      const isTransitHub =
        existing.isTransitHub || station.isTransitHub || mergedLineNames.length > 1;

      stationMap.set(station.name, {
        ...existing,
        isTransitHub,
        lineNames: mergedLineNames,
        supportedTypes: mergedSupportedTypes,
        latitude: station.latitude || existing.latitude,
        longitude: station.longitude || existing.longitude,
      });
    }
  }

  return Array.from(stationMap.values());
}
