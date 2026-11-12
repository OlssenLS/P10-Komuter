import { StationSeedData } from './types.js';
import { krlStations } from './krl/index.js';
import { mrtStations } from './mrt/index.js';
import { lrtJabodebekStations } from './lrt_jabodebek/index.js';

export * from './types.js';

/**
 * Combines station lists from multiple transit lines.
 * Deduplicates by station name, automatically merges lineNames and supportedTypes,
 * and sets isTransitHub to true if a station serves multiple lines or transport types.
 */
export function getAllStations(): StationSeedData[] {
  const stationMap = new Map<string, StationSeedData>(  );

  const allStationLists: StationSeedData[] = [
    ...krlStations,
    ...mrtStations,
    ...lrtJabodebekStations
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
        existing.isTransitHub || station.isTransitHub || mergedLineNames.length > 1 || mergedSupportedTypes.length > 1;

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
