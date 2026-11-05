import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StationsService } from '../stations/stations.service.js';
import { CreateReportDto } from './dto/create-report.dto.js';
import { QueryReportDto } from './dto/query-report.dto.js';
import {
  DisruptionReport,
  ReportCategory,
  ReportSubCategory,
  ReportStatus,
  ReportVisibility,
  TrackDirectionScope,
} from '@prisma/client';

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

    // Initial TTL calculation per category rules:
    // Crowd = 15m, Delay = 30m, Disruption/Event = 12-24h (24h), Facility = 7d
    const now = new Date();
    let ttlMs = 30 * 60 * 1000;
    switch (dto.category) {
      case ReportCategory.CROWD:
        ttlMs = 15 * 60 * 1000;
        break;
      case ReportCategory.DELAY:
        ttlMs = 30 * 60 * 1000;
        break;
      case ReportCategory.DISRUPTION:
      case ReportCategory.EVENT:
        ttlMs = 24 * 60 * 60 * 1000;
        break;
      case ReportCategory.FACILITY:
        ttlMs = 7 * 24 * 60 * 60 * 1000;
        break;
    }
    const expiresAt = new Date(now.getTime() + ttlMs);

    // Map visibility per category
    let visibility: ReportVisibility = ReportVisibility.LOCAL_CONTEXTUAL;
    if (dto.category === ReportCategory.DELAY) {
      visibility = ReportVisibility.LINE_TARGETED;
    } else if (
      dto.category === ReportCategory.DISRUPTION ||
      dto.category === ReportCategory.EVENT
    ) {
      visibility = ReportVisibility.GLOBAL;
    }

    const subCategory = dto.subCategory ?? dto.severity ?? null;
    const trackScope = dto.trackScope ?? TrackDirectionScope.DIRECTIONAL;

    const createData: any = {
      stationId: targetStationId,
      userId,
      title: dto.title.trim(),
      category: dto.category,
      impactLevel: dto.impactLevel,
      description: dto.description?.trim() || null,
      trackScope,
      destinationStationId: dto.destinationStationId ?? null,
      destinationLabel: dto.destinationLabel?.trim() ?? null,
      visibility,
      expiresAt,
    };

    if (subCategory) {
      createData.subCategory = subCategory;
    }
    if (lat !== undefined) {
      createData.userLatitude = lat;
    }
    if (lon !== undefined) {
      createData.userLongitude = lon;
    }

    // Create report in database
    const report = await this.prisma.disruptionReport.create({
      data: createData,
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
      const currentCount = report.upvoteCount ?? 0;
      const newUpvoteCount = currentCount + 1;
      const updateData: any = {
        upvoteCount: { increment: 1 },
      };

      // Mark status as VERIFIED when upvotes >= 10
      if (newUpvoteCount >= 10) {
        updateData.status = ReportStatus.VERIFIED;
        updateData.verifiedAt = new Date();
      }

      // Extend TTL for DELAY reports (15m extension)
      if (report.category === ReportCategory.DELAY) {
        const baseTime =
          report.expiresAt && new Date(report.expiresAt).getTime() > Date.now()
            ? new Date(report.expiresAt).getTime()
            : Date.now();
        updateData.expiresAt = new Date(baseTime + 15 * 60 * 1000);
      }

      await this.prisma.$transaction([
        this.prisma.upvote.create({
          data: {
            reportId,
            userId,
          },
        }),
        this.prisma.disruptionReport.update({
          where: { id: reportId },
          data: updateData,
        }),
      ]);
      return { upvoted: true, message: 'Report upvoted successfully' };
    }
  }

  /**
   * GET /report/all
   * Filter global disruptions/events + destination-indexed line delays + local crowd status.
   */
  async getAllReports(query?: {
    stationId?: string;
    lineId?: string;
    destinationStationId?: string;
  }) {
    const now = new Date();
    const activeReports = await this.prisma.disruptionReport.findMany({
      where: {
        status: { not: ReportStatus.EXPIRED },
        OR: [{ expiresAt: { gt: now } }, { expiresAt: null }],
      },
      include: {
        station: true,
        destinationStation: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // 1. Filter global disruptions/events (DISRUPTION, EVENT, or GLOBAL visibility)
    const globalDisruptions = activeReports.filter(
      (r) =>
        r.category === ReportCategory.DISRUPTION ||
        r.category === ReportCategory.EVENT ||
        r.visibility === ReportVisibility.GLOBAL,
    );

    // 2. Destination-indexed line delays (DELAY category)
    let lineDelays = activeReports.filter((r) => r.category === ReportCategory.DELAY);
    if (query?.lineId) {
      lineDelays = lineDelays.filter((r) => r.lineId === query.lineId);
    }
    if (query?.destinationStationId) {
      lineDelays = lineDelays.filter(
        (r) => r.destinationStationId === query.destinationStationId,
      );
    }

    const destinationIndexedDelays: Record<string, DisruptionReport[]> = {};
    for (const delay of lineDelays) {
      const key = delay.destinationStationId || delay.destinationLabel || 'unspecified';
      if (!destinationIndexedDelays[key]) {
        destinationIndexedDelays[key] = [];
      }
      destinationIndexedDelays[key].push(delay);
    }

    // 3. Local crowd status (CROWD category)
    let crowdReports = activeReports.filter((r) => r.category === ReportCategory.CROWD);
    if (query?.stationId) {
      crowdReports = crowdReports.filter((r) => r.stationId === query.stationId);
    }

    return {
      globalDisruptions,
      lineDelays,
      destinationIndexedDelays,
      crowdStatus: crowdReports,
      reports: activeReports,
    };
  }

  /**
   * GET /stations/:id/reports
   * Return facility reports and station crowd stats.
   */
  async getStationReports(stationId: string) {
    const station = await this.stationsService.findOne(stationId);

    const reports = await this.prisma.disruptionReport.findMany({
      where: {
        stationId,
        status: { not: ReportStatus.EXPIRED },
      },
      include: {
        station: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Facility reports
    const facilityReports = reports.filter(
      (r) => r.category === ReportCategory.FACILITY,
    );

    // Crowd reports & stats
    const crowdReports = reports.filter((r) => r.category === ReportCategory.CROWD);
    const now = Date.now();
    const recentCrowd = crowdReports.filter(
      (r) => now - new Date(r.createdAt).getTime() <= 30 * 60 * 1000,
    );

    const breakdown = {
      low: 0,
      normal: 0,
      high: 0,
      crowdOverflow: 0,
    };

    for (const r of recentCrowd) {
      if (r.subCategory === ReportSubCategory.LOW) breakdown.low++;
      else if (r.subCategory === ReportSubCategory.NORMAL) breakdown.normal++;
      else if (r.subCategory === ReportSubCategory.HIGH) breakdown.high++;
      else if (r.subCategory === ReportSubCategory.CROWD_OVERFLOW) breakdown.crowdOverflow++;
    }

    const totalRecent = recentCrowd.length;
    const highRatio =
      totalRecent > 0 ? (breakdown.high + breakdown.crowdOverflow) / totalRecent : 0;
    const isCrowdOverflow = totalRecent > 0 && highRatio >= 0.8;

    let currentCrowdLevel: ReportSubCategory = ReportSubCategory.NORMAL;
    if (breakdown.crowdOverflow > 0 || isCrowdOverflow) {
      currentCrowdLevel = ReportSubCategory.CROWD_OVERFLOW;
    } else if (breakdown.high > breakdown.normal && breakdown.high > breakdown.low) {
      currentCrowdLevel = ReportSubCategory.HIGH;
    } else if (breakdown.low > breakdown.normal && breakdown.low > breakdown.high) {
      currentCrowdLevel = ReportSubCategory.LOW;
    }

    const crowdStats = {
      stationId: station.id,
      stationName: station.name,
      totalReports: crowdReports.length,
      recentReportsCount: totalRecent,
      currentCrowdLevel,
      isCrowdOverflow,
      breakdown,
      recentCrowdReports: recentCrowd,
    };

    return {
      station: {
        id: station.id,
        name: station.name,
      },
      facilityReports,
      crowdStats,
      reports,
    };
  }
}

export { ReportsService as DisruptionsService };
