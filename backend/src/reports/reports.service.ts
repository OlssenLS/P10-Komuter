import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StationsService } from '../stations/stations.service.js';
import {
  CreateReportDto,
  CategorySubCategoryMap,
} from './dto/create-report.dto.js';
import { QueryReportDto } from './dto/query-report.dto.js';
import {
  DisruptionReport,
  ReportCategory,
  ReportSubCategory,
  ReportStatus,
} from '@prisma/client';

export interface DisruptionAlertCard {
  id: string;
  stationId: string;
  stationName: string;
  category: ReportCategory;
  subCategory: ReportSubCategory;
  headline: string;
  isSkippedOrClosed: boolean;
  reportCount: number;
  topNote: string | null;
  topNotes: string[];
  affectedLineIds: string[];
  status: 'ACTIVE';
  startedAt?: string;
  expiresAt: string;
  updatedAt: Date;
}

const TTL_MAP: Record<ReportCategory, number> = {
  [ReportCategory.CROWD]: 15 * 60 * 1000,
  [ReportCategory.DELAY]: 45 * 60 * 1000,
  [ReportCategory.FACILITY]: 2 * 60 * 60 * 1000,
  [ReportCategory.DISRUPTION]: 2 * 60 * 60 * 1000,
};

function getCrowdBucket(
  subCategory: ReportSubCategory,
): 'low' | 'medium' | 'high' | 'very_high' {
  switch (subCategory) {
    case ReportSubCategory.LOW:
      return 'low';
    case ReportSubCategory.NORMAL:
      return 'medium';
    case ReportSubCategory.HIGH:
      return 'high';
    case ReportSubCategory.VERY_HIGH:
      return 'very_high';
    default:
      return 'medium';
  }
}

export function addTopNote(
  existingNotes: string[] | undefined,
  newNote: string | null | undefined,
): string[] {
  const current = Array.isArray(existingNotes) ? existingNotes : [];
  if (!newNote || !newNote.trim()) {
    return current;
  }
  const cleanNote = newNote.trim();
  // Deduplicate case-insensitively
  const filtered = current.filter(
    (n) => n.trim().toLowerCase() !== cleanNote.toLowerCase(),
  );
  return [cleanNote, ...filtered].slice(0, 3);
}

export function formatSubCategoryHeadline(
  stationName: string,
  subCategory: string,
): string {
  const titles: Record<string, string> = {
    FLOOD_WEATHER: 'Banjir / Cuaca Ekstrem',
    POWER_SIGNAL: 'Gangguan Listrik / Sinyal',
    TRACK_INCIDENT: 'Kendala Jalur Rel',
    FIRE_SMOKE: 'Kebakaran / Asap',
    STATION_CLOSED: 'Stasiun Ditutup Sementara',
    MEDICAL_SECURITY: 'Darurat Medis / Keamanan',
  };
  const label = titles[subCategory] || subCategory.replace(/_/g, ' ');
  return `${label} di ${stationName}`;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stationsService: StationsService,
  ) {}

  /**
   * POST /report
   * Atomic Write Engine (inside prisma.$transaction):
   * 1. Validate subCategory belongs to category.
   * 2. 500m Haversine geofence verification.
   * 3. Strict DELAY validation: destinationStationId + lineName required and validated.
   * 4. Idempotency & Anti-Spam: Check DisruptionReport for active record within TTL window.
   * 5. Materialize into StationLiveStatus (upsert on stationId) with standardized topNotes[].
   */
  async createReport(userId: string, dto: CreateReportDto) {
    // 1. Strict Category <-> SubCategory validation
    const allowedSubCategories = CategorySubCategoryMap[dto.category];
    if (!allowedSubCategories || !allowedSubCategories.includes(dto.subCategory)) {
      throw new BadRequestException(
        `subCategory "${dto.subCategory}" is not allowed for category "${dto.category}". Valid options: ${allowedSubCategories?.join(', ') || 'none'}`,
      );
    }

    // 2. Target station existence and 500m Haversine Geofence Check
    const station = await this.stationsService.findOne(dto.stationId);
    const distanceMeters = this.stationsService.calculateHaversineDistanceMeters(
      dto.userLatitude,
      dto.userLongitude,
      station.latitude,
      station.longitude,
    );

    const MAX_GEOFENCE_METERS = 500;
    if (distanceMeters > MAX_GEOFENCE_METERS) {
      throw new BadRequestException(
        `You are outside the required 500m radius of station "${station.name}" (${distanceMeters}m away). Live reports can only be submitted within station radius.`,
      );
    }

    // 3. Strict DELAY validation
    const lineInput = (dto.lineName || dto.lineId)?.trim() || null;
    let validatedDestStation: any = null;

    if (dto.category === ReportCategory.DELAY) {
      if (!dto.destinationStationId || !dto.destinationStationId.trim()) {
        throw new BadRequestException(
          'destinationStationId is required when reporting a DELAY.',
        );
      }

      if (!lineInput) {
        throw new BadRequestException(
          'lineName is required when reporting a DELAY.',
        );
      }

      // Check destination station exists
      validatedDestStation = await this.prisma.station.findUnique({
        where: { id: dto.destinationStationId.trim() },
      });

      if (!validatedDestStation) {
        throw new BadRequestException(
          `Destination station with ID "${dto.destinationStationId}" was not found.`,
        );
      }

      // Check destination against station.validDestinations if configured
      const validDestinations = Array.isArray(station.validDestinations)
        ? (station.validDestinations as any[])
        : [];

      if (validDestinations.length > 0) {
        const isValidDest = validDestinations.some((d) => {
          const matchesStation =
            d === validatedDestStation.id ||
            d?.id === validatedDestStation.id ||
            d?.destinationStationId === validatedDestStation.id ||
            (typeof d === 'string' &&
              d.toLowerCase() === validatedDestStation.name.toLowerCase()) ||
            d?.name?.toLowerCase() === validatedDestStation.name.toLowerCase() ||
            d?.destinationName?.toLowerCase() ===
              validatedDestStation.name.toLowerCase();

          if (!matchesStation) {
            return false;
          }

          // If entry specifies lineName and user supplied a line, ensure the line matches as well
          if (d?.lineName && lineInput) {
            const cleanInput = lineInput
              .toLowerCase()
              .replace(/^(krl|mrt|lrt|tj)-/i, '')
              .replace(/\s+/g, '-');
            const cleanDestLine = d.lineName
              .toLowerCase()
              .replace(/^(krl|mrt|lrt|tj)-/i, '')
              .replace(/\s+/g, '-');

            return (
              cleanInput === cleanDestLine ||
              cleanInput.includes(cleanDestLine) ||
              cleanDestLine.includes(cleanInput)
            );
          }

          return true;
        });

        if (!isValidDest) {
          throw new BadRequestException(
            `Station "${validatedDestStation.name}" is not a valid destination/terminus for "${station.name}".`,
          );
        }
      }

      // Check line against station.lineNames if configured
      const stationLines = station.lineNames || [];
      if (stationLines.length > 0) {
        const cleanInput = lineInput
          .toLowerCase()
          .replace(/^(krl|mrt|lrt|tj)-/i, '')
          .replace(/\s+/g, '-');

        const isValidLine = stationLines.some((l) => {
          const cleanLine = l
            .toLowerCase()
            .replace(/^(krl|mrt|lrt|tj)-/i, '')
            .replace(/\s+/g, '-');

          return (
            cleanLine === cleanInput ||
            cleanLine.includes(cleanInput) ||
            cleanInput.includes(cleanLine)
          );
        });

        if (!isValidLine) {
          throw new BadRequestException(
            `Station "${station.name}" does not serve line "${lineInput}". Served lines: ${stationLines.join(', ')}`,
          );
        }
      }
    }

    const now = new Date();
    const ttlMs = TTL_MAP[dto.category];
    const windowStart = new Date(now.getTime() - ttlMs);
    const expiresAt = new Date(now.getTime() + ttlMs);

    return this.prisma.$transaction(async (tx) => {
      // 4. Idempotency & Anti-Spam check
      const whereClause: any = {
        userId,
        stationId: dto.stationId,
        category: dto.category,
        isResolution: false,
        createdAt: { gte: windowStart },
      };

      if (dto.category === ReportCategory.DELAY) {
        whereClause.lineId = lineInput;
        whereClause.destinationStationId = dto.destinationStationId?.trim() || null;
      } else if (
        dto.category === ReportCategory.FACILITY ||
        dto.category === ReportCategory.DISRUPTION
      ) {
        whereClause.subCategory = dto.subCategory;
      }

      const existingReport = await tx.disruptionReport.findFirst({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
      });

      if (existingReport) {
        // CROWD branch: update vote and adjust counters
        if (dto.category === ReportCategory.CROWD) {
          const oldBucket = getCrowdBucket(existingReport.subCategory);
          const newBucket = getCrowdBucket(dto.subCategory);

          const updatedReport = await tx.disruptionReport.update({
            where: { id: existingReport.id },
            data: {
              subCategory: dto.subCategory,
              note: dto.note !== undefined ? (dto.note?.trim() || null) : existingReport.note,
              userLatitude: dto.userLatitude,
              userLongitude: dto.userLongitude,
              expiresAt,
            },
          });

          const liveStatus = await tx.stationLiveStatus.findUnique({
            where: { stationId: dto.stationId },
          });

          const crowdState = (liveStatus?.crowdState as Record<string, any>) || {
            low: 0,
            medium: 0,
            high: 0,
            very_high: 0,
          };

          if (oldBucket !== newBucket) {
            crowdState[oldBucket] = Math.max(0, (Number(crowdState[oldBucket]) || 1) - 1);
            crowdState[newBucket] = (Number(crowdState[newBucket]) || 0) + 1;
          }
          crowdState.updatedAt = now.toISOString();

          await tx.stationLiveStatus.upsert({
            where: { stationId: dto.stationId },
            create: {
              stationId: dto.stationId,
              crowdState,
              delayState: {},
              facilityState: {},
              disruptionState: {},
            },
            update: {
              crowdState,
            },
          });

          return {
            status: 'SUCCESS',
            action: 'CROWD_VOTE_UPDATED',
            report: updatedReport,
          };
        }

        // DELAY, FACILITY, DISRUPTION branch: return 200 OK with ALREADY_REPORTED
        return {
          status: 'ALREADY_REPORTED',
          message: `You have already submitted an active ${dto.category.toLowerCase()} report for this target.`,
        };
      }

      // 5. Create DisruptionReport row (Audit Log)
      const reportStatus =
        dto.category === ReportCategory.DISRUPTION
          ? ReportStatus.PENDING_QUORUM
          : ReportStatus.ACTIVE;

      const newReport = await tx.disruptionReport.create({
        data: {
          userId,
          stationId: dto.stationId,
          category: dto.category,
          subCategory: dto.subCategory,
          note: dto.note?.trim() || null,
          lineId: lineInput,
          destinationStationId: dto.destinationStationId?.trim() || null,
          isSkippedOrClosed: dto.isSkippedOrClosed ?? false,
          isResolution: false,
          userLatitude: dto.userLatitude,
          userLongitude: dto.userLongitude,
          status: reportStatus,
          expiresAt,
        },
      });

      // 6. Materialize into StationLiveStatus with standardized topNotes[]
      const liveStatus = await tx.stationLiveStatus.findUnique({
        where: { stationId: dto.stationId },
      });

      const crowdState = (liveStatus?.crowdState as Record<string, any>) || {
        low: 0,
        medium: 0,
        high: 0,
        very_high: 0,
      };
      const delayState = (liveStatus?.delayState as Record<string, any>) || {};
      const facilityState = (liveStatus?.facilityState as Record<string, any>) || {};
      const disruptionState = (liveStatus?.disruptionState as Record<string, any>) || {};

      if (dto.category === ReportCategory.CROWD) {
        const bucket = getCrowdBucket(dto.subCategory);
        crowdState[bucket] = (Number(crowdState[bucket]) || 0) + 1;
        crowdState.updatedAt = now.toISOString();
      } else if (dto.category === ReportCategory.DELAY) {
        // No ALL:ALL fallback: lineInput and destinationStationId are guaranteed
        const delayKey = `${lineInput}:${validatedDestStation.id}`;

        const currentDelay = delayState[delayKey] || {
          lineName: lineInput,
          lineId: lineInput,
          destinationStationId: validatedDestStation.id,
          destinationName: validatedDestStation.name,
          minorCount: 0,
          mediumCount: 0,
          majorCount: 0,
          resolvedCount: 0,
          topNotes: [],
          expiresAt: expiresAt.toISOString(),
        };

        if (dto.subCategory === ReportSubCategory.MINOR) {
          currentDelay.minorCount = (Number(currentDelay.minorCount) || 0) + 1;
        } else if (dto.subCategory === ReportSubCategory.MEDIUM) {
          currentDelay.mediumCount = (Number(currentDelay.mediumCount) || 0) + 1;
        } else if (dto.subCategory === ReportSubCategory.MAJOR) {
          currentDelay.majorCount = (Number(currentDelay.majorCount) || 0) + 1;
        }

        // Deduplicate and cap topNotes to 3
        currentDelay.topNotes = addTopNote(currentDelay.topNotes, dto.note);
        currentDelay.expiresAt = expiresAt.toISOString();
        delayState[delayKey] = currentDelay;
      } else if (dto.category === ReportCategory.FACILITY) {
        const facilityKey = dto.subCategory;
        const currentFacility = facilityState[facilityKey] || {
          subCategory: dto.subCategory,
          reportCount: 0,
          resolvedCount: 0,
          status: 'PENDING_QUORUM',
          topNote: null,
          topNotes: [],
          lastReportedAt: now.toISOString(),
        };

        currentFacility.reportCount = (Number(currentFacility.reportCount) || 0) + 1;
        currentFacility.status =
          currentFacility.reportCount >= 3 ? 'BROKEN' : 'PENDING_QUORUM';

        // Standardize topNotes array (deduplicated, max 3)
        currentFacility.topNotes = addTopNote(currentFacility.topNotes, dto.note);
        currentFacility.topNote = currentFacility.topNotes[0] || null;
        currentFacility.lastReportedAt = now.toISOString();
        facilityState[facilityKey] = currentFacility;
      } else if (dto.category === ReportCategory.DISRUPTION) {
        const disruptionKey = dto.subCategory;
        const currentDisruption = disruptionState[disruptionKey] || {
          subCategory: dto.subCategory,
          reportCount: 0,
          resolvedCount: 0,
          status: 'PENDING_QUORUM',
          isSkippedOrClosed: false,
          affectedLineIds: [],
          topNote: null,
          topNotes: [],
          startedAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
        };

        currentDisruption.reportCount =
          (Number(currentDisruption.reportCount) || 0) + 1;

        if (dto.isSkippedOrClosed) {
          currentDisruption.isSkippedOrClosed = true;
        }

        if (lineInput) {
          const lines: string[] = Array.isArray(currentDisruption.affectedLineIds)
            ? currentDisruption.affectedLineIds
            : [];
          if (!lines.includes(lineInput)) {
            lines.push(lineInput);
          }
          currentDisruption.affectedLineIds = lines;
        }

        // Standardize topNotes array (deduplicated, max 3)
        currentDisruption.topNotes = addTopNote(currentDisruption.topNotes, dto.note);
        currentDisruption.topNote = currentDisruption.topNotes[0] || null;
        currentDisruption.expiresAt = expiresAt.toISOString();
        currentDisruption.status =
          currentDisruption.reportCount >= 3 ? 'ACTIVE' : 'PENDING_QUORUM';
        disruptionState[disruptionKey] = currentDisruption;
      }

      await tx.stationLiveStatus.upsert({
        where: { stationId: dto.stationId },
        create: {
          stationId: dto.stationId,
          crowdState,
          delayState,
          facilityState,
          disruptionState,
        },
        update: {
          crowdState,
          delayState,
          facilityState,
          disruptionState,
        },
      });

      // 7. Reward commuter points
      if (userId) {
        await tx.user
          .update({
            where: { id: userId },
            data: { points: { increment: 10 } },
          })
          .catch(() => null);
      }

      return {
        status: 'SUCCESS',
        report: newReport,
      };
    });
  }

  /**
   * GET /report/feed/global
   * Clean O(1) Read Endpoint:
   * Queries StationLiveStatus where disruptionState has any entry with status === "ACTIVE" and expiresAt > now.
   * Flattens into clean disruption alert cards.
   */
  async getGlobalFeed(): Promise<DisruptionAlertCard[]> {
    const now = new Date();
    const liveStatuses = await this.prisma.stationLiveStatus.findMany({
      include: {
        station: true,
      },
    });

    const cards: DisruptionAlertCard[] = [];

    for (const live of liveStatuses) {
      const disruptionState = (live.disruptionState as Record<string, any>) || {};
      for (const [subCat, entry] of Object.entries(disruptionState)) {
        if (
          entry &&
          entry.status === 'ACTIVE' &&
          entry.expiresAt &&
          new Date(entry.expiresAt) > now
        ) {
          const topNotes = Array.isArray(entry.topNotes)
            ? entry.topNotes
            : entry.topNote
              ? [entry.topNote]
              : [];

          cards.push({
            id: `${live.stationId}-${subCat}`,
            stationId: live.stationId,
            stationName: live.station.name,
            category: ReportCategory.DISRUPTION,
            subCategory: subCat as ReportSubCategory,
            headline: formatSubCategoryHeadline(live.station.name, subCat),
            isSkippedOrClosed: Boolean(entry.isSkippedOrClosed),
            reportCount: Number(entry.reportCount) || 0,
            topNote: entry.topNote || topNotes[0] || null,
            topNotes,
            affectedLineIds: Array.isArray(entry.affectedLineIds)
              ? entry.affectedLineIds
              : [],
            status: 'ACTIVE',
            startedAt: entry.startedAt,
            expiresAt: entry.expiresAt,
            updatedAt: live.updatedAt,
          });
        }
      }
    }

    // Sort by reportCount desc
    cards.sort((a, b) => b.reportCount - a.reportCount);

    return cards;
  }

  /**
   * GET /report
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
   * GET /report/:id
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
}

export { ReportsService as DisruptionsService };
