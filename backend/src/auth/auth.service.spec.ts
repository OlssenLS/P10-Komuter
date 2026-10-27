import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('AuthService', () => {
  let authService: AuthService;
  let jwtService: JwtService;

  const mockPrismaService = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };

  const mockConfigService = {
    get: vi.fn((key: string) => {
      switch (key) {
        case 'JWT_ACCESS_SECRET':
          return 'test_access_secret_123';
        case 'JWT_ACCESS_EXPIRES_IN':
          return '15m';
        case 'JWT_REFRESH_SECRET':
          return 'test_refresh_secret_123';
        case 'JWT_REFRESH_EXPIRES_IN':
          return '7d';
        default:
          return null;
      }
    }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('signup', () => {
    const signupDto = {
      email: 'commuter@komutin.id',
      username: 'jakartarider',
      password: 'password123',
      name: 'Budi Santoso',
      avatarUrl: 'https://example.com/avatar.png',
    };

    it('should successfully register a new commuter and return tokens and user profile', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-uuid-1',
        email: signupDto.email,
        username: signupDto.username,
        password: '$2b$10$hashedpasswordstring',
        name: signupDto.name,
        avatarUrl: signupDto.avatarUrl,
        points: 0,
        level: 1,
        role: 'COMMUTER',
        hashedRefreshToken: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      mockPrismaService.user.update.mockResolvedValue({});

      const response = await authService.signup(signupDto);

      // Verify user profile in response
      expect(response.user).toEqual({
        id: 'user-uuid-1',
        email: 'commuter@komutin.id',
        username: 'jakartarider',
        name: 'Budi Santoso',
        avatarUrl: 'https://example.com/avatar.png',
        points: 0,
        level: 1,
        role: 'COMMUTER',
        createdAt: '2026-01-01T00:00:00.000Z',
      });

      // Verify JWT tokens
      expect(response.tokens).toBeDefined();
      expect(response.tokens.accessToken).toBeDefined();
      expect(response.tokens.refreshToken).toBeDefined();
      expect(response.tokens.tokenType).toBe('Bearer');
      expect(response.tokens.expiresIn).toBe(900);

      // Verify decoded access token payload contains sub, email, username, role
      const decodedAccess: any = jwtService.verify(response.tokens.accessToken, {
        secret: 'test_access_secret_123',
      });
      expect(decodedAccess.sub).toBe('user-uuid-1');
      expect(decodedAccess.email).toBe('commuter@komutin.id');
      expect(decodedAccess.username).toBe('jakartarider');
      expect(decodedAccess.role).toBe('COMMUTER');

      // Verify refresh token payload
      const decodedRefresh: any = jwtService.verify(response.tokens.refreshToken, {
        secret: 'test_refresh_secret_123',
      });
      expect(decodedRefresh.sub).toBe('user-uuid-1');
      expect(decodedRefresh.email).toBe('commuter@komutin.id');
      expect(decodedRefresh.username).toBe('jakartarider');
      expect(decodedRefresh.role).toBe('COMMUTER');
    });

    it('should throw ConflictException if email is already taken', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: 'existing-id',
        email: signupDto.email,
      });

      await expect(authService.signup(signupDto)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if username is already taken', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce({ id: 'existing-id', username: signupDto.username }); // username check

      await expect(authService.signup(signupDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    const existingUser = {
      id: 'user-uuid-1',
      email: 'commuter@komutin.id',
      username: 'jakartarider',
      // bcrypt hash of 'password123'
      password: '$2b$10$epsk3xvh3a78m7GfO27F3.b02t55s5sJv1Zq3f421Xz01q2345678',
      name: 'Budi Santoso',
      avatarUrl: null,
      points: 120,
      level: 2,
      role: 'COMMUTER',
      hashedRefreshToken: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    beforeEach(async () => {
      const bcrypt = await import('bcrypt');
      existingUser.password = await bcrypt.hash('password123', 10);
    });

    it('should login successfully using email and return JWT tokens', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.user.update.mockResolvedValue({});

      const response = await authService.login({
        email: 'commuter@komutin.id',
        password: 'password123',
      });

      expect(response.user.username).toBe('jakartarider');
      expect(response.user.email).toBe('commuter@komutin.id');
      expect(response.user.points).toBe(120);
      expect(response.tokens.accessToken).toBeDefined();
      expect(response.tokens.refreshToken).toBeDefined();

      const decoded: any = jwtService.verify(response.tokens.accessToken, {
        secret: 'test_access_secret_123',
      });
      expect(decoded.sub).toBe('user-uuid-1');
      expect(decoded.username).toBe('jakartarider');
    });

    it('should login successfully using username and return JWT tokens', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.user.update.mockResolvedValue({});

      const response = await authService.login({
        username: 'jakartarider',
        password: 'password123',
      });

      expect(response.user.email).toBe('commuter@komutin.id');
      expect(response.tokens.accessToken).toBeDefined();
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);

      await expect(
        authService.login({
          email: 'commuter@komutin.id',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'nonexistent@komutin.id',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    it('should return new JWT tokens when given a valid refresh token', async () => {
      const bcrypt = await import('bcrypt');
      const refreshToken = 'sample-valid-refresh-token';
      const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

      const user = {
        id: 'user-uuid-1',
        email: 'commuter@komutin.id',
        username: 'jakartarider',
        role: 'COMMUTER',
        hashedRefreshToken,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.user.update.mockResolvedValue({});

      const tokens = await authService.refreshTokens('user-uuid-1', refreshToken);

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.tokenType).toBe('Bearer');
    });

    it('should throw ForbiddenException if refresh token is invalid', async () => {
      const bcrypt = await import('bcrypt');
      const hashedRefreshToken = await bcrypt.hash('correct-token', 10);

      const user = {
        id: 'user-uuid-1',
        email: 'commuter@komutin.id',
        username: 'jakartarider',
        role: 'COMMUTER',
        hashedRefreshToken,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      await expect(
        authService.refreshTokens('user-uuid-1', 'wrong-refresh-token'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('logout', () => {
    it('should clear refresh token and return success response', async () => {
      mockPrismaService.user.update.mockResolvedValue({});

      const result = await authService.logout('user-uuid-1');
      expect(result.success).toBe(true);
      expect(result.message).toBe('Successfully logged out');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: { hashedRefreshToken: null },
      });
    });
  });

  describe('getProfile', () => {
    it('should return user profile for an existing user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-uuid-1',
        email: 'commuter@komutin.id',
        username: 'jakartarider',
        name: 'Budi Santoso',
        avatarUrl: null,
        points: 50,
        level: 1,
        role: 'COMMUTER',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      const profile = await authService.getProfile('user-uuid-1');
      expect(profile.id).toBe('user-uuid-1');
      expect(profile.username).toBe('jakartarider');
      expect(profile.points).toBe(50);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      await expect(authService.getProfile('nonexistent-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
