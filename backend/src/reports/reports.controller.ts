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
import { Request } from 'express';
import { ReportsService } from './reports.service.js';
import { CreateReportDto } from './dto/create-report.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    username: string;
    role?: string;
  };
}

@Controller()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('reports')
  @HttpCode(HttpStatus.CREATED)
  async createReport(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateReportDto,
  ) {
    return this.reportsService.createReport(req.user.id, dto);
  }

  @Get('stations/:id/reports')
  @HttpCode(HttpStatus.OK)
  async getStationReports(@Param('id') id: string) {
    return this.reportsService.getStationReports(id);
  }

  @Get('reports')
  @HttpCode(HttpStatus.OK)
  async findAll() {
    return this.reportsService.findAll();
  }
}
