import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NearbyStationsDto } from './dto/nearby-stations.dto.js';
import { CreateStationDto } from './dto/create-station.dto.js';
import { Station } from '@prisma/client';

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
        reports: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!station) {
      throw new NotFoundException(`Station with ID "${id}" was not found`);
    }

    return station;
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
}
