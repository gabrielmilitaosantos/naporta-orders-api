import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, OrderStatus, Prisma } from '../generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const orders: Prisma.OrderCreateInput[] = [
  {
    number: 'PED-001',
    forecastDate: new Date('2026-11-15'),
    status: OrderStatus.PENDING,
    customerName: 'João Silva',
    customerDocument: '123.456.789-00',
    street: 'Rua das Flores',
    streetNumber: '123',
    complement: 'Apto 101',
    neighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01000-000',
    items: {
      create: [
        {
          description: 'Porta de madeira maciça',
          price: new Prisma.Decimal('1500.00'),
        },
        {
          description: 'Fechadura premium',
          price: new Prisma.Decimal('250.00'),
        },
      ],
    },
  },
  {
    number: 'PED-002',
    forecastDate: new Date('2026-11-20'),
    status: OrderStatus.CONFIRMED,
    customerName: 'Maria Santos',
    customerDocument: '987.654.321-00',
    street: 'Av. Paulista',
    streetNumber: '1000',
    complement: null,
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01310-100',
    items: {
      create: [
        {
          description: 'Porta pivotante',
          price: new Prisma.Decimal('3500.00'),
        },
        {
          description: 'Puxador em aço inox',
          price: new Prisma.Decimal('180.00'),
        },
      ],
    },
  },
  {
    number: 'PED-003',
    forecastDate: new Date('2026-12-01'),
    status: OrderStatus.SHIPPED,
    customerName: 'Pedro Oliveira',
    customerDocument: '456.789.123-00',
    street: 'Rua Augusta',
    streetNumber: '500',
    complement: 'Sala 205',
    neighborhood: 'Consolação',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01305-100',
    items: {
      create: [
        {
          description: 'Porta de correr dupla',
          price: new Prisma.Decimal('4200.00'),
        },
      ],
    },
  },
  {
    number: 'PED-004',
    forecastDate: new Date('2026-11-10'),
    status: OrderStatus.DELIVERED,
    customerName: 'Ana Costa',
    customerDocument: '321.654.987-00',
    street: 'Rua Oscar Freire',
    streetNumber: '800',
    complement: null,
    neighborhood: 'Jardins',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01426-001',
    items: {
      create: [
        { description: 'Porta camarão', price: new Prisma.Decimal('2800.00') },
        {
          description: 'Instalação completa',
          price: new Prisma.Decimal('450.00'),
        },
      ],
    },
  },
  {
    number: 'PED-005',
    forecastDate: new Date('2026-12-15'),
    status: OrderStatus.CANCELED,
    customerName: 'Carlos Souza',
    customerDocument: '654.321.987-00',
    street: 'Al. Santos',
    streetNumber: '200',
    complement: 'Conj 52',
    neighborhood: 'Paraíso',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01418-000',
    items: {
      create: [
        { description: 'Porta blindada', price: new Prisma.Decimal('8500.00') },
      ],
    },
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(
    process.env.ADMIN_PASSWORD ?? 'admin123',
    10,
  );

  const admin = await prisma.user.upsert({
    where: { email: 'admin@naporta.com' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@naporta.com',
      passwordHash,
    },
  });

  console.log('✔️ Usuário admin criado:', admin.email);

  for (const orderData of orders) {
    const order = await prisma.order.upsert({
      where: { number: orderData.number },
      update: {},
      create: orderData,
    });
    console.log('✔️ Pedido criado:', order.number);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
