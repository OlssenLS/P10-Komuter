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

@Controller('report')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * POST /report
   * Atomic Event Sourcing + Materialized State Write Engine
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.OK)
  async createReport(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateReportDto,
  ) {
    const userId = req.user['id'];
    return this.reportsService.createReport(userId, dto);
  }

  /**
   * GET /report/feed/global
   * Returns active, non-expired disruption alert cards
   */
  @Get('feed/global')
  @HttpCode(HttpStatus.OK)
  async getGlobalFeed() {
    return this.reportsService.getGlobalFeed();
  }

  /**
   * GET /report
   * Retrieves disruption reports audit log with optional filtering.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: QueryReportDto) {
    return this.reportsService.findAll(query);
  }

  /**
   * GET /report/:id
   * Retrieves a single disruption report by ID.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findById(@Param('id') id: string) {
    return this.reportsService.findById(id);
  }
}

export { ReportsController as DisruptionsController };
