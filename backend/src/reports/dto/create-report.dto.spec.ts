import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateReportDto,
  ReportCategory,
  ReportSubCategory,
  DelayImpact,
  TrackDirectionScope,
} from './create-report.dto.js';
import { CreateReportDto as DisruptionCreateReportDto } from '../../disruptions/dto/create-report.dto.js';

describe('CreateReportDto Validation', () => {
  it('should validate a complete valid DTO with new Prisma schema fields', async () => {
    const validPayload = {
      stationId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      title: 'Signaling issue near Manggarai',
      category: ReportCategory.DELAY,
      severity: ReportSubCategory.MAJOR,
      subCategory: ReportSubCategory.MAJOR,
      impactLevel: DelayImpact.LINE_SECTION,
      trackScope: TrackDirectionScope.DIRECTIONAL,
      destinationStationId: 'a3bb189e-8bf9-3888-9912-ace4e6543002',
      destinationLabel: 'Arah Cikarang via Senen',
      description: 'Signals not turning green, 20 minute delay',
      latitude: -6.2098,
      longitude: 106.8501,
      userLatitude: -6.2098,
      userLongitude: 106.8501,
      radius: 500,
    };

    const dto = plainToInstance(CreateReportDto, validPayload);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should validate when optional fields are omitted', async () => {
    const minimalPayload = {
      title: 'Crowded platform',
      category: ReportCategory.CROWD,
    };

    const dto = plainToInstance(CreateReportDto, minimalPayload);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should accept BOTH_WAYS trackScope', async () => {
    const payload = {
      title: 'Power outage',
      category: ReportCategory.DISRUPTION,
      trackScope: TrackDirectionScope.BOTH_WAYS,
    };

    const dto = plainToInstance(CreateReportDto, payload);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject invalid trackScope enum value', async () => {
    const payload = {
      title: 'Invalid scope',
      category: ReportCategory.DELAY,
      trackScope: 'INVALID_SCOPE',
    };

    const dto = plainToInstance(CreateReportDto, payload);
    const errors = await validate(dto);
    const trackScopeError = errors.find((e) => e.property === 'trackScope');
    expect(trackScopeError).toBeDefined();
    expect(trackScopeError?.constraints?.isEnum).toBeDefined();
  });

  it('should reject non-string stationId and destinationStationId', async () => {
    const payload = {
      title: 'Invalid types',
      category: ReportCategory.DELAY,
      stationId: 12345 as unknown as string,
      destinationStationId: false as unknown as string,
    };

    const dto = plainToInstance(CreateReportDto, payload);
    const errors = await validate(dto);
    const stationIdError = errors.find((e) => e.property === 'stationId');
    const destinationError = errors.find((e) => e.property === 'destinationStationId');

    expect(stationIdError).toBeDefined();
    expect(stationIdError?.constraints?.isString).toBeDefined();
    expect(destinationError).toBeDefined();
    expect(destinationError?.constraints?.isString).toBeDefined();
  });

  it('should reject invalid category and severity enums', async () => {
    const payload = {
      title: 'Invalid Enums',
      category: 'NON_EXISTENT_CATEGORY',
      severity: 'NON_EXISTENT_SEVERITY',
    };

    const dto = plainToInstance(CreateReportDto, payload);
    const errors = await validate(dto);
    const categoryError = errors.find((e) => e.property === 'category');
    const severityError = errors.find((e) => e.property === 'severity');

    expect(categoryError).toBeDefined();
    expect(categoryError?.constraints?.isEnum).toBeDefined();
    expect(severityError).toBeDefined();
    expect(severityError?.constraints?.isEnum).toBeDefined();
  });

  it('should reject non-number and out-of-bounds latitude and longitude', async () => {
    const payload = {
      title: 'Out of bounds coordinates',
      category: ReportCategory.DELAY,
      latitude: 95, // max 90
      longitude: -190, // min -180
    };

    const dto = plainToInstance(CreateReportDto, payload);
    const errors = await validate(dto);
    const latError = errors.find((e) => e.property === 'latitude');
    const lonError = errors.find((e) => e.property === 'longitude');

    expect(latError).toBeDefined();
    expect(latError?.constraints?.max).toBeDefined();
    expect(lonError).toBeDefined();
    expect(lonError?.constraints?.min).toBeDefined();
  });

  it('should verify disruptions/dto/create-report.dto export matches reports/dto/create-report.dto', async () => {
    const payload = {
      title: 'Disruption alias test',
      category: ReportCategory.EVENT,
      trackScope: TrackDirectionScope.DIRECTIONAL,
      destinationStationId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      destinationLabel: 'Arah Jakarta Kota',
    };

    const dto = plainToInstance(DisruptionCreateReportDto, payload);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});
