import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StationsService } from '../stations/stations.service.js';
import { ReportCategory, DelayImpact, ReportStatus, TransportType } from '@prisma/client';

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
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockReport = {
    id: 'report-123',
    stationId: 'station-manggarai',
    userId: 'user-456',
    title: 'Severe train delay',
    category: ReportCategory.DELAY,
    status: ReportStatus.NEW,
    impactLevel: DelayImpact.ENTIRE_LINE,
    description: 'Track maintenance issue',
    upvoteCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    station: mockStation,
  };

  const mockPrismaService = {
    disruptionReport: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    upvote: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      update: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn((operations) => Promise.all(operations)),
  };

  const mockStationsService = {
    findNearby: vi.fn(),
    findOne: vi.fn(),
    calculateHaversineDistanceMeters: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StationsService, useValue: mockStationsService },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    stationsService = module.get<StationsService>(StationsService);
  });

  describe('createReport', () => {
    it('should successfully create a report by resolving the nearest station when coordinates are provided within radius', async () => {
      mockStationsService.findNearby.mockResolvedValue({
        isWithinStationRadius: true,
        radiusMeters: 500,
        userLocation: { latitude: -6.2099, longitude: 106.8497 },
        closestStation: {
          ...mockStation,
          distanceMeters: 25,
        },
        nearbyStations: [{ ...mockStation, distanceMeters: 25 }],
      });

      mockPrismaService.disruptionReport.create.mockResolvedValue(mockReport);

      const result = await service.createReport('user-456', {
        title: 'Severe train delay',
        category: ReportCategory.DELAY,
        impactLevel: DelayImpact.ENTIRE_LINE,
        description: 'Track maintenance issue',
        latitude: -6.2099,
        longitude: 106.8497,
      });

      expect(stationsService.findNearby).toHaveBeenCalledWith({
        latitude: -6.2099,
        longitude: 106.8497,
        radius: 500,
      });
      expect(mockPrismaService.disruptionReport.create).toHaveBeenCalledWith({
        data: {
          stationId: 'station-manggarai',
          userId: 'user-456',
          title: 'Severe train delay',
          category: ReportCategory.DELAY,
          impactLevel: DelayImpact.ENTIRE_LINE,
          description: 'Track maintenance issue',
        },
        include: { station: true },
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-456' },
        data: { points: { increment: 10 } },
      });
      expect(result.id).toBe('report-123');
      expect(result.distanceMeters).toBe(25);
    });

    it('should reject report creation if user is outside allowable radius (> 500m)', async () => {
      mockStationsService.findNearby.mockResolvedValue({
        isWithinStationRadius: false,
        radiusMeters: 500,
        userLocation: { latitude: -6.3000, longitude: 106.8497 },
        closestStation: {
          ...mockStation,
          distanceMeters: 10020,
        },
        nearbyStations: [],
      });

      await expect(
        service.createReport('user-456', {
          title: 'Far report',
          category: ReportCategory.CROWD,
          latitude: -6.3000,
          longitude: 106.8497,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.disruptionReport.create).not.toHaveBeenCalled();
    });

    it('should verify station distance if both stationId and coordinates are provided', async () => {
      mockStationsService.findOne.mockResolvedValue(mockStation);
      mockStationsService.calculateHaversineDistanceMeters.mockReturnValue(120);
      mockPrismaService.disruptionReport.create.mockResolvedValue(mockReport);

      const result = await service.createReport('user-456', {
        stationId: 'station-manggarai',
        title: 'Platform crowd',
        category: ReportCategory.CROWD,
        latitude: -6.2105,
        longitude: 106.8497,
      });

      expect(stationsService.findOne).toHaveBeenCalledWith('station-manggarai');
      expect(stationsService.calculateHaversineDistanceMeters).toHaveBeenCalledWith(
        -6.2105,
        106.8497,
        mockStation.latitude,
        mockStation.longitude,
      );
      expect(result.distanceMeters).toBe(120);
    });

    it('should reject if user provides stationId and coordinates that exceed radius', async () => {
      mockStationsService.findOne.mockResolvedValue(mockStation);
      mockStationsService.calculateHaversineDistanceMeters.mockReturnValue(850);

      await expect(
        service.createReport('user-456', {
          stationId: 'station-manggarai',
          title: 'Too far',
          category: ReportCategory.CROWD,
          latitude: -6.2200,
          longitude: 106.8497,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.disruptionReport.create).not.toHaveBeenCalled();
    });

    it('should create report directly when stationId is provided without coordinates', async () => {
      mockStationsService.findOne.mockResolvedValue(mockStation);
      mockPrismaService.disruptionReport.create.mockResolvedValue(mockReport);

      const result = await service.createReport('user-456', {
        stationId: 'station-manggarai',
        title: 'Direct report with verified station',
        category: ReportCategory.FACILITY,
      });

      expect(stationsService.findOne).toHaveBeenCalledWith('station-manggarai');
      expect(mockPrismaService.disruptionReport.create).toHaveBeenCalled();
      expect(result.id).toBe('report-123');
    });

    it('should throw BadRequestException if neither stationId nor coordinates are provided', async () => {
      await expect(
        service.createReport('user-456', {
          title: 'Missing station info',
          category: ReportCategory.EVENT,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if only latitude is provided without longitude', async () => {
      await expect(
        service.createReport('user-456', {
          title: 'Partial coordinates',
          category: ReportCategory.DELAY,
          latitude: -6.2099,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if no stations exist in system', async () => {
      mockStationsService.findNearby.mockResolvedValue({
        isWithinStationRadius: false,
        radiusMeters: 500,
        userLocation: { latitude: -6.2099, longitude: 106.8497 },
        closestStation: null,
        nearbyStations: [],
      });

      await expect(
        service.createReport('user-456', {
          title: 'No stations',
          category: ReportCategory.DELAY,
          latitude: -6.2099,
          longitude: 106.8497,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return reports matching filter query', async () => {
      mockPrismaService.disruptionReport.findMany.mockResolvedValue([mockReport]);

      const result = await service.findAll({
        stationId: 'station-manggarai',
        category: ReportCategory.DELAY,
        limit: 10,
        offset: 0,
      });

      expect(mockPrismaService.disruptionReport.findMany).toHaveBeenCalledWith({
        where: {
          stationId: 'station-manggarai',
          category: ReportCategory.DELAY,
        },
        include: { station: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 0,
      });
      expect(result).toEqual([mockReport]);
    });
  });

  describe('findById', () => {
    it('should return single report by ID', async () => {
      mockPrismaService.disruptionReport.findUnique.mockResolvedValue(mockReport);

      const result = await service.findById('report-123');
      expect(result).toEqual(mockReport);
    });

    it('should throw NotFoundException if report not found', async () => {
      mockPrismaService.disruptionReport.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByStationId', () => {
    it('should return reports for station after verifying station exists', async () => {
      mockStationsService.findOne.mockResolvedValue(mockStation);
      mockPrismaService.disruptionReport.findMany.mockResolvedValue([mockReport]);

      const result = await service.findByStationId('station-manggarai');
      expect(stationsService.findOne).toHaveBeenCalledWith('station-manggarai');
      expect(result).toEqual([mockReport]);
    });
  });

  describe('upvote', () => {
    it('should add upvote when not previously upvoted', async () => {
      mockPrismaService.disruptionReport.findUnique.mockResolvedValue(mockReport);
      mockPrismaService.upvote.findUnique.mockResolvedValue(null);

      const result = await service.upvote('report-123', 'user-456');

      expect(result).toEqual({ upvoted: true, message: 'Report upvoted successfully' });
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should remove upvote when already upvoted', async () => {
      mockPrismaService.disruptionReport.findUnique.mockResolvedValue(mockReport);
      mockPrismaService.upvote.findUnique.mockResolvedValue({
        id: 'upvote-1',
        reportId: 'report-123',
        userId: 'user-456',
      });

      const result = await service.upvote('report-123', 'user-456');

      expect(result).toEqual({ upvoted: false, message: 'Upvote removed' });
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if report not found', async () => {
      mockPrismaService.disruptionReport.findUnique.mockResolvedValue(null);

      await expect(service.upvote('report-missing', 'user-456')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
