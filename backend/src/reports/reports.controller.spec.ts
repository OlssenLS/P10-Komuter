import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { ReportCategory, DelayImpact, ReportStatus } from '@prisma/client';
import { Request } from 'express';

describe('ReportsController', () => {
  let controller: ReportsController;

  const mockReport = {
    id: 'report-1',
    stationId: 'manggarai-1',
    userId: 'user-123',
    title: 'Platform 3 Overcrowded',
    category: ReportCategory.CROWD,
    status: ReportStatus.NEW,
    impactLevel: DelayImpact.STATION_ONLY,
    description: 'Heavy passenger density',
    upvoteCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockReportsService = {
    createReport: vi.fn(),
    getStationReports: vi.fn(),
    findAll: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: mockReportsService,
        },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
  });

  describe('createReport', () => {
    it('should delegate report creation to reportsService with user id and dto', async () => {
      mockReportsService.createReport.mockResolvedValue(mockReport);

      const dto = {
        stationId: 'manggarai-1',
        title: 'Platform 3 Overcrowded',
        category: ReportCategory.CROWD,
        impactLevel: DelayImpact.STATION_ONLY,
        description: 'Heavy passenger density',
      };

      const req = {
        user: {
          id: 'user-123',
          email: 'commuter@example.com',
          username: 'commuter',
        },
      } as unknown as Request & { user: { id: string; email: string; username: string } };

      const result = await controller.createReport(req, dto);

      expect(mockReportsService.createReport).toHaveBeenCalledWith('user-123', dto);
      expect(result).toEqual(mockReport);
    });
  });

  describe('getStationReports', () => {
    it('should delegate to reportsService.getStationReports with station id', async () => {
      mockReportsService.getStationReports.mockResolvedValue([mockReport]);

      const result = await controller.getStationReports('manggarai-1');

      expect(mockReportsService.getStationReports).toHaveBeenCalledWith('manggarai-1');
      expect(result).toEqual([mockReport]);
    });
  });

  describe('findAll', () => {
    it('should delegate to reportsService.findAll', async () => {
      mockReportsService.findAll.mockResolvedValue([mockReport]);

      const result = await controller.findAll();

      expect(mockReportsService.findAll).toHaveBeenCalled();
      expect(result).toEqual([mockReport]);
    });
  });
});
