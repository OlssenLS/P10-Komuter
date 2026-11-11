import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateReportDto } from './dto/create-report.dto.js';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async createReport(userId: string, dto: CreateReportDto) {
    const station = await this.prisma.station.findUnique({
      where: { id: dto.stationId },
    });
    if (!station) {
      throw new NotFoundException(`Station with ID ${dto.stationId} not found`);
    }

    return this.prisma.disruptionReport.create({
      data: {
        stationId: dto.stationId,
        userId,
        title: dto.title,
        category: dto.category,
        impactLevel: dto.impactLevel,
        description: dto.description,
      },
    });
  }

  async getStationReports(stationId: string) {
    return this.prisma.disruptionReport.findMany({
      where: { stationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll() {
    return this.prisma.disruptionReport.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        station: true,
      },
    });
  }
}
