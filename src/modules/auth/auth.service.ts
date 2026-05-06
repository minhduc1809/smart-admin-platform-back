import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(email: string, pass: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    if (!user || !user.isActive)
      throw new UnauthorizedException('error.INVALID_CREDENTIALS');

    const isValid = await bcrypt.compare(pass, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('error.INVALID_CREDENTIALS');

    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET as string,
      expiresIn: process.env.JWT_ACCESS_EXPIRATION as any,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET as string,
      expiresIn: process.env.JWT_REFRESH_EXPIRATION as any,
    });

    // Save refresh token to DB
    await this.prisma.refreshToken.create({
      data: {
        token: await bcrypt.hash(refreshToken, 10), // Hash before storing
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return { accessToken, refreshToken };
  }

  async register(dto: any) {
    // Kiểm tra xem email hoặc username đã tồn tại chưa
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

    const { passwordHash: _, ...result } = user;
    return result;
  }

  async refreshToken(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_REFRESH_SECRET as string,
      });
      const tokens = await this.prisma.refreshToken.findMany({
        where: { userId: payload.sub },
      });

      let validRecord: any = null;
      for (const t of tokens) {
        if (
          (await bcrypt.compare(token, t.token)) &&
          t.expiresAt > new Date()
        ) {
          validRecord = t;
          break;
        }
      }

      if (!validRecord)
        throw new UnauthorizedException('error.INVALID_REFRESH_TOKEN');

      const newAccessToken = this.jwtService.sign(
        { sub: payload.sub, email: payload.email, role: payload.role },
        {
          secret: process.env.JWT_ACCESS_SECRET as string,
          expiresIn: process.env.JWT_ACCESS_EXPIRATION as any,
        },
      );

      return { accessToken: newAccessToken };
    } catch (e) {
      throw new UnauthorizedException('error.INVALID_REFRESH_TOKEN');
    }
  }

  async logout(token: string, userId: string) {
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
}
