import { Test, TestingModule } from '@nestjs/testing';
import { StationsController } from './stations.controller.js';
import { StationsService } from './stations.service.js';
import { TransportType } from '@prisma/client';

describe('StationsController', () => {
  let controller: StationsController;

  const mockStationsService = {
    findNearby: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    findReports: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StationsController],
      providers: [
        {
          provide: StationsService,
          useValue: mockStationsService,
        },
      ],
    }).compile();

    controller = module.get<StationsController>(StationsController);
  });

  describe('findNearby', () => {
    it('should delegate to stationsService.findNearby with dto', async () => {
      const dto = {
        latitude: -6.2099,
        longitude: 106.8497,
        radius: 500,
      };

      const expectedResponse = {
        isWithinStationRadius: true,
        radiusMeters: 500,
        userLocation: { latitude: dto.latitude, longitude: dto.longitude },
        closestStation: {
          id: 'manggarai-1',
          name: 'Stasiun Manggarai',
          isTransitHub: true,
          supportedTypes: [TransportType.KRL],
          lineNames: ['Bogor Line'],
          latitude: -6.2099,
          longitude: 106.8497,
          distanceMeters: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        nearbyStations: [],
      };

      mockStationsService.findNearby.mockResolvedValue(expectedResponse);

      const result = await controller.findNearby(dto);
      expect(result).toBe(expectedResponse);
      expect(mockStationsService.findNearby).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should delegate to stationsService.findAll', async () => {
      mockStationsService.findAll.mockResolvedValue([]);
      const result = await controller.findAll();
      expect(result).toEqual([]);
      expect(mockStationsService.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should delegate to stationsService.findOne', async () => {
      const station = { id: 's-1', name: 'Manggarai' };
      mockStationsService.findOne.mockResolvedValue(station);
      const result = await controller.findOne('s-1');
      expect(result).toEqual(station);
      expect(mockStationsService.findOne).toHaveBeenCalledWith('s-1');
    });
  });

  describe('create', () => {
    it('should delegate to stationsService.create', async () => {
      const dto = {
        name: 'Stasiun Juanda',
        isTransitHub: false,
        supportedTypes: [TransportType.KRL],
        lineNames: ['Bogor Line'],
        latitude: -6.1666,
        longitude: 106.8306,
      };
      mockStationsService.create.mockResolvedValue({ id: 's-2', ...dto });
      const result = await controller.create(dto);
      expect(result).toEqual({ id: 's-2', ...dto });
      expect(mockStationsService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findReports', () => {
    it('should delegate to stationsService.findReports', async () => {
      const mockReports = [{ id: 'rep-1', title: 'Crowd' }];
      mockStationsService.findReports.mockResolvedValue(mockReports);

      const result = await controller.findReports('s-1');
      expect(result).toEqual(mockReports);
      expect(mockStationsService.findReports).toHaveBeenCalledWith('s-1');
    });
  });
});
