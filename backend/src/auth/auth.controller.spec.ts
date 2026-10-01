import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  let controller: AuthController;

  const mockTokens = {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    tokenType: 'Bearer',
    expiresIn: 900,
  };

  const mockUser = {
    id: 'user-uuid-1',
    email: 'commuter@komutin.id',
    username: 'jakartarider',
    name: 'Budi Santoso',
    avatarUrl: null,
    points: 0,
    level: 1,
    role: 'COMMUTER',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const mockAuthService = {
    signup: vi.fn(),
    login: vi.fn(),
    refreshTokens: vi.fn(),
    logout: vi.fn(),
    getProfile: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should call authService.signup and return user and tokens', async () => {
    const signupDto = {
      email: 'commuter@komutin.id',
      username: 'jakartarider',
      password: 'password123',
      name: 'Budi Santoso',
    };
    mockAuthService.signup.mockResolvedValue({ user: mockUser, tokens: mockTokens });

    const result = await controller.signup(signupDto);
    expect(result).toEqual({ user: mockUser, tokens: mockTokens });
    expect(mockAuthService.signup).toHaveBeenCalledWith(signupDto);
  });

  it('should call authService.login and return user and tokens', async () => {
    const loginDto = {
      email: 'commuter@komutin.id',
      password: 'password123',
    };
    mockAuthService.login.mockResolvedValue({ user: mockUser, tokens: mockTokens });

    const result = await controller.login(loginDto);
    expect(result).toEqual({ user: mockUser, tokens: mockTokens });
    expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
  });

  it('should call authService.refreshTokens with user id and refresh token', async () => {
    const req = {
      user: {
        id: 'user-uuid-1',
        refreshToken: 'valid-refresh-token',
      },
    };
    mockAuthService.refreshTokens.mockResolvedValue(mockTokens);

    const result = await controller.refreshTokens(req, { refreshToken: 'valid-refresh-token' });
    expect(result).toEqual(mockTokens);
    expect(mockAuthService.refreshTokens).toHaveBeenCalledWith('user-uuid-1', 'valid-refresh-token');
  });

  it('should call authService.logout with user id', async () => {
    const req = { user: { id: 'user-uuid-1' } };
    mockAuthService.logout.mockResolvedValue({ success: true, message: 'Successfully logged out' });

    const result = await controller.logout(req);
    expect(result).toEqual({ success: true, message: 'Successfully logged out' });
    expect(mockAuthService.logout).toHaveBeenCalledWith('user-uuid-1');
  });

  it('should call authService.getProfile with user id', async () => {
    const req = { user: { id: 'user-uuid-1' } };
    mockAuthService.getProfile.mockResolvedValue(mockUser);

    const result = await controller.getProfile(req);
    expect(result).toEqual(mockUser);
    expect(mockAuthService.getProfile).toHaveBeenCalledWith('user-uuid-1');
  });
});
