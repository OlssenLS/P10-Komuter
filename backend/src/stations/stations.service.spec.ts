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

  let mockTx: any;
  const mockPrismaService = {
    station: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    stationLiveStatus: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    disruptionReport: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    user: {
      update: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn((callback) => callback(mockTx)),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockTx = {
      disruptionReport: {
        findFirst: vi.fn(),
        create: vi.fn().mockResolvedValue({}),
      },
      stationLiveStatus: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
      user: {
        update: vi.fn().mockResolvedValue({}),
      },
    };

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

  describe('getStationStatus', () => {
    it('should compute station live profile, filter expired entries, and calculate crowd level', async () => {
      const now = new Date();
      const futureDate = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const expiredDate = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      mockPrismaService.station.findUnique.mockResolvedValue({
        ...mockStations[0],
        validDestinations: [],
        liveStatus: {
          stationId: 'manggarai-1',
          crowdState: {
            low: 2,
            medium: 8,
            high: 0,
            very_high: 0,
            updatedAt: now.toISOString(),
          },
          delayState: {
            'krl-bogor:station-bogor': {
              minorCount: 3,
              expiresAt: futureDate,
            },
            'krl-bogor:station-depok': {
              minorCount: 1,
              expiresAt: expiredDate, // Should be filtered out!
            },
          },
          facilityState: {
            ESCALATOR: { reportCount: 3, status: 'BROKEN' },
          },
          disruptionState: {},
          updatedAt: now,
        },
      });

      const result = await service.getStationStatus('manggarai-1');
      expect(result.station.name).toBe('Stasiun Manggarai');
      expect(result.crowd.currentCrowdLevel).toBe('NORMAL');
      expect(result.crowd.isCrowdOverflow).toBe(false);
      expect(result.delays['krl-bogor:station-bogor']).toBeDefined();
      expect(result.delays['krl-bogor:station-depok']).toBeUndefined();
      expect(result.facilities['ESCALATOR']).toBeDefined();
    });

    it('should zero out crowdState if updatedAt is older than 15 minutes', async () => {
      const expiredCrowdDate = new Date(Date.now() - 20 * 60 * 1000).toISOString();

      mockPrismaService.station.findUnique.mockResolvedValue({
        ...mockStations[0],
        validDestinations: [],
        liveStatus: {
          stationId: 'manggarai-1',
          crowdState: {
            low: 10,
            medium: 20,
            high: 30,
            very_high: 5,
            updatedAt: expiredCrowdDate,
          },
          delayState: {},
          facilityState: {},
          disruptionState: {},
          updatedAt: new Date(),
        },
      });

      const result = await service.getStationStatus('manggarai-1');
      expect(result.crowd.breakdown.low).toBe(0);
      expect(result.crowd.breakdown.medium).toBe(0);
      expect(result.crowd.breakdown.high).toBe(0);
      expect(result.crowd.breakdown.very_high).toBe(0);
      expect(result.crowd.totalVotes).toBe(0);
      expect(result.crowd.currentCrowdLevel).toBe('NORMAL');
    });
  });

  describe('resolveStationIssue', () => {
    it('should throw 400 when attempting to resolve CROWD category', async () => {
      mockPrismaService.station.findUnique.mockResolvedValue(mockStations[0]);

      await expect(
        service.resolveStationIssue('manggarai-1', 'user-123', {
          category: 'CROWD' as any,
          targetKey: 'HIGH',
        }),
      ).rejects.toThrow(/CROWD reports cannot be resolved/);
    });

    it('should throw 404 when target issue is not active', async () => {
      mockPrismaService.station.findUnique.mockResolvedValue(mockStations[0]);
      mockPrismaService.stationLiveStatus.findUnique.mockResolvedValue({
        stationId: 'manggarai-1',
        facilityState: {},
        delayState: {},
        disruptionState: {},
      });

      await expect(
        service.resolveStationIssue('manggarai-1', 'user-123', {
          category: 'FACILITY' as any,
          targetKey: 'ESCALATOR',
        }),
      ).rejects.toThrow(/No active facility issue found/);
    });

    it('should increment resolvedCount and clear active entry once threshold reached', async () => {
      mockPrismaService.station.findUnique.mockResolvedValue(mockStations[0]);
      mockPrismaService.stationLiveStatus.findUnique.mockResolvedValue({
        stationId: 'manggarai-1',
        facilityState: {
          ESCALATOR: { reportCount: 2, resolvedCount: 1, status: 'BROKEN' },
        },
        delayState: {},
        disruptionState: {},
      });
      mockTx.disruptionReport.findFirst.mockResolvedValue(null);

      const result = await service.resolveStationIssue('manggarai-1', 'user-123', {
        category: 'FACILITY' as any,
        targetKey: 'ESCALATOR',
      });

      expect(result.status).toBe('SUCCESS');
      expect(result.cleared).toBe(true);
      expect(mockTx.disruptionReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isResolution: true,
          }),
        }),
      );
    });

    it('should reject duplicate resolution within active window', async () => {
      mockPrismaService.station.findUnique.mockResolvedValue(mockStations[0]);
      mockPrismaService.stationLiveStatus.findUnique.mockResolvedValue({
        stationId: 'manggarai-1',
        facilityState: {
          ESCALATOR: { reportCount: 2, resolvedCount: 0, status: 'BROKEN' },
        },
        delayState: {},
        disruptionState: {},
      });
      mockTx.disruptionReport.findFirst.mockResolvedValue({
        id: 'res-1',
        isResolution: true,
      });

      const result = await service.resolveStationIssue('manggarai-1', 'user-123', {
        category: 'FACILITY' as any,
        targetKey: 'ESCALATOR',
      });

      expect(result.status).toBe('ALREADY_RESOLVED');
      expect(mockTx.disruptionReport.create).not.toHaveBeenCalled();
    });
  });
});
