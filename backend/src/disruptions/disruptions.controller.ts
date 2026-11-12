import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DisruptionsService } from './disruptions.service.js';
import { CreateReportDto } from './dto/create-report.dto.js';
import { QueryReportDto } from '../reports/dto/query-report.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller(['report', 'reports', 'disruptions'])
export class DisruptionsController {
  constructor(private readonly disruptionsService: DisruptionsService) {}

  /**
   * POST /report
   * Creates a disruption report within the nearest station radius.
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createReport(@Req() req: any, @Body() dto: CreateReportDto) {
    const userId = req.user['id'];
    return this.disruptionsService.createReport(userId, dto);
  }

  /**
   * GET /report/all
   * Filter global disruptions/events + destination-indexed line delays + local crowd status.
   */
  @Get('all')
  @HttpCode(HttpStatus.OK)
  async getAllReports(@Query() query: any) {
    return this.disruptionsService.getAllReports(query);
  }

  /**
   * GET /stations/:id/reports
   * Return facility reports and station crowd stats.
   */
  @Get('stations/:id/reports')
  @HttpCode(HttpStatus.OK)
  async getStationReports(@Param('id') stationId: string) {
    return this.disruptionsService.getStationReports(stationId);
  }

  /**
   * GET /report
   * Retrieves disruption reports with optional filtering.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: QueryReportDto) {
    return this.disruptionsService.findAll(query);
  }

  /**
   * GET /report/:id
   * Retrieves a single disruption report by ID.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findById(@Param('id') id: string) {
    return this.disruptionsService.findById(id);
  }

  /**
   * POST /report/:id/upvote
   * Handle upvotes, extend TTL for DELAY reports, and mark status as VERIFIED when upvotes >= 10.
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/upvote')
  @HttpCode(HttpStatus.OK)
  async upvote(@Req() req: any, @Param('id') id: string) {
    const userId = req.user['id'];
    return this.disruptionsService.upvote(id, userId);
  }
}
