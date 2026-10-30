import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StationsService } from '../stations/stations.service.js';
import { CreateReportDto } from './dto/create-report.dto.js';
import { QueryReportDto } from './dto/query-report.dto.js';
import { DisruptionReport } from '@prisma/client';

export interface DisruptionReportWithDistance extends DisruptionReport {
  distanceMeters?: number;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stationsService: StationsService,
  ) {}

  /**
   * Creates a new disruption report.
   * Validates that the report is submitted within the allowable radius of a station:
   * - If coordinates are provided without stationId: resolves the closest station and verifies it is within radius.
   * - If both stationId and coordinates are provided: verifies that user coordinates are within radius of that station.
   * - If stationId is provided without coordinates: validates station existence.
   */
  async createReport(
    userId: string,
    dto: CreateReportDto,
  ): Promise<DisruptionReportWithDistance> {
    const lat = dto.latitude ?? dto.userLatitude;
    const lon = dto.longitude ?? dto.userLongitude;
    const hasCoordinates = lat !== undefined || lon !== undefined;
    const hasStationId = Boolean(dto.stationId && dto.stationId.trim().length > 0);

    // Coordinate completeness check
    if ((lat !== undefined && lon === undefined) || (lat === undefined && lon !== undefined)) {
      throw new BadRequestException(
        'Both latitude and longitude must be provided for location verification.',
      );
    }

    // Must provide either stationId or coordinates
    if (!hasStationId && !hasCoordinates) {
      throw new BadRequestException(
        'Either stationId or user location coordinates (latitude and longitude) must be provided.',
      );
    }

    const radius = dto.radius ?? 500;
    let targetStationId: string;
    let resolvedDistance: number | undefined;

    if (hasCoordinates && !hasStationId) {
      // Find nearest station and check if it is within radius
      const nearbyResult = await this.stationsService.findNearby({
        latitude: lat!,
        longitude: lon!,
        radius,
      });

      if (!nearbyResult.closestStation) {
        throw new NotFoundException('No stations registered in the transit network.');
      }

      if (!nearbyResult.isWithinStationRadius) {
        throw new BadRequestException(
          `You are not within the required ${radius}m radius of any station. Closest station is "${nearbyResult.closestStation.name}" (${nearbyResult.closestStation.distanceMeters}m away). Live disruption reports can only be submitted near a station.`,
        );
      }

      targetStationId = nearbyResult.closestStation.id;
      resolvedDistance = nearbyResult.closestStation.distanceMeters;
    } else if (hasCoordinates && hasStationId) {
      // Station specified with user coordinates: verify distance to this station
      const station = await this.stationsService.findOne(dto.stationId!.trim());
      const distanceMeters = this.stationsService.calculateHaversineDistanceMeters(
        lat!,
        lon!,
        station.latitude,
        station.longitude,
      );

      if (distanceMeters > radius) {
        throw new BadRequestException(
          `You are outside the required ${radius}m radius of station "${station.name}" (${distanceMeters}m away). Live disruption reports can only be submitted within station radius.`,
        );
      }

      targetStationId = station.id;
      resolvedDistance = distanceMeters;
    } else {
      // Station specified without coordinates (client previously verified proximity)
      const station = await this.stationsService.findOne(dto.stationId!.trim());
      targetStationId = station.id;
    }

    // Create report in database
    const report = await this.prisma.disruptionReport.create({
      data: {
        stationId: targetStationId,
        userId,
        title: dto.title.trim(),
        category: dto.category,
        impactLevel: dto.impactLevel,
        description: dto.description?.trim() || null,
      },
      include: {
        station: true,
      },
    });

    // Reward commuter with points (best-effort)
    if (userId) {
      await this.prisma.user
        .update({
          where: { id: userId },
          data: { points: { increment: 10 } },
        })
        .catch(() => null);
    }

    return {
      ...report,
      ...(resolvedDistance !== undefined ? { distanceMeters: resolvedDistance } : {}),
    };
  }

  /**
   * Fetches disruption reports with optional filtering.
   */
  async findAll(query?: QueryReportDto): Promise<DisruptionReport[]> {
    const where: any = {};
    if (query?.stationId) where.stationId = query.stationId;
    if (query?.category) where.category = query.category;
    if (query?.status) where.status = query.status;

    return this.prisma.disruptionReport.findMany({
      where,
      include: {
        station: true,
      },
      orderBy: { createdAt: 'desc' },
      take: query?.limit ?? 20,
      skip: query?.offset ?? 0,
    });
  }

  /**
   * Fetches a single disruption report by ID.
   */
  async findById(id: string): Promise<DisruptionReport> {
    const report = await this.prisma.disruptionReport.findUnique({
      where: { id },
      include: {
        station: true,
      },
    });

    if (!report) {
      throw new NotFoundException(`Disruption report with ID "${id}" was not found`);
    }

    return report;
  }

  /**
   * Fetches all disruption reports for a specific station.
   */
  async findByStationId(stationId: string): Promise<DisruptionReport[]> {
    await this.stationsService.findOne(stationId);

    return this.prisma.disruptionReport.findMany({
      where: { stationId },
      include: {
        station: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Toggles upvote on a disruption report.
   */
  async upvote(reportId: string, userId: string) {
    const report = await this.prisma.disruptionReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException(`Disruption report with ID "${reportId}" was not found`);
    }

    const existingUpvote = await this.prisma.upvote.findUnique({
      where: {
        reportId_userId: {
          reportId,
          userId,
        },
      },
    });

    if (existingUpvote) {
      await this.prisma.$transaction([
        this.prisma.upvote.delete({
          where: { id: existingUpvote.id },
        }),
        this.prisma.disruptionReport.update({
          where: { id: reportId },
          data: { upvoteCount: { decrement: 1 } },
        }),
      ]);
      return { upvoted: false, message: 'Upvote removed' };
    } else {
      await this.prisma.$transaction([
        this.prisma.upvote.create({
          data: {
            reportId,
            userId,
          },
        }),
        this.prisma.disruptionReport.update({
          where: { id: reportId },
          data: { upvoteCount: { increment: 1 } },
        }),
      ]);
      return { upvoted: true, message: 'Report upvoted successfully' };
    }
  }
}
