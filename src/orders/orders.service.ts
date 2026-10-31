import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { Prisma } from '../../generated/prisma/client';
import { UpdateOrderDto } from './dto/update-order.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrderDto) {
    const { items, ...data } = dto;
    try {
      return await this.prisma.order.create({
        data: { ...data, items: { create: items } },
        include: { items: true },
      });
    } catch (error) {
      this.handleUniqueViolation(error, dto.number);
    }
  }

  async findAll(filters: FilterOrdersDto) {
    const {
      number,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = filters;

    if (startDate && endDate && startDate > endDate) {
      throw new BadRequestException('startDate não pode ser maior que endDate');
    }

    const where: Prisma.OrderWhereInput = {
      deletedAt: null,
      ...(number && { number: { contains: number, mode: 'insensitive' } }),
      ...(status && { status }),
      ...((startDate || endDate) && {
        forecastDate: { gte: startDate, lte: endDate },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, deletedAt: null },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');
    return order;
  }

  async update(id: string, dto: UpdateOrderDto) {
    await this.findOne(id);
    const { items, ...data } = dto;
    try {
      return await this.prisma.order.update({
        where: { id },
        data: {
          ...data,
          ...(items && { items: { deleteMany: {}, create: items } }),
        },
        include: { items: true },
      });
    } catch (error) {
      this.handleUniqueViolation(error, dto.number);
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.order.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private handleUniqueViolation(error: unknown, number?: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(`Já existe um pedido com o número ${number}`);
    }
    throw error;
  }
}
