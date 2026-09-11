import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to PostgreSQL via Prisma');
    } catch (error: any) {
      this.logger.warn(
        `PostgreSQL connection pending: ${error.message}. Ensure PostgreSQL is accessible and DATABASE_URL is configured.`,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
