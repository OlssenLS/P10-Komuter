import {
  IsString,
  IsBoolean,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
  Max,
} from 'class-validator';
import { TransportType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateStationDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsBoolean()
  isTransitHub?: boolean = false;

  @IsArray()
  @IsEnum(TransportType, { each: true })
  supportedTypes: TransportType[];

  @IsArray()
  @IsString({ each: true })
  lineNames: string[];

  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  longitude: number;
}
