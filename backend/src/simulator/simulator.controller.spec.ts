import { Test, TestingModule } from '@nestjs/testing';
import { SimulatorController } from './simulator.controller.js';
import { SimulatorService } from './simulator.service.js';

describe('SimulatorController', () => {
  let controller: SimulatorController;

  const mockSimulatorService = {
    getTracks: vi.fn(),
    getSimulationTokens: vi.fn(),
    resetAllTestData: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SimulatorController],
      providers: [
        {
          provide: SimulatorService,
          useValue: mockSimulatorService,
        },
      ],
    }).compile();

    controller = module.get<SimulatorController>(SimulatorController);
  });

  it('should delegate getTracks', () => {
    mockSimulatorService.getTracks.mockReturnValue([{ line: 'Bogor Line', color: '#EF4444', stationNames: [] }]);
    const result = controller.getTracks();
    expect(result).toHaveLength(1);
    expect(mockSimulatorService.getTracks).toHaveBeenCalled();
  });

  it('should delegate getTokens', async () => {
    mockSimulatorService.getSimulationTokens.mockResolvedValue({ tokens: [] });
    const result = await controller.getTokens();
    expect(result).toEqual({ tokens: [] });
    expect(mockSimulatorService.getSimulationTokens).toHaveBeenCalled();
  });

  it('should delegate resetAll', async () => {
    mockSimulatorService.resetAllTestData.mockResolvedValue({ success: true, message: 'Reset ok', deletedReportsCount: 0 });
    const result = await controller.resetAll();
    expect(result.success).toBe(true);
    expect(mockSimulatorService.resetAllTestData).toHaveBeenCalled();
  });
});
