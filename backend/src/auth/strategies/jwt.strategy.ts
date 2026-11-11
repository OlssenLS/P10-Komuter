import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  email: string;
  username?: string;
  role?: string;
  user_metadata?: {
    name?: string;
    username?: string;
  };
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('SUPABASE_JWT_SECRET') ||
        configService.get<string>('JWT_ACCESS_SECRET') ||
        'komuter_access_secret_key',
    });
  }

  validate(payload: JwtPayload) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid access token payload');
    }
    return {
      id: payload.sub,
      email: payload.email,
      username:
        payload.user_metadata?.username || payload.username || payload.email,
      role: payload.role,
    };
  }
}
