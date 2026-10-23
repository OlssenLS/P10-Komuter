import { PrismaClient, TransportType } from '@prisma/client';

const prisma = new PrismaClient();

const initialStations = [
  {
    name: 'Stasiun Manggarai',
    isTransitHub: true,
    supportedTypes: [TransportType.KRL, TransportType.TRANSIT],
    lineNames: ['Bogor Line', 'Cikarang Line', 'Airport Rail Link'],
    latitude: -6.2099,
    longitude: 106.8497,
  },
  {
    name: 'Stasiun Sudirman',
    isTransitHub: true,
    supportedTypes: [TransportType.KRL, TransportType.TRANSIT],
    lineNames: ['Cikarang Line'],
    latitude: -6.2023,
    longitude: 106.8236,
  },
  {
    name: 'Stasiun MRT Dukuh Atas BNI',
    isTransitHub: true,
    supportedTypes: [TransportType.MRT, TransportType.TRANSIT],
    lineNames: ['North-South Line'],
    latitude: -6.2008,
    longitude: 106.8229,
  },
  {
    name: 'Stasiun MRT Bundaran HI',
    isTransitHub: false,
    supportedTypes: [TransportType.MRT],
    lineNames: ['North-South Line'],
    latitude: -6.1925,
    longitude: 106.8228,
  },
  {
    name: 'Stasiun Tanah Abang',
    isTransitHub: true,
    supportedTypes: [TransportType.KRL],
    lineNames: ['Rangkasbitung Line', 'Cikarang Line'],
    latitude: -6.1856,
    longitude: 106.8111,
  },
  {
    name: 'Stasiun Palmerah',
    isTransitHub: false,
    supportedTypes: [TransportType.KRL],
    lineNames: ['Rangkasbitung Line'],
    latitude: -6.2070,
    longitude: 106.7974,
  },
  {
    name: 'Stasiun Juanda',
    isTransitHub: false,
    supportedTypes: [TransportType.KRL],
    lineNames: ['Bogor Line'],
    latitude: -6.1666,
    longitude: 106.8306,
  },
  {
    name: 'Stasiun Gondangdia',
    isTransitHub: false,
    supportedTypes: [TransportType.KRL],
    lineNames: ['Bogor Line'],
    latitude: -6.1863,
    longitude: 106.8327,
  },
  {
    name: 'Stasiun Jakarta Kota',
    isTransitHub: true,
    supportedTypes: [TransportType.KRL],
    lineNames: ['Bogor Line', 'Tanjung Priok Line'],
    latitude: -6.1376,
    longitude: 106.8146,
  },
  {
    name: 'Stasiun LRT Dukuh Atas',
    isTransitHub: true,
    supportedTypes: [TransportType.LRTJBK, TransportType.TRANSIT],
    lineNames: ['Cibubur Line', 'Bekasi Line'],
    latitude: -6.2036,
    longitude: 106.8225,
  },
  {
    name: 'Halte CSW / MRT ASEAN',
    isTransitHub: true,
    supportedTypes: [TransportType.MRT, TransportType.TJ, TransportType.TRANSIT],
    lineNames: ['North-South Line', 'Koridor 13', 'Koridor 1'],
    latitude: -6.2393,
    longitude: 106.7984,
  },
];

async function main() {
  console.log('Seeding stations...');

  for (const station of initialStations) {
    const existing = await prisma.station.findFirst({
      where: { name: station.name },
    });

    if (!existing) {
      await prisma.station.create({
        data: station,
      });
      console.log(`Created station: ${station.name}`);
    } else {
      console.log(`Station already exists: ${station.name}`);
    }
  }

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
