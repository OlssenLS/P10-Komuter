import { PrismaClient } from '@prisma/client';
import { getAllStations } from './data/stations/index.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding stations...');
  const stations = getAllStations();

  for (const station of stations) {
    const existing = await prisma.station.findFirst({
      where: { name: station.name },
    });

    if (!existing) {
      await prisma.station.create({
        data: {
          name: station.name,
          isTransitHub: station.isTransitHub ?? false,
          supportedTypes: station.supportedTypes,
          lineNames: station.lineNames,
          latitude: station.latitude,
          longitude: station.longitude,
        },
      });
      console.log(`Created station: ${station.name}`);
    } else {
      await prisma.station.update({
        where: { id: existing.id },
        data: {
          isTransitHub: station.isTransitHub ?? existing.isTransitHub,
          supportedTypes: station.supportedTypes,
          lineNames: station.lineNames,
          latitude: station.latitude,
          longitude: station.longitude,
        },
      });
      console.log(`Updated station: ${station.name}`);
    }
  }

  console.log(`Seeding completed. Total stations processed: ${stations.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
