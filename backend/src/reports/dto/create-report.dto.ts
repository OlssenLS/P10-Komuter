import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReportCategory, ReportSubCategory } from '@prisma/client';

export const CategorySubCategoryMap: Record<ReportCategory, ReportSubCategory[]> = {
  [ReportCategory.CROWD]: [
    ReportSubCategory.LOW,
    ReportSubCategory.NORMAL,
    ReportSubCategory.HIGH,
    ReportSubCategory.VERY_HIGH,
  ],
  [ReportCategory.DELAY]: [
    ReportSubCategory.MINOR,
    ReportSubCategory.MEDIUM,
    ReportSubCategory.MAJOR,
  ],
  [ReportCategory.FACILITY]: [
    ReportSubCategory.ESCALATOR,
    ReportSubCategory.LIFT,
    ReportSubCategory.TAP_IN_OUT_GATE,
    ReportSubCategory.TOILET,
  ],
  [ReportCategory.DISRUPTION]: [
    ReportSubCategory.FLOOD_WEATHER,
    ReportSubCategory.POWER_SIGNAL,
    ReportSubCategory.TRACK_INCIDENT,
    ReportSubCategory.FIRE_SMOKE,
    ReportSubCategory.STATION_CLOSED,
    ReportSubCategory.MEDICAL_SECURITY,
  ],
};

export function IsValidSubCategoryForCategory(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidSubCategoryForCategory',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const obj = args.object as any;
          const category = obj.category as ReportCategory;
          if (!category || !value) return false;
          const validSubCategories = CategorySubCategoryMap[category];
          return Array.isArray(validSubCategories) && validSubCategories.includes(value);
        },
        defaultMessage(args: ValidationArguments) {
          const obj = args.object as any;
          return `subCategory "${args.value}" is not valid for category "${obj.category}". Valid options: ${CategorySubCategoryMap[obj.category as ReportCategory]?.join(', ') || 'none'}`;
        },
      },
    });
  };
}

export class CreateReportDto {
  @IsString()
  @IsNotEmpty()
  stationId: string;

  @IsEnum(ReportCategory, {
    message: `category must be one of: ${Object.values(ReportCategory).join(', ')}`,
  })
  category: ReportCategory;

  @IsEnum(ReportSubCategory, {
    message: `subCategory must be one of: ${Object.values(ReportSubCategory).join(', ')}`,
  })
  @IsValidSubCategoryForCategory()
  subCategory: ReportSubCategory;

  @IsNumber()
  @Type(() => Number)
  userLatitude: number;

  @IsNumber()
  @Type(() => Number)
  userLongitude: number;

  @IsOptional()
  @IsString()
  lineName?: string;

  @IsOptional()
  @IsString()
  lineId?: string;

  @IsOptional()
  @IsString()
  destinationStationId?: string;

  @IsOptional()
  @IsBoolean()
  isSkippedOrClosed?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  note?: string;
}

export { ReportCategory, ReportSubCategory };
