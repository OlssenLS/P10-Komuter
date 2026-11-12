import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateReportDto,
  ReportCategory,
  ReportSubCategory,
} from './create-report.dto.js';

describe('CreateReportDto Validation', () => {
  it('should validate a complete valid DTO with all fields', async () => {
    const validPayload = {
      stationId: 'station-manggarai',
      category: ReportCategory.DELAY,
      subCategory: ReportSubCategory.MAJOR,
      userLatitude: -6.2098,
      userLongitude: 106.8501,
      lineId: 'krl-bogor',
      destinationStationId: 'station-bogor',
      isSkippedOrClosed: false,
      note: 'Sinus/Sinyal bermasalah dekat Manggarai',
    };

    const dto = plainToInstance(CreateReportDto, validPayload);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should validate when optional fields are omitted', async () => {
    const minimalPayload = {
      stationId: 'station-manggarai',
      category: ReportCategory.CROWD,
      subCategory: ReportSubCategory.HIGH,
      userLatitude: -6.2098,
      userLongitude: 106.8501,
    };

    const dto = plainToInstance(CreateReportDto, minimalPayload);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject when required fields are missing', async () => {
    const payload = {};
    const dto = plainToInstance(CreateReportDto, payload);
    const errors = await validate(dto);

    const properties = errors.map((e) => e.property);
    expect(properties).toContain('stationId');
    expect(properties).toContain('category');
    expect(properties).toContain('subCategory');
    expect(properties).toContain('userLatitude');
    expect(properties).toContain('userLongitude');
  });

  it('should reject note exceeding 120 characters', async () => {
    const payload = {
      stationId: 'station-manggarai',
      category: ReportCategory.FACILITY,
      subCategory: ReportSubCategory.ESCALATOR,
      userLatitude: -6.2098,
      userLongitude: 106.8501,
      note: 'a'.repeat(121),
    };

    const dto = plainToInstance(CreateReportDto, payload);
    const errors = await validate(dto);
    const noteError = errors.find((e) => e.property === 'note');
    expect(noteError).toBeDefined();
    expect(noteError?.constraints?.maxLength).toBeDefined();
  });

  it('should reject invalid subCategory for category (e.g. ESCALATOR for DELAY)', async () => {
    const payload = {
      stationId: 'station-manggarai',
      category: ReportCategory.DELAY,
      subCategory: ReportSubCategory.ESCALATOR,
      userLatitude: -6.2098,
      userLongitude: 106.8501,
    };

    const dto = plainToInstance(CreateReportDto, payload);
    const errors = await validate(dto);
    const subCatError = errors.find((e) => e.property === 'subCategory');
    expect(subCatError).toBeDefined();
    expect(subCatError?.constraints?.isValidSubCategoryForCategory).toBeDefined();
  });

  it('should accept valid subCategory for corresponding category', async () => {
    const testCases = [
      { category: ReportCategory.CROWD, subCategory: ReportSubCategory.VERY_HIGH },
      { category: ReportCategory.DELAY, subCategory: ReportSubCategory.MINOR },
      { category: ReportCategory.FACILITY, subCategory: ReportSubCategory.LIFT },
      { category: ReportCategory.DISRUPTION, subCategory: ReportSubCategory.FLOOD_WEATHER },
    ];

    for (const tc of testCases) {
      const dto = plainToInstance(CreateReportDto, {
        stationId: 'station-1',
        category: tc.category,
        subCategory: tc.subCategory,
        userLatitude: -6.2,
        userLongitude: 106.8,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    }
  });
});
