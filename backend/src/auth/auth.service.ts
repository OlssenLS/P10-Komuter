import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { SignupDto } from './dto/signup.dto.js';
import { LoginDto } from './dto/login.dto.js';
import {
  AuthSuccessResponse,
  AuthTokenResponse,
  ActionStatusResponse,
  UserDto,
} from './dto/auth-response.dto.js';

interface InMemoryUser {
  id: string;
  email: string;
  password: string;
  name: string;
  hashedRefreshToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private inMemoryFallbackUsers = new Map<string, InMemoryUser>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async signup(dto: SignupDto): Promise<AuthSuccessResponse> {
    const existing = await this.findUserByEmail(dto.email);
    if (existing) {
      throw new ConflictException('An account with this email address already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.createUser(dto.email, hashedPassword, dto.name);
    const tokens = await this.generateTokens(user.id, user.email);

    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
      },
      tokens,
    };
  }

  async login(dto: LoginDto): Promise<AuthSuccessResponse> {
    const user = await this.findUserByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
      },
      tokens,
    };
  }

  async refreshTokens(userId: string, refreshToken: string): Promise<AuthTokenResponse> {
    const user = await this.findUserById(userId);
    if (!user || !user.hashedRefreshToken) {
      throw new ForbiddenException('Access Denied: Invalid session');
    }

    const isTokenMatch = await bcrypt.compare(refreshToken, user.hashedRefreshToken);
    if (!isTokenMatch) {
      throw new ForbiddenException('Access Denied: Invalid refresh token');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string): Promise<ActionStatusResponse> {
    await this.clearRefreshToken(userId);
    return {
      success: true,
      message: 'Successfully logged out',
    };
  }

  private async generateTokens(userId: string, email: string): Promise<AuthTokenResponse> {
    const accessSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') || 'komuter_access_secret_key';
    const accessExpiresIn =
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m';
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') || 'komuter_refresh_secret_key';
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email },
        { secret: accessSecret, expiresIn: accessExpiresIn as any },
      ),
      this.jwtService.signAsync(
        { sub: userId, email },
        { secret: refreshSecret, expiresIn: refreshExpiresIn as any },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  private async updateRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { hashedRefreshToken },
      });
    } catch {
      const memoryUser = this.inMemoryFallbackUsers.get(userId);
      if (memoryUser) {
        memoryUser.hashedRefreshToken = hashedRefreshToken;
      }
    }
  }

  private async clearRefreshToken(userId: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { hashedRefreshToken: null },
      });
    } catch {
      const memoryUser = this.inMemoryFallbackUsers.get(userId);
      if (memoryUser) {
        memoryUser.hashedRefreshToken = null;
      }
    }
  }

  private async findUserByEmail(email: string): Promise<InMemoryUser | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });
      if (user) return user;
    } catch {
      // Fallback if Postgres table not migrated yet
    }

    for (const u of this.inMemoryFallbackUsers.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        return u;
      }
    }
    return null;
  }

  private async findUserById(id: string): Promise<InMemoryUser | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
      });
      if (user) return user;
    } catch {
      // Fallback if Postgres table not migrated yet
    }

    return this.inMemoryFallbackUsers.get(id) || null;
  }

  private async createUser(
    email: string,
    passwordHash: string,
    name: string,
  ): Promise<InMemoryUser> {
    try {
      return await this.prisma.user.create({
        data: {
          email,
          password: passwordHash,
          name,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Prisma create user deferred to fallback memory store: ${err.message}`);
      const fallbackUser: InMemoryUser = {
        id: 'usr_' + Math.random().toString(36).substring(2, 11),
        email,
        password: passwordHash,
        name,
        hashedRefreshToken: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.inMemoryFallbackUsers.set(fallbackUser.id, fallbackUser);
      return fallbackUser;
    }
  }
}
