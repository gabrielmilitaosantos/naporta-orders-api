import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt');
jest.mock('@nestjs/jwt', () => ({ JwtService: class JwtService {} }));

describe('AuthService', () => {
  let service: AuthService;

  const prismaMock = { user: { findUnique: jest.fn() } };
  const jwtMock = { signAsync: jest.fn() };
  const user = { id: 'u1', email: 'admin@naporta.com', passwordHash: 'hash' };
  const credentials = { email: user.email, password: 'secret123' };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it('retorna o token com credenciais válidas', async () => {
    prismaMock.user.findUnique.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    jwtMock.signAsync.mockResolvedValue('token');

    await expect(service.login(credentials)).resolves.toEqual({
      accessToken: 'token',
    });
    expect(jwtMock.signAsync).toHaveBeenCalledWith({
      sub: 'u1',
      email: user.email,
    });
  });

  it('rejeita senha incorreta', async () => {
    prismaMock.user.findUnique.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(service.login(credentials)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejeita usuário inexistente', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(service.login(credentials)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
