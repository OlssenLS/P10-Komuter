import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Mapping of each transit line to its operational terminus / major destination stations.
 * Includes regular termini, branch termini, and operational short-turn termini
 * (e.g. Cikarang Line: Cikarang, Bekasi, Tambun, Kampung Bandan, Angke, Manggarai).
 */
export const LINE_TERMINUS_NAMES: Record<string, string[]> = {
  'Bogor Line': [
    'Stasiun Jakarta Kota',
    'Stasiun Bogor',
    'Stasiun Nambo',
    'Stasiun Manggarai',
    'Stasiun Depok',
  ],
  'Cikarang Line': [
    'Stasiun Cikarang',
    'Stasiun Bekasi',
    'Stasiun Tambun',
    'Stasiun Kampung Bandan',
    'Stasiun Angke',
    'Stasiun Manggarai',
  ],
  'Rangkasbitung Line': [
    'Stasiun Tanah Abang',
    'Stasiun Rangkasbitung',
    'Stasiun Parung Panjang',
    'Stasiun Serpong',
    'Stasiun Tigaraksa',
  ],
  'Tangerang Line': [
    'Stasiun Duri',
    'Stasiun Tangerang',
  ],
  'Tanjung Priok Line': [
    'Stasiun Jakarta Kota',
    'Stasiun Tanjung Priok',
    'Stasiun Kampung Bandan',
  ],
  'North South Line': [
    'Stasiun MRT Lebak Bulus Bank Syariah Indonesia',
    'Stasiun MRT Bundaran HI Bank Jakarta',
    'Stasiun MRT Blok M BCA',
  ],
  'Cibubur Line': [
    'Stasiun LRT Dukuh Atas Bank Syariah Indonesia',
    'Stasiun LRT Harjamukti',
  ],
  'Bekasi Line': [
    'Stasiun LRT Dukuh Atas Bank Syariah Indonesia',
    'Stasiun LRT Jatimulya',
  ],
  'Southern Line': [
    'Stasiun LRT Kelapa Gading',
    'Stasiun LRT Velodrome',
    'Stasiun LRT Manggarai',
  ],
  'Soekarno-Hatta Line': [
    'Stasiun Manggarai',
    'Stasiun BNI City',
    'Stasiun Duri',
    'Stasiun Batu Ceper',
  ],
  'Whoosh': [
    'Stasiun LRT Halim',
  ],
};

export interface ValidDestinationEntry {
  lineName: string;
  destinationStationId: string;
  destinationName: string;
}

export async function backfillDestinations(client = prisma) {
  console.log('Querying all existing stations from database...');
  const allStations = await client.station.findMany({
    select: {
      id: true,
      name: true,
      lineNames: true,
      supportedTypes: true,
      validDestinations: true,
    },
  });

  console.log(`Found ${allStations.length} stations in DB.`);

  // Create lookup map by exact station name
  const stationByName = new Map<string, { id: string; name: string }>();
  for (const station of allStations) {
    stationByName.set(station.name, { id: station.id, name: station.name });
  }

  // Verify and resolve terminus station IDs
  const resolvedLineTermini = new Map<string, { id: string; name: string }[]>();
  for (const [lineName, terminusNames] of Object.entries(LINE_TERMINUS_NAMES)) {
    const resolvedStations: { id: string; name: string }[] = [];
    for (const name of terminusNames) {
      const match = stationByName.get(name);
      if (!match) {
        console.warn(`[WARNING] Terminus '${name}' for line '${lineName}' not found in database!`);
      } else {
        resolvedStations.push(match);
      }
    }
    resolvedLineTermini.set(lineName, resolvedStations);
  }

  let updatedCount = 0;

  for (const station of allStations) {
    const destinations: ValidDestinationEntry[] = [];
    const seenDestinationKeys = new Set<string>();

    for (const lineName of station.lineNames) {
      const lineTermini = resolvedLineTermini.get(lineName) || [];
      for (const terminus of lineTermini) {
        // Exclude the station's own id so a terminus does not list itself as a destination
        if (terminus.id === station.id) {
          continue;
        }

        const key = `${lineName}:${terminus.id}`;
        if (!seenDestinationKeys.has(key)) {
          seenDestinationKeys.add(key);
          destinations.push({
            lineName,
            destinationStationId: terminus.id,
            destinationName: terminus.name,
          });
        }
      }
    }

    await client.station.update({
      where: { id: station.id },
      data: {
        validDestinations: destinations as any,
      },
    });

    updatedCount++;
  }

  console.log(`\nSuccessfully updated validDestinations for ${updatedCount} stations.`);
}

if (process.argv[1]?.includes('backfill-destinations')) {
  backfillDestinations()
    .catch((e) => {
      console.error('Backfill failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
