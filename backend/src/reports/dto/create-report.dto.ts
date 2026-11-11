import { IsString, IsEnum, IsOptional, MinLength } from 'class-validator';
import { ReportCategory, DelayImpact } from '@prisma/client';

export class CreateReportDto {
  @IsString()
  stationId: string;

  @IsString()
  @MinLength(5)
  title: string;

  @IsEnum(ReportCategory)
  category: ReportCategory;

  @IsOptional()
  @IsEnum(DelayImpact)
  impactLevel?: DelayImpact;

  @IsOptional()
  @IsString()
  description?: string;
}
