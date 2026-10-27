import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { StationsService } from './stations.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TransportType } from '@prisma/client';

describe('StationsService', () => {
  let service: StationsService;

  const mockStations = [
    {
      id: 'manggarai-1',
      name: 'Stasiun Manggarai',
      isTransitHub: true,
      supportedTypes: [TransportType.KRL],
      lineNames: ['Bogor Line', 'Cikarang Line', 'Airport Rail Link'],
      latitude: -6.2099,
      longitude: 106.8497,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'sudirman-2',
      name: 'Stasiun Sudirman',
      isTransitHub: true,
      supportedTypes: [TransportType.KRL],
      lineNames: ['Cikarang Line'],
      latitude: -6.2023,
      longitude: 106.8236,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'dukuh-atas-3',
      name: 'Stasiun MRT Dukuh Atas BNI',
      isTransitHub: true,
      supportedTypes: [TransportType.MRT],
      lineNames: ['North-South Line'],
      latitude: -6.2008,
      longitude: 106.8229,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockPrismaService = {
    station: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StationsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<StationsService>(StationsService);
  });

  describe('calculateHaversineDistanceMeters', () => {
    it('should calculate distance accurately between two known points', () => {
      // Stasiun Manggarai (-6.2099, 106.8497) to nearby point ~200m away (-6.2105, 106.8485)
      const distance = service.calculateHaversineDistanceMeters(
        -6.2099,
        106.8497,
        -6.2105,
        106.8485,
      );
      // Expected around 145-155 meters
      expect(distance).toBeGreaterThan(100);
      expect(distance).toBeLessThan(200);
    });

    it('should return 0 for identical points', () => {
      const distance = service.calculateHaversineDistanceMeters(
        -6.2099,
        106.8497,
        -6.2099,
        106.8497,
      );
      expect(distance).toBe(0);
    });
  });

  describe('findNearby', () => {
    it('should return isWithinStationRadius = true when user is within 500 meters of a station', async () => {
      mockPrismaService.station.findMany.mockResolvedValue(mockStations);

      // Coordinates ~150 meters away from Stasiun Manggarai
      const result = await service.findNearby({
        latitude: -6.2105,
        longitude: 106.8485,
        radius: 500,
      });

      expect(result.isWithinStationRadius).toBe(true);
      expect(result.radiusMeters).toBe(500);
      expect(result.closestStation).toBeDefined();
      expect(result.closestStation?.id).toBe('manggarai-1');
      expect(result.closestStation?.distanceMeters).toBeLessThan(500);
      expect(result.nearbyStations.length).toBeGreaterThanOrEqual(1);
      expect(result.nearbyStations[0].id).toBe('manggarai-1');
    });

    it('should return isWithinStationRadius = false when user is farther than 500 meters', async () => {
      mockPrismaService.station.findMany.mockResolvedValue(mockStations);

      // Coordinates at Monas (-6.1754, 106.8272), which is > 3km away from Manggarai / Sudirman
      const result = await service.findNearby({
        latitude: -6.1754,
        longitude: 106.8272,
        radius: 500,
      });

      expect(result.isWithinStationRadius).toBe(false);
      expect(result.nearbyStations).toEqual([]);
      // closestStation is still returned so the user can see how far away the closest station is
      expect(result.closestStation).toBeDefined();
      expect(result.closestStation?.distanceMeters).toBeGreaterThan(500);
    });

    it('should handle empty stations in database gracefully', async () => {
      mockPrismaService.station.findMany.mockResolvedValue([]);

      const result = await service.findNearby({
        latitude: -6.2099,
        longitude: 106.8497,
      });

      expect(result.isWithinStationRadius).toBe(false);
      expect(result.closestStation).toBeNull();
      expect(result.nearbyStations).toEqual([]);
      expect(result.radiusMeters).toBe(500);
    });
  });

  describe('findAll', () => {
    it('should return all stations', async () => {
      mockPrismaService.station.findMany.mockResolvedValue(mockStations);

      const result = await service.findAll();
      expect(result).toEqual(mockStations);
      expect(mockPrismaService.station.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return single station if found', async () => {
      mockPrismaService.station.findUnique.mockResolvedValue(mockStations[0]);

      const result = await service.findOne('manggarai-1');
      expect(result.id).toBe('manggarai-1');
      expect(result.name).toBe('Stasiun Manggarai');
    });

    it('should throw NotFoundException if station does not exist', async () => {
      mockPrismaService.station.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create and return station', async () => {
      const newStation = {
        name: 'Stasiun Tanah Abang',
        isTransitHub: true,
        supportedTypes: [TransportType.KRL],
        lineNames: ['Rangkasbitung Line', 'Cikarang Line'],
        latitude: -6.1856,
        longitude: 106.8111,
      };

      mockPrismaService.station.create.mockResolvedValue({
        id: 'tanah-abang-4',
        ...newStation,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(newStation);
      expect(result.name).toBe('Stasiun Tanah Abang');
      expect(mockPrismaService.station.create).toHaveBeenCalledWith({
        data: {
          name: newStation.name,
          isTransitHub: true,
          supportedTypes: newStation.supportedTypes,
          lineNames: newStation.lineNames,
          latitude: newStation.latitude,
          longitude: newStation.longitude,
        },
      });
    });
  });
});
