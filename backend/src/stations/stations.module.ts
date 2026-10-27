import { Module } from '@nestjs/common';
import { StationsController } from './stations.controller.js';
import { StationsService } from './stations.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [StationsController],
  providers: [StationsService],
  exports: [StationsService],
})
export class StationsModule {}
