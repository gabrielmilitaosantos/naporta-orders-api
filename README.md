# Naporta Orders API

API REST para gerenciamento de pedidos, desenvolvida com **NestJS**, **Prisma** e **PostgreSQL**, com autenticação via **JWT**.

## Funcionalidades

- Autenticação JWT via header `Authorization: Bearer <token>`
- Criação, listagem, edição e exclusão de pedidos (com **soft delete**)
- Filtros por número, status e período, com paginação
- Rate limit global e mais restrito no login
- Seed com usuário administrador e pedidos fictícios
- Testes unitários, linter, Docker
## Stack

| Item           | Tecnologia                       |
| -------------- | -------------------------------- |
| Framework      | NestJS 11                        |
| Banco de dados | PostgreSQL 16                    |
| ORM            | Prisma 7 (driver adapter `pg`)   |
| Autenticação   | Passport + JWT                   |
| Validação      | class-validator / class-transformer |
| Rate limit     | @nestjs/throttler                |
| Testes         | Jest                             |

## Pré-requisitos

- Node.js 22.12+ (recomendado 24)
- npm
- Docker e Docker Compose
## Configuração

1. Crie o arquivo `.env` a partir do exemplo:
```bash
   # Linux/macOS
   cp .env.example .env
   # Windows (CMD)
   copy .env.example .env
```

2. Preencha o `JWT_SECRET` com um valor aleatório de pelo menos 32 bytes:
```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

3. Instale as dependências (o `postinstall` gera o Prisma Client e usa o `.env`):
```bash
   npm install
```

### Variáveis de ambiente

| Variável         | Descrição                                          | Padrão |
| ---------------- | -------------------------------------------------- | ------ |
| `DATABASE_URL`   | String de conexão do PostgreSQL                    | —      |
| `ADMIN_PASSWORD` | Senha do admin criado pelo seed                    | `admin123` |
| `JWT_SECRET`     | Segredo usado para assinar os tokens               | —      |
| `JWT_EXPIRES_IN` | Validade do token                                  | `1d`   |
| `THROTTLE_TTL`   | Janela do rate limit global (ms)                   | `60000` |
| `THROTTLE_LIMIT` | Requisições por janela no rate limit global        | `100`  |
| `PORT`           | Porta da API                                       | `3000` |

## Executando

### Opção 1: desenvolvimento local (API na máquina, banco no Docker)

```bash
# 1. Sobe apenas o banco
docker compose up -d postgres
 
# 2. Aplica as migrations
npm run db:migrate
 
# 3. Popula o banco (admin + pedidos fictícios)
npm run db:seed
 
# 4. Inicia a API em modo watch
npm run start:dev
```

A API fica disponível em `http://localhost:3000`.

### Opção 2: tudo no Docker

Crie e preencha o `.env` antes (passos da seção **Configuração**), pois o compose o utiliza.

```bash
# 1. Sobe o banco e a API (as migrations são aplicadas automaticamente)
docker compose up -d --build
 
# 2. Popula o banco dentro do container (admin + pedidos fictícios)
docker compose exec api node dist/prisma/seed.js
```

Em um banco novo, as tabelas começam vazias, então o passo 2 é necessário para existir o usuário administrador e conseguir fazer login.

Alternativamente, se você tiver as dependências instaladas na máquina (`npm install`), pode popular o banco por fora do container, já que a porta 5432 está exposta: `npm run db:seed`.

Para ver os logs da API: `docker compose logs -f api`. Para parar tudo: `docker compose down` (os dados são mantidos no volume `postgres_data`; use `docker compose down -v` para apagá-los).

## Seed

O comando `npm run db:seed` é idempotente (pode ser executado várias vezes) e cria:

- Usuário administrador: `admin@naporta.com`, com a senha definida em `ADMIN_PASSWORD` (padrão `admin123`)
- 5 pedidos fictícios (`PED-001` a `PED-005`), um para cada status
> Altere a senha do administrador antes de qualquer uso fora de desenvolvimento.

## Autenticação

Faça login para obter o token e envie-o nas demais requisições.

```http
POST /auth/login
Content-Type: application/json
 
{ "email": "admin@naporta.com", "password": "admin123" }
```

Resposta:

```json
{ "accessToken": "<jwt>" }
```

Nas próximas chamadas, use o header `Authorization: Bearer <jwt>`.

Todas as rotas são protegidas por padrão. Somente `POST /auth/login` é pública (`@Public()`). O login permite no máximo **5 requisições por minuto** por IP; ao exceder, a API responde `429 Too Many Requests`.

## Endpoints

| Método | Rota           | Descrição                                   | Resposta de sucesso |
| ------ | -------------- | ------------------------------------------- | ------------------- |
| POST   | `/auth/login`  | Autentica e retorna o token                 | 200                 |
| GET    | `/auth/me`     | Retorna o usuário do token                  | 200                 |
| POST   | `/orders`      | Cria um pedido                              | 201                 |
| GET    | `/orders`      | Lista pedidos (com filtros e paginação)     | 200                 |
| GET    | `/orders/:id`  | Busca um pedido                             | 200                 |
| PATCH  | `/orders/:id`  | Edita um pedido (parcial)                   | 200                 |
| DELETE | `/orders/:id`  | Exclui um pedido (soft delete)              | 204                 |

### Criar pedido

```http
POST /orders
Authorization: Bearer <jwt>
Content-Type: application/json
 
{
  "number": "PED-100",
  "forecastDate": "2026-12-20",
  "status": "PENDING",
  "customerName": "Fulano de Tal",
  "customerDocument": "000.000.000-00",
  "street": "Rua das Flores",
  "streetNumber": "123",
  "complement": "Apto 101",
  "neighborhood": "Centro",
  "city": "São Paulo",
  "state": "SP",
  "zipCode": "01000-000",
  "items": [
    { "description": "Porta de madeira maciça", "price": 1500.00 },
    { "description": "Fechadura premium", "price": 250.00 }
  ]
}
```

`status` é opcional (padrão `PENDING`) e `complement` também. Valores aceitos para `status`: `PENDING`, `CONFIRMED`, `SHIPPED`, `DELIVERED`, `CANCELED`.

### Listar e filtrar pedidos

Todos os parâmetros são opcionais e podem ser combinados:

| Parâmetro   | Descrição                                                        |
| ----------- | ---------------------------------------------------------------- |
| `number`    | Busca parcial pelo número, sem diferenciar maiúsculas/minúsculas |
| `status`    | Status exato do pedido                                           |
| `startDate` | Previsão de entrega a partir desta data (inclusive)              |
| `endDate`   | Previsão de entrega até esta data (inclusive)                    |
| `page`      | Página (padrão `1`)                                              |
| `limit`     | Itens por página (padrão `10`, máximo `100`)                     |

Exemplo:

```http
GET /orders?status=PENDING&startDate=2026-11-01&endDate=2026-11-30&page=1&limit=10
```

Resposta:

```json
{
  "data": [ { "id": "...", "number": "PED-001", "items": [ ... ] } ],
  "meta": { "total": 1, "page": 1, "limit": 10, "totalPages": 1 }
}
```

### Editar pedido

`PATCH /orders/:id` aceita qualquer subconjunto dos campos do pedido. Se `items` for enviado, a lista de itens é **substituída** por completo.

### Excluir pedido

`DELETE /orders/:id` realiza **soft delete**: o registro permanece no banco com `deleted_at` preenchido e deixa de aparecer nas consultas da API.

### Erros

| Status | Quando                                                        |
| ------ | ------------------------------------------------------------- |
| 400    | Dados inválidos (as mensagens de validação vêm no corpo)      |
| 401    | Token ausente, inválido ou expirado; credenciais incorretas   |
| 404    | Pedido inexistente ou já excluído                             |
| 409    | Já existe um pedido com o mesmo número                        |
| 429    | Rate limit excedido                                           |

## Testes e qualidade

```bash
npm test           # testes unitários
npm run test:cov   # testes com cobertura
npm run lint       # ESLint
```

Os testes unitários cobrem os serviços de pedidos e de autenticação, com o Prisma mockado (não exigem banco).

## Decisões de projeto

- **Filtro de período**: aplicado sobre a data de previsão de entrega (`forecastDate`).
- **Número do pedido**: informado na criação e único. Pedidos excluídos continuam ocupando o número.
- **Soft delete**: campo `deletedAt`; todas as consultas filtram `deletedAt: null`.
- **Valores monetários**: `Decimal(10,2)` no banco, evitando erros de ponto flutuante. Na resposta JSON, o preço é serializado como string.
- **Segurança**: guard JWT global com `@Public()` para rotas abertas, rate limit global e mais restrito no login, senhas com bcrypt.
- **Migrations em produção**: o container da API executa `prisma migrate deploy` ao iniciar.
## Estrutura

```text
prisma/
  schema.prisma       # modelos User, Order e OrderItem
  migrations/
  seed.ts
src/
  auth/               # login, estratégia JWT, guard global e @Public()
  orders/             # controller, service e DTOs de pedidos
  prisma/             # PrismaService (módulo global)
```

## Melhorias futuras

- Validação de CPF/CNPJ em `customerDocument`
- Testes e2e
- Documentação OpenAPI/Swagger
- Controle de transições de status do pedido