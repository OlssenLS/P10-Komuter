export interface UserDto {
  id: string;
  email: string;
  username: string;
  name: string;
  avatarUrl?: string | null;
  points: number;
  level: number;
  role: string;
  createdAt: string;
}

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface AuthSuccessResponse {
  user: UserDto;
  tokens: AuthTokenResponse;
}

export interface ActionStatusResponse {
  success: boolean;
  message?: string;
}
