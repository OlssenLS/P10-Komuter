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
import { ReportsService } from './reports.service.js';
import { CreateReportDto } from './dto/create-report.dto.js';
import { QueryReportDto } from './dto/query-report.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
interface AuthenticatedRequest {
  user: {
    id: string;
    email?: string;
    username?: string;
  };
}

@Controller(['report', 'reports'])
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * POST /report or POST /reports
   * Creates a disruption report within the nearest station radius.
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createReport(@Req() req: AuthenticatedRequest, @Body() dto: CreateReportDto) {
    const userId = req.user['id'];
    return this.reportsService.createReport(userId, dto);
  }

  /**
   * GET /report/all or GET /reports/all
   * Filter global disruptions/events + destination-indexed line delays + local crowd status.
   */
  @Get('all')
  @HttpCode(HttpStatus.OK)
  async getAllReports(@Query() query: Record<string, string>) {
    return this.reportsService.getAllReports(query);
  }

  /**
   * GET /report/stations/:id/reports or GET /reports/stations/:id/reports
   * Return facility reports and station crowd stats.
   */
  @Get('stations/:id/reports')
  @HttpCode(HttpStatus.OK)
  async getStationReports(@Param('id') id: string) {
    return this.reportsService.getStationReports(id);
  }

  /**
   * GET /report or GET /reports
   * Retrieves disruption reports with optional filtering.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: QueryReportDto) {
    return this.reportsService.findAll(query);
  }

  /**
   * GET /report/:id or GET /reports/:id
   * Retrieves a single disruption report by ID.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findById(@Param('id') id: string) {
    return this.reportsService.findById(id);
  }

  /**
   * POST /report/:id/upvote or POST /reports/:id/upvote
   * Toggles upvote on a disruption report.
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/upvote')
  @HttpCode(HttpStatus.OK)
  async upvote(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const userId = req.user['id'];
    return this.reportsService.upvote(id, userId);
  }
}

export { ReportsController as DisruptionsController };
