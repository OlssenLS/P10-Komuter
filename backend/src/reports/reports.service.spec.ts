import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StationsService } from '../stations/stations.service.js';
import { ReportCategory, ReportSubCategory, ReportStatus, TransportType } from '@prisma/client';

describe('ReportsService', () => {
  let service: ReportsService;
  let stationsService: StationsService;

  const mockStation = {
    id: 'station-manggarai',
    name: 'Stasiun Manggarai',
    isTransitHub: true,
    supportedTypes: [TransportType.KRL],
    lineNames: ['Bogor Line', 'Cikarang Line'],
    latitude: -6.2099,
    longitude: 106.8497,
    validDestinations: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockReport = {
    id: 'report-123',
    stationId: 'station-manggarai',
    userId: 'user-456',
    category: ReportCategory.DELAY,
    subCategory: ReportSubCategory.MAJOR,
    note: 'Signal fault',
    status: ReportStatus.ACTIVE,
    isSkippedOrClosed: false,
    isResolution: false,
    userLatitude: -6.2099,
    userLongitude: 106.8497,
    expiresAt: new Date(Date.now() + 45 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let mockTx: any;
  const mockPrismaService = {
    station: {
      findUnique: vi.fn().mockResolvedValue(mockStation),
    },
    stationLiveStatus: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    disruptionReport: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      update: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn((callback) => callback(mockTx)),
  };

  const mockStationsService = {
    findOne: vi.fn(),
    getStationStatus: vi.fn(),
    calculateHaversineDistanceMeters: vi.fn().mockReturnValue(0),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockTx = {
      disruptionReport: {
        findFirst: vi.fn(),
        create: vi.fn().mockResolvedValue(mockReport),
        update: vi.fn().mockResolvedValue(mockReport),
      },
      stationLiveStatus: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({}),
      },
      user: {
        update: vi.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StationsService, useValue: mockStationsService },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    stationsService = module.get<StationsService>(StationsService);
    mockStationsService.findOne.mockResolvedValue(mockStation);
  });

  describe('createReport', () => {
    it('should reject when user is farther than 500m from station', async () => {
      mockStationsService.calculateHaversineDistanceMeters.mockReturnValueOnce(550);

      await expect(
        service.createReport('user-456', {
          stationId: 'station-manggarai',
          category: ReportCategory.CROWD,
          subCategory: ReportSubCategory.HIGH,
          userLatitude: -6.22,
          userLongitude: 106.86,
        }),
      ).rejects.toThrow(/outside the required 500m radius/);
    });

    it('should reject DELAY report without destinationStationId', async () => {
      await expect(
        service.createReport('user-456', {
          stationId: 'station-manggarai',
          category: ReportCategory.DELAY,
          subCategory: ReportSubCategory.MAJOR,
          lineId: 'krl-bogor',
          userLatitude: -6.2099,
          userLongitude: 106.8497,
        }),
      ).rejects.toThrow(/destinationStationId is required/);
    });

    it('should reject DELAY report when destinationStationId is not in validDestinations', async () => {
      mockStationsService.findOne.mockResolvedValueOnce({
        ...mockStation,
        validDestinations: [
          {
            lineName: 'Bogor Line',
            destinationName: 'Stasiun Bogor',
            destinationStationId: 'station-bogor',
          },
        ],
      });

      mockPrismaService.station.findUnique.mockResolvedValueOnce({
        id: 'station-bekasi',
        name: 'Stasiun Bekasi',
      });

      await expect(
        service.createReport('user-456', {
          stationId: 'station-manggarai',
          category: ReportCategory.DELAY,
          subCategory: ReportSubCategory.MAJOR,
          lineName: 'Bogor Line',
          destinationStationId: 'station-bekasi',
          userLatitude: -6.2099,
          userLongitude: 106.8497,
        }),
      ).rejects.toThrow(/is not a valid destination\/terminus/);
    });

    it('should accept DELAY report when destination matches validDestinations structure', async () => {
      mockStationsService.findOne.mockResolvedValueOnce({
        ...mockStation,
        validDestinations: [
          {
            lineName: 'Bogor Line',
            destinationName: 'Stasiun Bogor',
            destinationStationId: 'station-bogor',
          },
        ],
      });

      mockPrismaService.station.findUnique.mockResolvedValueOnce({
        id: 'station-bogor',
        name: 'Stasiun Bogor',
      });

      mockTx.disruptionReport.findFirst.mockResolvedValueOnce(null);

      const result = await service.createReport('user-456', {
        stationId: 'station-manggarai',
        category: ReportCategory.DELAY,
        subCategory: ReportSubCategory.MAJOR,
        lineName: 'Bogor Line',
        destinationStationId: 'station-bogor',
        userLatitude: -6.2099,
        userLongitude: 106.8497,
        note: 'Antrean kereta',
      });

      expect(result.status).toBe('SUCCESS');
    });

    it('should reject invalid subCategory for category', async () => {
      await expect(
        service.createReport('user-456', {
          stationId: 'station-manggarai',
          category: ReportCategory.CROWD,
          subCategory: ReportSubCategory.ESCALATOR, // ESCALATOR belongs to FACILITY!
          userLatitude: -6.2099,
          userLongitude: 106.8497,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create new report and materialize into StationLiveStatus for DELAY', async () => {
      mockTx.disruptionReport.findFirst.mockResolvedValue(null);

      const result = await service.createReport('user-456', {
        stationId: 'station-manggarai',
        category: ReportCategory.DELAY,
        subCategory: ReportSubCategory.MAJOR,
        lineId: 'krl-bogor',
        destinationStationId: 'station-bogor',
        userLatitude: -6.2099,
        userLongitude: 106.8497,
        note: 'Antrean panjang kereta',
      });

      expect(result.status).toBe('SUCCESS');
      expect(mockTx.disruptionReport.create).toHaveBeenCalled();
      expect(mockTx.stationLiveStatus.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stationId: 'station-manggarai' },
        }),
      );
    });

    it('should return ALREADY_REPORTED for duplicate DELAY within window', async () => {
      mockTx.disruptionReport.findFirst.mockResolvedValue(mockReport);

      const result = await service.createReport('user-456', {
        stationId: 'station-manggarai',
        category: ReportCategory.DELAY,
        subCategory: ReportSubCategory.MAJOR,
        lineId: 'krl-bogor',
        destinationStationId: 'station-bogor',
        userLatitude: -6.2099,
        userLongitude: 106.8497,
      });

      expect(result.status).toBe('ALREADY_REPORTED');
      expect(mockTx.disruptionReport.create).not.toHaveBeenCalled();
    });

    it('should adjust CROWD counters when user changes vote within 15m window', async () => {
      const existingCrowdReport = {
        ...mockReport,
        category: ReportCategory.CROWD,
        subCategory: ReportSubCategory.LOW,
      };
      mockTx.disruptionReport.findFirst.mockResolvedValue(existingCrowdReport);
      mockTx.stationLiveStatus.findUnique.mockResolvedValue({
        stationId: 'station-manggarai',
        crowdState: { low: 1, medium: 0, high: 0, very_high: 0 },
      });

      const result = await service.createReport('user-456', {
        stationId: 'station-manggarai',
        category: ReportCategory.CROWD,
        subCategory: ReportSubCategory.HIGH,
        userLatitude: -6.2099,
        userLongitude: 106.8497,
      });

      expect(result.status).toBe('SUCCESS');
      expect(result.action).toBe('CROWD_VOTE_UPDATED');
      expect(mockTx.stationLiveStatus.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            crowdState: expect.objectContaining({
              low: 0,
              high: 1,
            }),
          }),
        }),
      );
    });

    it('should flip FACILITY to BROKEN when reportCount reaches 3', async () => {
      mockTx.disruptionReport.findFirst.mockResolvedValue(null);
      mockTx.stationLiveStatus.findUnique.mockResolvedValue({
        stationId: 'station-manggarai',
        facilityState: {
          ESCALATOR: { reportCount: 2, status: 'PENDING_QUORUM' },
        },
      });

      await service.createReport('user-456', {
        stationId: 'station-manggarai',
        category: ReportCategory.FACILITY,
        subCategory: ReportSubCategory.ESCALATOR,
        userLatitude: -6.2099,
        userLongitude: 106.8497,
        note: 'Eskalator peron 3 mati',
      });

      expect(mockTx.stationLiveStatus.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            facilityState: expect.objectContaining({
              ESCALATOR: expect.objectContaining({
                reportCount: 3,
                status: 'BROKEN',
              }),
            }),
          }),
        }),
      );
    });
  });

  describe('getGlobalFeed', () => {
    it('should return flattened alert cards for active non-expired disruptions', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      mockPrismaService.stationLiveStatus.findMany.mockResolvedValue([
        {
          stationId: 'station-manggarai',
          station: mockStation,
          updatedAt: new Date(),
          disruptionState: {
            FLOOD_WEATHER: {
              status: 'ACTIVE',
              reportCount: 5,
              expiresAt: futureDate,
              isSkippedOrClosed: true,
              topNote: 'Genangan air',
              affectedLineIds: ['krl-bogor'],
            },
            POWER_SIGNAL: {
              status: 'PENDING_QUORUM', // Should not be in global feed
              reportCount: 1,
              expiresAt: futureDate,
            },
          },
        },
      ]);

      const feed = await service.getGlobalFeed();
      expect(feed.length).toBe(1);
      expect(feed[0]).toMatchObject({
        stationId: 'station-manggarai',
        subCategory: ReportSubCategory.FLOOD_WEATHER,
        status: 'ACTIVE',
        isSkippedOrClosed: true,
        reportCount: 5,
      });
    });
  });
});
