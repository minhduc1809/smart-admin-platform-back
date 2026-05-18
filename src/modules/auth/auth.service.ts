import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import type { StringValue } from 'ms';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  jti?: string;
}

@Injectable()
export class AuthService {
  private readonly keycloakUrl: string;
  private readonly realm: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {
    this.keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
    this.realm = process.env.KEYCLOAK_REALM || 'smart-admin';
    this.clientId = process.env.KEYCLOAK_CLIENT_ID || 'smart-admin-backend';
    this.clientSecret =
      process.env.KEYCLOAK_CLIENT_SECRET || 'smart-admin-backend-secret';
  }

  // ---------------------------------------------------------------------------
  // Local JWT Auth
  // ---------------------------------------------------------------------------

  async login(email: string, pass: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    if (!user || !user.isActive || !user.passwordHash)
      throw new UnauthorizedException('error.INVALID_CREDENTIALS');

    const isValid = await bcrypt.compare(pass, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('error.INVALID_CREDENTIALS');

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: (process.env.JWT_ACCESS_EXPIRATION ?? '15m') as StringValue,
    });

    const jti = randomUUID();
    const refreshToken = this.jwtService.sign(
      { ...payload, jti },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: (process.env.JWT_REFRESH_EXPIRATION ?? '7d') as StringValue,
      },
    );

    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        token: await bcrypt.hash(refreshToken, 10),
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safeUser } = user;
    return { accessToken, refreshToken, user: safeUser };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { username: dto.username }],
      },
    });

    if (existing) {
      throw new ConflictException('error.CONFLICT');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: 'USER',
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } = user;
    return result;
  }

  async refreshToken(token: string) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
      let validRecord: any = null;

      if (payload.jti) {
        // O(1) lookup by jti — single DB hit + single bcrypt compare
        const t = await this.prisma.refreshToken.findUnique({
          where: { id: payload.jti },
        });
        if (
          t &&
          (await bcrypt.compare(token, t.token)) &&
          t.expiresAt > new Date()
        ) {
          validRecord = t;
        }
      } else {
        // Fallback for legacy tokens without jti
        const tokens = await this.prisma.refreshToken.findMany({
          where: { userId: payload.sub },
        });
        for (const t of tokens) {
          if (
            (await bcrypt.compare(token, t.token)) &&
            t.expiresAt > new Date()
          ) {
            validRecord = t;
            break;
          }
        }
      }

      if (!validRecord)
        throw new UnauthorizedException('error.INVALID_REFRESH_TOKEN');

      const newAccessToken = this.jwtService.sign(
        {
          sub: payload.sub,
          email: payload.email,
          role: payload.role,
        } as JwtPayload,
        {
          secret: process.env.JWT_ACCESS_SECRET,
          expiresIn: (process.env.JWT_ACCESS_EXPIRATION ??
            '15m') as StringValue,
        },
      );

      return { accessToken: newAccessToken };
    } catch {
      throw new UnauthorizedException('error.INVALID_REFRESH_TOKEN');
    }
  }

  async logout(token: string, userId: string) {
    // Fast path: decode jti for O(1) lookup
    try {
      const payload = this.jwtService.decode(token) as JwtPayload;
      if (payload?.jti) {
        const t = await this.prisma.refreshToken.findUnique({
          where: { id: payload.jti },
        });
        if (t && (await bcrypt.compare(token, t.token))) {
          await this.prisma.refreshToken.delete({ where: { id: t.id } });
        }
        return { success: true };
      }
    } catch {
      // Decode failed — fall through to legacy path
    }

    // Legacy fallback for tokens without jti
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId },
    });
    for (const t of tokens) {
      if (await bcrypt.compare(token, t.token)) {
        await this.prisma.refreshToken.delete({ where: { id: t.id } });
      }
    }
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Keycloak Auth
  // ---------------------------------------------------------------------------

  private get tokenEndpoint() {
    return `${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/token`;
  }

  private get logoutEndpoint() {
    return `${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/logout`;
  }

  async loginViaKeycloak(email: string, password: string) {
    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      username: email,
      password,
      scope: 'openid',
    });

    const res = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      throw new UnauthorizedException('error.INVALID_CREDENTIALS');
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
    };
  }

  async logoutFromKeycloak(refreshToken: string) {
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
    });

    const res = await fetch(this.logoutEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      return { success: false };
    }

    return { success: true };
  }

  async getMe(userId: string, keycloakId?: string) {
    const where = keycloakId ? { keycloakId } : { id: userId };
    const user = await this.prisma.user.findUnique({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        firstName: true,
        lastName: true,
        picture: true,
        isActive: true,
        createdAt: true,
      },
    });
    return user;
  }
}
