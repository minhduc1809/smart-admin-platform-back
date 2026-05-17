import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  const bcryptMock = bcrypt as jest.Mocked<typeof bcrypt>;

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as PrismaService;

    jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    } as unknown as JwtService;

    service = new AuthService(prisma, jwtService);
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
    });
    bcryptMock.compare.mockResolvedValue(true);
    bcryptMock.hash.mockResolvedValue('hashed-refresh');
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
});
