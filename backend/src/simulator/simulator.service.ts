import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TRANSIT_TRACKS, TransitTrack } from '../stations/transit-tracks.js';

export type { TransitTrack };

@Injectable()
export class SimulatorService {
  private readonly logger = new Logger(SimulatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Railway line tracks configuration for graph rendering
   */
  getTracks(): TransitTrack[] {
    return TRANSIT_TRACKS;
  }

  /**
   * Generates or fetches 3 authenticated JWT tokens for simulator personas
   */
  async getSimulationTokens(): Promise<{ tokens: { id: string; name: string; token: string }[] }> {
    const accessSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') || 'komuter_access_secret_key';

    const testUsers = [
      { email: 'simulator_alpha@komutin.com', username: 'sim_alpha', name: 'Simulator Operator Alpha' },
      { email: 'simulator_beta@komutin.com', username: 'sim_beta', name: 'Simulator Operator Beta' },
      { email: 'simulator_gamma@komutin.com', username: 'sim_gamma', name: 'Simulator Operator Gamma' },
    ];

    const results: { id: string; name: string; token: string }[] = [];

    for (const u of testUsers) {
      let dbUser = await this.prisma.user.findFirst({
        where: { email: u.email },
      });

      if (!dbUser) {
        dbUser = await this.prisma.user.create({
          data: {
            email: u.email,
            username: u.username,
            name: u.name,
            password: 'simulator_secure_pass',
            role: 'COMMUTER',
          },
        });
      }

      const token = await this.jwtService.signAsync(
        { sub: dbUser.id, email: dbUser.email, username: dbUser.username, role: dbUser.role },
        { secret: accessSecret, expiresIn: '7d' },
      );

      results.push({
        id: dbUser.id,
        name: dbUser.name,
        token,
      });
    }

    return { tokens: results };
  }

  /**
   * Wipes all simulated disruption reports and resets station live statuses
   */
  async resetAllTestData(): Promise<{ success: boolean; message: string; deletedReportsCount: number }> {
    this.logger.log('Resetting all simulator disruption reports & station live states...');

    const deleteResult = await this.prisma.disruptionReport.deleteMany({});

    await this.prisma.stationLiveStatus.updateMany({
      data: {
        crowdState: { low: 0, medium: 0, high: 0, very_high: 0 },
        delayState: {},
        facilityState: {},
        disruptionState: {},
      },
    });

    return {
      success: true,
      message: 'All test reports wiped cleanly and station live states reset to baseline.',
      deletedReportsCount: deleteResult.count,
    };
  }
}
