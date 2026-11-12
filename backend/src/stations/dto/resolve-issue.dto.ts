import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ReportCategory } from '@prisma/client';

export class ResolveIssueDto {
  @IsEnum(ReportCategory, {
    message: `category must be one of: ${Object.values(ReportCategory).join(', ')}`,
  })
  category: ReportCategory;

  @IsString()
  @IsNotEmpty()
  targetKey: string;
}
