import { UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
import { MailService } from '../mail/mail.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  let mailService: any;
  const bcryptMock = bcrypt as jest.Mocked<typeof bcrypt>;

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    } as unknown as PrismaService;

    jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    } as unknown as JwtService;

    mailService = {
      sendResetPasswordEmail: jest.fn(),
    } as unknown as MailService;

    service = new AuthService(prisma, jwtService, mailService);
  });

  it('login throws when user not found', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.login('user@demo.com', 'pass')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('login returns tokens and safe user', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      email: 'user@demo.com',
      role: 'USER',
      isActive: true,
      passwordHash: 'hashed',
      tenantId: 't1',
    });
    bcryptMock.compare.mockResolvedValue(true as never);
    (bcryptMock.hash as jest.Mock).mockResolvedValue('hashed-refresh');
    jwtService.sign
      .mockReturnValueOnce('access-token')
      .mockReturnValueOnce('refresh-token');
    prisma.refreshToken.create.mockResolvedValue({ id: 'r1' });

    const result = await service.login('user@demo.com', 'pass');

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect('passwordHash' in result.user).toBe(false);
  });

  it('refreshToken throws when token is invalid', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('invalid');
    });

    await expect(service.refreshToken('bad-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  describe('forgotPassword', () => {
    it('returns success even if user not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      const result = await service.forgotPassword('none@demo.com');
      expect(result.success).toBe(true);
      expect(result.message).toBe('auth.FORGOT_PASSWORD_SENT');
      expect(mailService.sendResetPasswordEmail).not.toHaveBeenCalled();
    });

    it('generates reset token, updates user and calls mailService', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'user@demo.com',
        isActive: true,
        tenantId: 't1',
      });

      const result = await service.forgotPassword('user@demo.com');
      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalled();
      expect(mailService.sendResetPasswordEmail).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('throws BadRequestException if token is invalid or expired', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.resetPassword('badtoken', 'newpass')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('resets password, clears reset fields, and revokes tokens', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'user@demo.com',
      });
      (bcryptMock.hash as jest.Mock).mockResolvedValue('hashed-newpass');

      const result = await service.resetPassword('goodtoken', 'newpass');
      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: {
          passwordHash: 'hashed-newpass',
          passwordResetHash: null,
          passwordResetExpiresAt: null,
          passwordChangeRequired: false,
        },
      });
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
      });
    });
  });

  describe('changePassword', () => {
    it('throws NotFoundException if user not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.changePassword('u1', 'old', 'new')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws BadRequestException if old password does not match', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        passwordHash: 'hashed-old',
      });
      bcryptMock.compare.mockResolvedValue(false as never);

      await expect(service.changePassword('u1', 'wrong-old', 'new')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('updates password and deletes refresh tokens on success', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        passwordHash: 'hashed-old',
      });
      bcryptMock.compare.mockResolvedValue(true as never);
      (bcryptMock.hash as jest.Mock).mockResolvedValue('hashed-new');

      const result = await service.changePassword('u1', 'old', 'new');
      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: {
          passwordHash: 'hashed-new',
          passwordChangeRequired: false,
        },
      });
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
      });
    });
  });
});
