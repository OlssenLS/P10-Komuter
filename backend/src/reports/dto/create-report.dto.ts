import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ReportCategory, DelayImpact } from '@prisma/client';

export class CreateReportDto {
  @IsOptional()
  @IsString()
  stationId?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsEnum(ReportCategory, {
    message: `category must be one of: ${Object.values(ReportCategory).join(', ')}`,
  })
  category: ReportCategory;

  @IsOptional()
  @IsEnum(DelayImpact, {
    message: `impactLevel must be one of: ${Object.values(DelayImpact).join(', ')}`,
  })
  impactLevel?: DelayImpact;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  userLatitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  userLongitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50000)
  @Type(() => Number)
  radius?: number = 500;
}
