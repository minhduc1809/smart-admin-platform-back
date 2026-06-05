import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import type { StringValue } from 'ms';
import ms from 'ms';
import * as bcrypt from 'bcrypt';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { MailService } from '../mail/mail.service';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  tenantId: string;
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
    private mailService: MailService,
  ) {
    const isProd = process.env.NODE_ENV === 'production';

    const getEnv = (key: string, defaultValue?: string): string => {
      const value = process.env[key];
      if (!value) {
        if (isProd) {
          throw new Error(
            `Environment variable ${key} is required in production`,
          );
        }
        return defaultValue || '';
      }
      return value;
    };

    this.keycloakUrl = getEnv('KEYCLOAK_URL', 'http://localhost:8080');
    this.realm = getEnv('KEYCLOAK_REALM', 'smart-admin');
    this.clientId = getEnv('KEYCLOAK_CLIENT_ID', 'smart-admin-backend');
    this.clientSecret = getEnv(
      'KEYCLOAK_CLIENT_SECRET',
      'smart-admin-backend-secret',
    );
  }

  // ---------------------------------------------------------------------------
  // Local JWT Auth
  // ---------------------------------------------------------------------------

  async login(email: string, pass: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });
    if (!user || !user.isActive || !user.passwordHash)
      throw new UnauthorizedException('error.INVALID_CREDENTIALS');

    const isValid = await bcrypt.compare(pass, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('error.INVALID_CREDENTIALS');

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: (process.env.JWT_ACCESS_EXPIRATION ?? '15m') as StringValue,
    });

    const jti = randomUUID();
    const refreshExpiration = (process.env.JWT_REFRESH_EXPIRATION ??
      '7d') as StringValue;
    const refreshToken = this.jwtService.sign(
      { ...payload, jti },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: refreshExpiration,
      },
    );

    const tokenFamily = randomUUID();
    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        token: await bcrypt.hash(refreshToken, 10),
        userId: user.id,
        tenantId: user.tenantId,
        tokenFamily,
        expiresAt: new Date(Date.now() + ms(refreshExpiration)),
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safeUser } = user;
    return { accessToken, refreshToken, user: safeUser };
  }

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const username = dto.username.toLowerCase();

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existing) {
      throw new ConflictException('error.CONFLICT');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        username,
        passwordHash: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: 'USER',
        passwordChangeRequired: false,
      } as any,
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

      // Token reuse detection: if already revoked, compromise detected
      if (validRecord.isRevoked) {
        await this.prisma.refreshToken.deleteMany({
          where: { tokenFamily: validRecord.tokenFamily },
        });
        throw new UnauthorizedException('error.TOKEN_REUSE_DETECTED');
      }

      // Mark old token as revoked (keep for reuse detection)
      await this.prisma.refreshToken.update({
        where: { id: validRecord.id },
        data: { isRevoked: true },
      });

      const jwtPayload: JwtPayload = {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
        tenantId: payload.tenantId,
      };

      const newAccessToken = this.jwtService.sign(jwtPayload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: (process.env.JWT_ACCESS_EXPIRATION ?? '15m') as StringValue,
      });

      // Rotate: issue a new refresh token in the same family
      const newJti = randomUUID();
      const refreshExpiration = (process.env.JWT_REFRESH_EXPIRATION ??
        '7d') as StringValue;
      const newRefreshToken = this.jwtService.sign(
        { ...jwtPayload, jti: newJti },
        {
          secret: process.env.JWT_REFRESH_SECRET,
          expiresIn: refreshExpiration,
        },
      );

      await this.prisma.refreshToken.create({
        data: {
          id: newJti,
          token: await bcrypt.hash(newRefreshToken, 10),
          userId: payload.sub,
          tenantId: payload.tenantId,
          tokenFamily: validRecord.tokenFamily,
          expiresAt: new Date(Date.now() + ms(refreshExpiration)),
        },
      });

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('error.INVALID_REFRESH_TOKEN');
    }
  }

  async logout(token: string, userId: string) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: process.env.JWT_REFRESH_SECRET,
        ignoreExpiration: true,
      });

      if (payload?.jti) {
        const t = await this.prisma.refreshToken.findUnique({
          where: { id: payload.jti },
        });
        if (t && (await bcrypt.compare(token, t.token))) {
          // Revoke entire token family
          await this.prisma.refreshToken.deleteMany({
            where: { tokenFamily: t.tokenFamily },
          });
        }
        return { success: true };
      }

      // Legacy fallback for tokens without jti
      const tokens = await this.prisma.refreshToken.findMany({
        where: { userId },
      });
      for (const t of tokens) {
        if (await bcrypt.compare(token, t.token)) {
          await this.prisma.refreshToken.deleteMany({
            where: { tokenFamily: t.tokenFamily },
          });
          break;
        }
      }
      return { success: true };
    } catch {
      return { success: true };
    }
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
    const user = await this.prisma.user.findFirst({
      where: where as any,
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        firstName: true,
        lastName: true,
        picture: true,
        isActive: true,
        passwordChangeRequired: true,
        createdAt: true,
      },
    });
    return user;
  }

  async forgotPassword(email: string) {
    const emailLower = email.toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: emailLower, deletedAt: null },
    });

    if (!user || !user.isActive) {
      return { success: true, message: 'auth.FORGOT_PASSWORD_SENT' };
    }

    const token = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetHash: hash,
        passwordResetExpiresAt: expiresAt,
      },
    });

    await this.mailService.sendResetPasswordEmail(user.email, token, user.tenantId);

    return { success: true, message: 'auth.FORGOT_PASSWORD_SENT' };
  }

  async resetPassword(token: string, newPassword: string) {
    const hash = createHash('sha256').update(token).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetHash: hash,
        passwordResetExpiresAt: { gt: new Date() },
        deletedAt: null,
      },
    });

    if (!user) {
      throw new BadRequestException('auth.INVALID_OR_EXPIRED_RESET_TOKEN');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashedPassword,
          passwordResetHash: null,
          passwordResetExpiresAt: null,
          passwordChangeRequired: false,
        },
      });

      await tx.refreshToken.deleteMany({
        where: { userId: user.id },
      });
    });

    return { success: true, message: 'auth.PASSWORD_RESET_SUCCESS' };
  }

  async changePassword(userId: string, oldPass: string, newPass: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user || !user.passwordHash) {
      throw new NotFoundException('user.NOT_FOUND');
    }

    const isValid = await bcrypt.compare(oldPass, user.passwordHash);
    if (!isValid) {
      throw new BadRequestException('auth.INCORRECT_OLD_PASSWORD');
    }

    const hashedPassword = await bcrypt.hash(newPass, 10);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashedPassword,
          passwordChangeRequired: false,
        },
      });

      await tx.refreshToken.deleteMany({
        where: { userId: user.id },
      });
    });

    return { success: true, message: 'auth.PASSWORD_CHANGE_SUCCESS' };
  }
}
