import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { ReportCategory, ReportSubCategory, ReportStatus } from '@prisma/client';

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: ReportsService;

  const mockReport = {
    id: 'report-123',
    stationId: 'station-manggarai',
    userId: 'user-456',
    category: ReportCategory.DELAY,
    subCategory: ReportSubCategory.MAJOR,
    note: 'Track maintenance issue',
    status: ReportStatus.ACTIVE,
    isSkippedOrClosed: false,
    isResolution: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockReportsService = {
    createReport: vi.fn(),
    getGlobalFeed: vi.fn(),
    getAllReports: vi.fn(),
    getStationReports: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
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
        stationId: 'station-manggarai',
        category: ReportCategory.DELAY,
        subCategory: ReportSubCategory.MAJOR,
        userLatitude: -6.2099,
        userLongitude: 106.8497,
        note: 'Track maintenance issue',
      };

      mockReportsService.createReport.mockResolvedValue({
        status: 'SUCCESS',
        report: mockReport,
      });

      const result = await controller.createReport(mockReq, dto);

      expect(service.createReport).toHaveBeenCalledWith('user-456', dto);
      expect(result).toEqual({
        status: 'SUCCESS',
        report: mockReport,
      });
    });
  });

  describe('getGlobalFeed', () => {
    it('should delegate to reportsService.getGlobalFeed', async () => {
      mockReportsService.getGlobalFeed.mockResolvedValue([]);
      const result = await controller.getGlobalFeed();
      expect(service.getGlobalFeed).toHaveBeenCalled();
      expect(result).toEqual([]);
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
});
