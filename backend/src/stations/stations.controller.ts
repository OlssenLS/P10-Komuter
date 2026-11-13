import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StationsService } from './stations.service.js';
import { NearbyStationsDto } from './dto/nearby-stations.dto.js';
import { CreateStationDto } from './dto/create-station.dto.js';
import { ResolveIssueDto } from './dto/resolve-issue.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

interface AuthenticatedRequest {
  user: {
    id: string;
    email?: string;
    username?: string;
  };
}

@Controller('stations')
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}

  @Post('nearby')
  @HttpCode(HttpStatus.OK)
  async findNearby(@Body() dto: NearbyStationsDto) {
    return this.stationsService.findNearby(dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll() {
    return this.stationsService.findAll();
  }

  /**
   * GET /stations/:id/status
   * Clean O(1) Read Endpoint:
   * Returns { station, crowd, delays, facilities, disruptions }
   */
  @Get(':id/status')
  @HttpCode(HttpStatus.OK)
  async getStatus(@Param('id') id: string) {
    return this.stationsService.getStationStatus(id);
  }

  /**
   * POST /stations/:id/resolve
   * Symmetric Resolution Endpoint:
   * Accepts { category, targetKey }
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  async resolveIssue(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ResolveIssueDto,
  ) {
    const userId = req.user['id'];
    return this.stationsService.resolveStationIssue(id, userId, dto);
  }

  /**
   * GET /stations/:id
   * Canonical Endpoint: Returns full station profile + clean O(1) live status
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string) {
    return this.stationsService.getStationStatus(id);
  }

  @Get(':id/reports')
  @HttpCode(HttpStatus.OK)
  async findReports(@Param('id') id: string) {
    return this.stationsService.findReports(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateStationDto) {
    return this.stationsService.create(dto);
  }
}
