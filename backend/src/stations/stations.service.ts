import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NearbyStationsDto } from './dto/nearby-stations.dto.js';
import { CreateStationDto } from './dto/create-station.dto.js';
import { ResolveIssueDto } from './dto/resolve-issue.dto.js';
import {
  Station,
  ReportCategory,
  ReportSubCategory,
  ReportStatus,
} from '@prisma/client';

export interface StationWithDistance extends Station {
  distanceMeters: number;
}

export interface NearbyStationsResponse {
  isWithinStationRadius: boolean;
  radiusMeters: number;
  userLocation: {
    latitude: number;
    longitude: number;
  };
  closestStation: StationWithDistance | null;
  nearbyStations: StationWithDistance[];
}

const TTL_MAP: Record<ReportCategory, number> = {
  [ReportCategory.CROWD]: 15 * 60 * 1000,
  [ReportCategory.DELAY]: 45 * 60 * 1000,
  [ReportCategory.FACILITY]: 2 * 60 * 60 * 1000,
  [ReportCategory.DISRUPTION]: 2 * 60 * 60 * 1000,
};

const VALID_FACILITIES: string[] = [
  ReportSubCategory.ESCALATOR,
  ReportSubCategory.LIFT,
  ReportSubCategory.TAP_IN_OUT_GATE,
  ReportSubCategory.TOILET,
];

const VALID_DISRUPTIONS: string[] = [
  ReportSubCategory.FLOOD_WEATHER,
  ReportSubCategory.POWER_SIGNAL,
  ReportSubCategory.TRACK_INCIDENT,
  ReportSubCategory.FIRE_SMOKE,
  ReportSubCategory.STATION_CLOSED,
  ReportSubCategory.MEDICAL_SECURITY,
];

@Injectable()
export class StationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculates the great-circle distance between two coordinates in meters
   * using the Haversine formula.
   */
  calculateHaversineDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000; // Earth radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const rLat1 = toRad(lat1);
    const rLat2 = toRad(lat2);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c * 10) / 10;
  }

  async findNearby(dto: NearbyStationsDto): Promise<NearbyStationsResponse> {
    const radius = dto.radius ?? 500;
    const stations = await this.prisma.station.findMany({
      orderBy: { name: 'asc' },
    });

    const stationsWithDistance: StationWithDistance[] = stations.map((station) => {
      const distanceMeters = this.calculateHaversineDistanceMeters(
        dto.latitude,
        dto.longitude,
        station.latitude,
        station.longitude,
      );
      return {
        ...station,
        distanceMeters,
      };
    });

    // Sort by closest distance first
    stationsWithDistance.sort((a, b) => a.distanceMeters - b.distanceMeters);

    const closestStation = stationsWithDistance.length > 0 ? stationsWithDistance[0] : null;
    const nearbyStations = stationsWithDistance.filter(
      (station) => station.distanceMeters <= radius,
    );

    return {
      isWithinStationRadius: nearbyStations.length > 0,
      radiusMeters: radius,
      userLocation: {
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
      closestStation,
      nearbyStations,
    };
  }

  async findAll(): Promise<Station[]> {
    return this.prisma.station.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string): Promise<Station> {
    const station = await this.prisma.station.findUnique({
      where: { id },
      include: {
        liveStatus: true,
      },
    });

    if (!station) {
      throw new NotFoundException(`Station with ID "${id}" was not found`);
    }

    return station;
  }

  async findReports(stationId: string) {
    await this.findOne(stationId);
    return this.prisma.disruptionReport.findMany({
      where: { stationId },
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
  }

  async create(dto: CreateStationDto): Promise<Station> {
    return this.prisma.station.create({
      data: {
        name: dto.name,
        isTransitHub: dto.isTransitHub ?? false,
        supportedTypes: dto.supportedTypes,
        lineNames: dto.lineNames,
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
    });
  }

  /**
   * GET /stations/:id/status
   * Clean O(1) Read Endpoint:
   * 1. Fetches Station (including validDestinations) + StationLiveStatus.
   * 2. Filters out expired delayState and disruptionState (expiresAt <= now).
   * 3. Zeroes out crowdState if updatedAt is older than 15 minutes.
   * 4. Standardizes topNotes: string[] across all active states.
   */
  async getStationStatus(stationId: string) {
    const station = await this.prisma.station.findUnique({
      where: { id: stationId },
      include: {
        liveStatus: true,
      },
    });

    if (!station) {
      throw new NotFoundException(`Station with ID "${stationId}" was not found`);
    }

    const now = new Date();

    // 1. Delays filter: expiresAt > now with standardized topNotes
    const rawDelays = (station.liveStatus?.delayState as Record<string, any>) || {};
    const delays: Record<string, any> = {};
    for (const [key, val] of Object.entries(rawDelays)) {
      if (val?.expiresAt && new Date(val.expiresAt) > now) {
        const topNotes = Array.isArray(val.topNotes)
          ? val.topNotes
          : val.topNote
            ? [val.topNote]
            : [];
        delays[key] = {
          ...val,
          topNotes,
        };
      }
    }

    // 2. Disruptions filter: expiresAt > now with standardized topNotes
    const rawDisruptions = (station.liveStatus?.disruptionState as Record<string, any>) || {};
    const disruptions: Record<string, any> = {};
    for (const [key, val] of Object.entries(rawDisruptions)) {
      if (val?.expiresAt && new Date(val.expiresAt) > now) {
        const topNotes = Array.isArray(val.topNotes)
          ? val.topNotes
          : val.topNote
            ? [val.topNote]
            : [];
        disruptions[key] = {
          ...val,
          topNotes,
        };
      }
    }

    // 3. Facilities with standardized topNotes
    const rawFacilities = (station.liveStatus?.facilityState as Record<string, any>) || {};
    const facilities: Record<string, any> = {};
    for (const [key, val] of Object.entries(rawFacilities)) {
      const topNotes = Array.isArray(val.topNotes)
        ? val.topNotes
        : val.topNote
          ? [val.topNote]
          : [];
      facilities[key] = {
        ...val,
        topNotes,
      };
    }

    // 4. Crowd computation with 15-minute freshness decay
    const rawCrowd = (station.liveStatus?.crowdState as Record<string, any>) || {};
    const crowdUpdatedAt = rawCrowd.updatedAt ? new Date(rawCrowd.updatedAt) : null;
    const isCrowdExpired =
      !crowdUpdatedAt || now.getTime() - crowdUpdatedAt.getTime() > 15 * 60 * 1000;

    let low = 0;
    let medium = 0;
    let high = 0;
    let veryHigh = 0;

    if (!isCrowdExpired) {
      low = Number(rawCrowd.low) || 0;
      medium = Number(rawCrowd.medium ?? rawCrowd.normal) || 0;
      high = Number(rawCrowd.high) || 0;
      veryHigh =
        Number(rawCrowd.very_high ?? rawCrowd.veryHigh ?? rawCrowd.crowdOverflow) || 0;
    }

    const totalVotes = low + medium + high + veryHigh;
    const isCrowdOverflow = totalVotes > 0 && (high + veryHigh) / totalVotes >= 0.8;

    let currentCrowdLevel: ReportSubCategory = ReportSubCategory.NORMAL;
    if (!isCrowdExpired && totalVotes > 0) {
      if (veryHigh > 0 && veryHigh >= high && veryHigh >= medium && veryHigh >= low) {
        currentCrowdLevel = ReportSubCategory.VERY_HIGH;
      } else if (high > medium && high > low) {
        currentCrowdLevel = ReportSubCategory.HIGH;
      } else if (low > medium && low > high) {
        currentCrowdLevel = ReportSubCategory.LOW;
      } else {
        currentCrowdLevel = ReportSubCategory.NORMAL;
      }

      if (isCrowdOverflow) {
        currentCrowdLevel = ReportSubCategory.VERY_HIGH;
      }
    }

    const crowd = {
      currentCrowdLevel,
      isCrowdOverflow,
      breakdown: {
        low,
        medium,
        high,
        very_high: veryHigh,
      },
      totalVotes,
      updatedAt: isCrowdExpired ? now.toISOString() : rawCrowd.updatedAt,
    };

    return {
      station: {
        id: station.id,
        name: station.name,
        isTransitHub: station.isTransitHub,
        supportedTypes: station.supportedTypes,
        lineNames: station.lineNames,
        latitude: station.latitude,
        longitude: station.longitude,
        validDestinations: station.validDestinations,
        createdAt: station.createdAt,
        updatedAt: station.updatedAt,
      },
      crowd,
      delays,
      facilities,
      disruptions,
    };
  }

  /**
   * POST /stations/:id/resolve
   * Symmetric Resolution Endpoint:
   * Returns 400 for invalid category / targetKey format.
   * Returns 404 if station or target issue is not currently active.
   * Enforces 1 resolution per userId per target window.
   */
  async resolveStationIssue(stationId: string, userId: string, dto: ResolveIssueDto) {
    const station = await this.findOne(stationId);

    // 1. CROWD cannot be manually resolved
    if (dto.category === ReportCategory.CROWD) {
      throw new BadRequestException(
        'CROWD reports cannot be resolved manually; they update automatically via commuter voting.',
      );
    }

    // 2. Validate targetKey format for FACILITY and DISRUPTION
    if (dto.category === ReportCategory.FACILITY) {
      if (!VALID_FACILITIES.includes(dto.targetKey)) {
        throw new BadRequestException(
          `Invalid targetKey "${dto.targetKey}" for FACILITY. Valid options: ${VALID_FACILITIES.join(', ')}`,
        );
      }
    } else if (dto.category === ReportCategory.DISRUPTION) {
      if (!VALID_DISRUPTIONS.includes(dto.targetKey)) {
        throw new BadRequestException(
          `Invalid targetKey "${dto.targetKey}" for DISRUPTION. Valid options: ${VALID_DISRUPTIONS.join(', ')}`,
        );
      }
    }

    // 3. Verify target issue is ACTUALLY active in StationLiveStatus
    const liveStatus = await this.prisma.stationLiveStatus.findUnique({
      where: { stationId },
    });

    if (!liveStatus) {
      throw new NotFoundException(
        `No active disruption records found for station "${station.name}".`,
      );
    }

    const now = new Date();
    const delayState = (liveStatus.delayState as Record<string, any>) || {};
    const facilityState = (liveStatus.facilityState as Record<string, any>) || {};
    const disruptionState = (liveStatus.disruptionState as Record<string, any>) || {};

    let targetEntry: any = null;
    if (dto.category === ReportCategory.DELAY) {
      targetEntry = delayState[dto.targetKey];
      if (!targetEntry || (targetEntry.expiresAt && new Date(targetEntry.expiresAt) <= now)) {
        throw new NotFoundException(
          `No active delay issue found for key "${dto.targetKey}" at station "${station.name}".`,
        );
      }
    } else if (dto.category === ReportCategory.FACILITY) {
      targetEntry = facilityState[dto.targetKey];
      if (!targetEntry) {
        throw new NotFoundException(
          `No active facility issue found for "${dto.targetKey}" at station "${station.name}".`,
        );
      }
    } else if (dto.category === ReportCategory.DISRUPTION) {
      targetEntry = disruptionState[dto.targetKey];
      if (!targetEntry || (targetEntry.expiresAt && new Date(targetEntry.expiresAt) <= now)) {
        throw new NotFoundException(
          `No active disruption found for "${dto.targetKey}" at station "${station.name}".`,
        );
      }
    }

    const ttlMs = TTL_MAP[dto.category] || 2 * 60 * 60 * 1000;
    const windowStart = new Date(now.getTime() - ttlMs);
    const expiresAt = new Date(now.getTime() + ttlMs);

    return this.prisma.$transaction(async (tx) => {
      // 4. Idempotency check: 1 resolution per userId per target window
      const resolutionWhere: any = {
        userId,
        stationId,
        category: dto.category,
        isResolution: true,
        createdAt: { gte: windowStart },
      };

      if (dto.category === ReportCategory.DELAY) {
        const parts = dto.targetKey.split(':');
        const parsedLineId = parts[0] && parts[0] !== 'ALL' ? parts[0] : null;
        const parsedDestId = parts[1] && parts[1] !== 'ALL' ? parts[1] : null;
        if (parsedLineId) resolutionWhere.lineId = parsedLineId;
        if (parsedDestId) resolutionWhere.destinationStationId = parsedDestId;
      } else {
        resolutionWhere.subCategory = dto.targetKey as ReportSubCategory;
      }

      const existingResolution = await tx.disruptionReport.findFirst({
        where: resolutionWhere,
      });

      if (existingResolution) {
        return {
          status: 'ALREADY_RESOLVED',
          message: 'You have already submitted a resolution for this issue.',
        };
      }

      // 5. Audit log resolution
      let lineId: string | null = null;
      let destinationStationId: string | null = null;
      let subCategory: ReportSubCategory = ReportSubCategory.NORMAL;

      if (dto.category === ReportCategory.DELAY) {
        const parts = dto.targetKey.split(':');
        lineId = parts[0] && parts[0] !== 'ALL' ? parts[0] : null;
        destinationStationId = parts[1] && parts[1] !== 'ALL' ? parts[1] : null;
        subCategory = ReportSubCategory.MINOR;
      } else {
        subCategory = dto.targetKey as ReportSubCategory;
      }

      await tx.disruptionReport.create({
        data: {
          userId,
          stationId,
          category: dto.category,
          subCategory,
          lineId,
          destinationStationId,
          isResolution: true,
          status: ReportStatus.RESOLVED,
          expiresAt,
        },
      });

      // 6. Update materialized StationLiveStatus
      let cleared = false;

      if (dto.category === ReportCategory.DELAY) {
        const entry = delayState[dto.targetKey];
        if (entry) {
          entry.resolvedCount = (Number(entry.resolvedCount) || 0) + 1;
          const totalReports =
            (Number(entry.minorCount) || 0) +
            (Number(entry.mediumCount) || 0) +
            (Number(entry.majorCount) || 0);

          if (entry.resolvedCount >= 3 || entry.resolvedCount >= totalReports) {
            delete delayState[dto.targetKey];
            cleared = true;
          } else {
            delayState[dto.targetKey] = entry;
          }
        }
      } else if (dto.category === ReportCategory.FACILITY) {
        const entry = facilityState[dto.targetKey];
        if (entry) {
          entry.resolvedCount = (Number(entry.resolvedCount) || 0) + 1;
          const reportCount = Number(entry.reportCount) || 0;

          if (entry.resolvedCount >= 3 || entry.resolvedCount >= reportCount) {
            delete facilityState[dto.targetKey];
            cleared = true;
          } else {
            facilityState[dto.targetKey] = entry;
          }
        }
      } else if (dto.category === ReportCategory.DISRUPTION) {
        const entry = disruptionState[dto.targetKey];
        if (entry) {
          entry.resolvedCount = (Number(entry.resolvedCount) || 0) + 1;
          const reportCount = Number(entry.reportCount) || 0;

          if (entry.resolvedCount >= 3 || entry.resolvedCount >= reportCount) {
            delete disruptionState[dto.targetKey];
            cleared = true;
          } else {
            disruptionState[dto.targetKey] = entry;
          }
        }
      }

      await tx.stationLiveStatus.update({
        where: { stationId },
        data: {
          delayState,
          facilityState,
          disruptionState,
        },
      });

      // 7. Reward user points
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
        action: cleared ? 'CLEARED' : 'VOTED_NORMAL',
        cleared,
        targetKey: dto.targetKey,
      };
    });
  }
}
