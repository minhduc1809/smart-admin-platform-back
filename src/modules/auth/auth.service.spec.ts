import { UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
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
      sendResetOtpEmail: jest.fn(),
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
      expect(mailService.sendResetOtpEmail).not.toHaveBeenCalled();
    });

    it('generates reset OTP, updates user and calls mailService', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'user@demo.com',
        isActive: true,
        tenantId: 't1',
      });

      const result = await service.forgotPassword('user@demo.com');
      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalled();
      expect(mailService.sendResetOtpEmail).toHaveBeenCalled();
      const otp = mailService.sendResetOtpEmail.mock.calls[0][1];
      expect(otp).toMatch(/^\d{6}$/);
    });
  });

  describe('verifyResetOtp', () => {
    it('throws BadRequestException when OTP does not match', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'user@demo.com',
        passwordResetHash: 'some-other-hash',
        passwordResetExpiresAt: new Date(Date.now() + 60_000),
      });

      await expect(service.verifyResetOtp('user@demo.com', '123456')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws BadRequestException when OTP is expired', async () => {
      const otp = '123456';
      const hash = createHash('sha256').update(`u1:${otp}`).digest('hex');
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'user@demo.com',
        passwordResetHash: hash,
        passwordResetExpiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.verifyResetOtp('user@demo.com', otp)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('returns a resetToken and replaces the OTP hash when valid', async () => {
      const otp = '123456';
      const hash = createHash('sha256').update(`u1:${otp}`).digest('hex');
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'user@demo.com',
        passwordResetHash: hash,
        passwordResetExpiresAt: new Date(Date.now() + 60_000),
      });

      const result = await service.verifyResetOtp('user@demo.com', otp);

      expect(result.success).toBe(true);
      expect(typeof result.resetToken).toBe('string');
      expect(result.resetToken).toHaveLength(64);
      // the stored hash must be swapped to the new token's hash, not the OTP's
      const updatedHash = prisma.user.update.mock.calls[0][0].data.passwordResetHash;
      expect(updatedHash).not.toBe(hash);
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
