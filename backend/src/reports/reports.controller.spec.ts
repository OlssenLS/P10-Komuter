import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { ReportCategory, DelayImpact, ReportStatus } from '@prisma/client';

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: ReportsService;

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
  };

  const mockReportsService = {
    createReport: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    findByStationId: vi.fn(),
    upvote: vi.fn(),
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
    service = module.get<ReportsService>(ReportsService);
  });

  describe('createReport', () => {
    it('should delegate report creation with authenticated userId from req', async () => {
      const mockReq = { user: { id: 'user-456' } };
      const dto = {
        title: 'Severe train delay',
        category: ReportCategory.DELAY,
        impactLevel: DelayImpact.ENTIRE_LINE,
        latitude: -6.2099,
        longitude: 106.8497,
      };

      mockReportsService.createReport.mockResolvedValue(mockReport);

      const result = await controller.createReport(mockReq, dto);

      expect(service.createReport).toHaveBeenCalledWith('user-456', dto);
      expect(result).toEqual(mockReport);
    });
  });

  describe('findAll', () => {
    it('should delegate to reportsService.findAll', async () => {
      const query = {
        stationId: 'station-manggarai',
        category: ReportCategory.DELAY,
      };

      mockReportsService.findAll.mockResolvedValue([mockReport]);

      const result = await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual([mockReport]);
    });
  });

  describe('findById', () => {
    it('should delegate to reportsService.findById', async () => {
      mockReportsService.findById.mockResolvedValue(mockReport);

      const result = await controller.findById('report-123');

      expect(service.findById).toHaveBeenCalledWith('report-123');
      expect(result).toEqual(mockReport);
    });
  });

  describe('upvote', () => {
    it('should delegate upvoting with userId from request', async () => {
      const mockReq = { user: { id: 'user-456' } };
      mockReportsService.upvote.mockResolvedValue({
        upvoted: true,
        message: 'Report upvoted successfully',
      });

      const result = await controller.upvote(mockReq, 'report-123');

      expect(service.upvote).toHaveBeenCalledWith('report-123', 'user-456');
      expect(result).toEqual({ upvoted: true, message: 'Report upvoted successfully' });
    });
  });
});
