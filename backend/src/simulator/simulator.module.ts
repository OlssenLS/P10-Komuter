import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SimulatorController } from './simulator.controller.js';
import { SimulatorService } from './simulator.service.js';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [SimulatorController],
  providers: [SimulatorService],
  exports: [SimulatorService],
})
export class SimulatorModule {}
