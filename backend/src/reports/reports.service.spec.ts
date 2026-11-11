import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReportCategory, DelayImpact, ReportStatus } from '@prisma/client';

describe('ReportsService', () => {
  let service: ReportsService;

  const mockStation = {
    id: 'manggarai-1',
    name: 'Stasiun Manggarai',
    isTransitHub: true,
    latitude: -6.2099,
    longitude: 106.8497,
  };

  const mockReport = {
    id: 'report-1',
    stationId: 'manggarai-1',
    userId: 'user-123',
    title: 'Platform 3 Overcrowded',
    category: ReportCategory.CROWD,
    status: ReportStatus.NEW,
    impactLevel: DelayImpact.STATION_ONLY,
    description: 'Heavy passenger density at stairs',
    upvoteCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    station: {
      findUnique: vi.fn(),
    },
    disruptionReport: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  describe('createReport', () => {
    it('should create a disruption report when station exists', async () => {
      mockPrismaService.station.findUnique.mockResolvedValue(mockStation);
      mockPrismaService.disruptionReport.create.mockResolvedValue(mockReport);

      const result = await service.createReport('user-123', {
        stationId: 'manggarai-1',
        title: 'Platform 3 Overcrowded',
        category: ReportCategory.CROWD,
        impactLevel: DelayImpact.STATION_ONLY,
        description: 'Heavy passenger density at stairs',
      });

      expect(mockPrismaService.station.findUnique).toHaveBeenCalledWith({
        where: { id: 'manggarai-1' },
      });
      expect(mockPrismaService.disruptionReport.create).toHaveBeenCalledWith({
        data: {
          stationId: 'manggarai-1',
          userId: 'user-123',
          title: 'Platform 3 Overcrowded',
          category: ReportCategory.CROWD,
          impactLevel: DelayImpact.STATION_ONLY,
          description: 'Heavy passenger density at stairs',
        },
      });
      expect(result).toEqual(mockReport);
    });

    it('should throw NotFoundException when station does not exist', async () => {
      mockPrismaService.station.findUnique.mockResolvedValue(null);

      await expect(
        service.createReport('user-123', {
          stationId: 'non-existent',
          title: 'Some issue',
          category: ReportCategory.DELAY,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStationReports', () => {
    it('should return disruption reports for a station', async () => {
      mockPrismaService.disruptionReport.findMany.mockResolvedValue([mockReport]);

      const result = await service.getStationReports('manggarai-1');

      expect(mockPrismaService.disruptionReport.findMany).toHaveBeenCalledWith({
        where: { stationId: 'manggarai-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([mockReport]);
    });
  });

  describe('findAll', () => {
    it('should return all disruption reports', async () => {
      mockPrismaService.disruptionReport.findMany.mockResolvedValue([mockReport]);

      const result = await service.findAll();

      expect(mockPrismaService.disruptionReport.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        include: { station: true },
      });
      expect(result).toEqual([mockReport]);
    });
  });
});
