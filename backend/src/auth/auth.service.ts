import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
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
  username: string;
  password: string;
  name: string;
  avatarUrl: string | null;
  points: number;
  level: number;
  role: 'COMMUTER' | 'ADMIN';
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
    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedUsername = dto.username.trim().toLowerCase();

    const existingEmail = await this.findUserByEmail(normalizedEmail);
    if (existingEmail) {
      throw new ConflictException('An account with this email address already exists');
    }

    const existingUsername = await this.findUserByUsername(normalizedUsername);
    if (existingUsername) {
      throw new ConflictException('This username is already taken');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.createUser({
      email: normalizedEmail,
      username: normalizedUsername,
      password: hashedPassword,
      name: dto.name.trim(),
      avatarUrl: dto.avatarUrl,
    });

    const tokens = await this.generateTokens(user.id, user.email, user.username, user.role);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.mapToUserDto(user),
      tokens,
    };
  }

  async login(dto: LoginDto): Promise<AuthSuccessResponse> {
    const identifier = (dto.identifier || dto.email || dto.username || '').trim();
    if (!identifier) {
      throw new BadRequestException('Please provide an email or username');
    }

    const user = await this.findUserByIdentifier(identifier);
    if (!user) {
      throw new UnauthorizedException('Invalid email/username or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email/username or password');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.username, user.role);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.mapToUserDto(user),
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

    const tokens = await this.generateTokens(user.id, user.email, user.username, user.role);
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

  async getProfile(userId: string): Promise<UserDto> {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.mapToUserDto(user);
  }

  private mapToUserDto(user: any): UserDto {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      avatarUrl: user.avatarUrl ?? null,
      points: user.points ?? 0,
      level: user.level ?? 1,
      role: user.role ?? 'COMMUTER',
      createdAt:
        user.createdAt instanceof Date
          ? user.createdAt.toISOString()
          : new Date(user.createdAt).toISOString(),
    };
  }

  private async generateTokens(
    userId: string,
    email: string,
    username: string,
    role: string,
  ): Promise<AuthTokenResponse> {
    const accessSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') || 'komuter_access_secret_key';
    const accessExpiresIn =
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m';
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') || 'komuter_refresh_secret_key';
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';

    const payload = { sub: userId, email, username, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: accessExpiresIn as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn as any,
      }),
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

  private async findUserByEmail(email: string): Promise<any | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });
      if (user) return user;
    } catch {
      // Fallback if Postgres table not reachable
    }

    for (const u of this.inMemoryFallbackUsers.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        return u;
      }
    }
    return null;
  }

  private async findUserByUsername(username: string): Promise<any | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { username },
      });
      if (user) return user;
    } catch {
      // Fallback if Postgres table not reachable
    }

    for (const u of this.inMemoryFallbackUsers.values()) {
      if (u.username.toLowerCase() === username.toLowerCase()) {
        return u;
      }
    }
    return null;
  }

  private async findUserByIdentifier(identifier: string): Promise<any | null> {
    if (identifier.includes('@')) {
      return this.findUserByEmail(identifier.toLowerCase());
    }

    // Try finding by username first, if not found try email
    const byUsername = await this.findUserByUsername(identifier.toLowerCase());
    if (byUsername) return byUsername;

    return this.findUserByEmail(identifier.toLowerCase());
  }

  private async findUserById(id: string): Promise<any | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
      });
      if (user) return user;
    } catch {
      // Fallback if Postgres table not reachable
    }

    return this.inMemoryFallbackUsers.get(id) || null;
  }

  private async createUser(data: {
    email: string;
    username: string;
    password: string;
    name: string;
    avatarUrl?: string;
  }): Promise<any> {
    try {
      return await this.prisma.user.create({
        data: {
          email: data.email,
          username: data.username,
          password: data.password,
          name: data.name,
          avatarUrl: data.avatarUrl,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Prisma create user deferred to fallback memory store: ${err.message}`);
      const fallbackUser: InMemoryUser = {
        id: 'usr_' + Math.random().toString(36).substring(2, 11),
        email: data.email,
        username: data.username,
        password: data.password,
        name: data.name,
        avatarUrl: data.avatarUrl ?? null,
        points: 0,
        level: 1,
        role: 'COMMUTER',
        hashedRefreshToken: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.inMemoryFallbackUsers.set(fallbackUser.id, fallbackUser);
      return fallbackUser;
    }
  }
}
