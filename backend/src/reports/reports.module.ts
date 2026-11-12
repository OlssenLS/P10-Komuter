import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StationsModule } from '../stations/stations.module.js';

@Module({
  imports: [PrismaModule, StationsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
