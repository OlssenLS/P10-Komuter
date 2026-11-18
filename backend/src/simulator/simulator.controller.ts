import {
  Controller,
  Get,
  Post,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { SimulatorService } from './simulator.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

@Controller(['simulator', 'simulation'])
export class SimulatorController {
  private readonly logger = new Logger(SimulatorController.name);

  constructor(private readonly simulatorService: SimulatorService) {}

  /**
   * GET /simulator
   * Serves the single self-contained interactive transit graph simulator
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  serveSimulatorHtml(@Res() res: Response) {
    const candidates = [
      path.resolve(process.cwd(), 'public', 'simulator.html'),
      path.resolve(process.cwd(), 'backend', 'public', 'simulator.html'),
      path.resolve(__dirname, '..', '..', 'public', 'simulator.html'),
    ];

    let foundPath: string | null = null;
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        foundPath = c;
        break;
      }
    }

    if (!foundPath) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .type('html')
        .send(
          '<h3>simulator.html not found. Please ensure backend/public/simulator.html exists.</h3>',
        );
    }

    const htmlContent = fs.readFileSync(foundPath, 'utf8');
    res.type('html').send(htmlContent);
  }

  /**
   * GET /simulator/tracks
   * Returns railway tracks and station sequences for map rendering
   */
  @Get('tracks')
  @HttpCode(HttpStatus.OK)
  getTracks() {
    return this.simulatorService.getTracks();
  }

  /**
   * GET /simulator/tokens
   * Returns 3 valid JWT tokens for simulation test commuters
   */
  @Get('tokens')
  @HttpCode(HttpStatus.OK)
  async getTokens() {
    return this.simulatorService.getSimulationTokens();
  }

  /**
   * POST /simulator/reset
   * Wipes all disruption reports and resets station live statuses
   */
  @Post('reset')
  @HttpCode(HttpStatus.OK)
  async resetAll() {
    return this.simulatorService.resetAllTestData();
  }
}
