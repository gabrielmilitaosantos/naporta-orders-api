import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, Prisma } from '../../generated/prisma/client';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

describe('OrdersService', () => {
  let service: OrdersService;

  const prismaMock = {
    order: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const createDto: CreateOrderDto = {
    number: 'PED-100',
    forecastDate: new Date('2026-12-01'),
    customerName: 'Fulano',
    customerDocument: '000.000.000-00',
    street: 'Rua A',
    streetNumber: '10',
    neighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01000-000',
    items: [{ description: 'Porta', price: 100 }],
  };

  const uniqueViolation = () =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(OrdersService);
  });

  describe('create', () => {
    it('cria o pedido com os itens aninhados', async () => {
      prismaMock.order.create.mockResolvedValue({ id: '1' });

      const result = await service.create(createDto);

      const { items, ...data } = createDto;
      expect(prismaMock.order.create).toHaveBeenCalledWith({
        data: { ...data, items: { create: items } },
        include: { items: true },
      });
      expect(result).toEqual({ id: '1' });
    });

    it('lança ConflictException quando o número já existe', async () => {
      prismaMock.order.create.mockRejectedValue(uniqueViolation());

      await expect(service.create(createDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('repassa erros inesperados', async () => {
      const error = new Error('db fora do ar');
      prismaMock.order.create.mockRejectedValue(error);

      await expect(service.create(createDto)).rejects.toBe(error);
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      prismaMock.$transaction.mockResolvedValue([[{ id: '1' }], 25]);
    });

    it('lista apenas pedidos não excluídos, com paginação padrão', async () => {
      const result = await service.findAll({ page: 1, limit: 10 });

      expect(prismaMock.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
          skip: 0,
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result.meta).toEqual({
        total: 25,
        page: 1,
        limit: 10,
        totalPages: 3,
      });
    });

    it('aplica filtros de número, status e período', async () => {
      const startDate = new Date('2026-11-01');
      const endDate = new Date('2026-11-30');

      await service.findAll({
        number: 'ped',
        status: OrderStatus.PENDING,
        startDate,
        endDate,
        page: 2,
        limit: 10,
      });

      expect(prismaMock.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            deletedAt: null,
            number: { contains: 'ped', mode: 'insensitive' },
            status: OrderStatus.PENDING,
            forecastDate: { gte: startDate, lte: endDate },
          },
          skip: 10,
          take: 10,
        }),
      );
    });

    it('rejeita período invertido', async () => {
      await expect(
        service.findAll({
          startDate: new Date('2026-12-01'),
          endDate: new Date('2026-11-01'),
          page: 1,
          limit: 10,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('retorna o pedido, ignorando excluídos', async () => {
      prismaMock.order.findFirst.mockResolvedValue({ id: '1' });

      await expect(service.findOne('1')).resolves.toEqual({ id: '1' });
      expect(prismaMock.order.findFirst).toHaveBeenCalledWith({
        where: { id: '1', deletedAt: null },
        include: { items: true },
      });
    });

    it('lança NotFoundException quando não encontra', async () => {
      prismaMock.order.findFirst.mockResolvedValue(null);

      await expect(service.findOne('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('não altera os itens quando eles não são enviados', async () => {
      prismaMock.order.findFirst.mockResolvedValue({ id: '1' });
      prismaMock.order.update.mockResolvedValue({ id: '1' });

      await service.update('1', { status: OrderStatus.CONFIRMED });

      expect(prismaMock.order.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { status: OrderStatus.CONFIRMED },
        include: { items: true },
      });
    });

    it('substitui os itens quando eles não são enviados', async () => {
      const items = [{ description: 'Novo', price: 50 }];
      prismaMock.order.findFirst.mockResolvedValue({ id: '1' });
      prismaMock.order.update.mockResolvedValue({ id: '1' });

      await service.update('1', { items });

      expect(prismaMock.order.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { items: { deleteMany: {}, create: items } },
        include: { items: true },
      });
    });

    it('lança NotFoundException sem tentar atualizar', async () => {
      prismaMock.order.findFirst.mockResolvedValue(null);

      await expect(service.update('x', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prismaMock.order.update).not.toHaveBeenCalled();
    });

    it('lança ConflictException ao trocar para um número existente', async () => {
      prismaMock.order.findFirst.mockResolvedValue({ id: '1' });
      prismaMock.order.update.mockRejectedValue(uniqueViolation());

      await expect(
        service.update('1', { number: 'PED-001' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('remove', () => {
    it('faz soft delete preenchendo deletedAt', async () => {
      prismaMock.order.findFirst.mockResolvedValue({ id: '1' });
      prismaMock.order.update.mockResolvedValue({ id: '1' });

      await service.remove('1');

      expect(prismaMock.order.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('lança NotFoundException para pedido inexistente ou já excluído', async () => {
      prismaMock.order.findFirst.mockResolvedValue(null);

      await expect(service.remove('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prismaMock.order.update).not.toHaveBeenCalled();
    });
  });
});
