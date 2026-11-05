import { Module } from '@nestjs/common';
import { DisruptionsController } from './disruptions.controller.js';
import { DisruptionsService } from './disruptions.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StationsModule } from '../stations/stations.module.js';

@Module({
  imports: [PrismaModule, StationsModule],
  controllers: [DisruptionsController],
  providers: [DisruptionsService],
  exports: [DisruptionsService],
})
export class DisruptionsModule {}
