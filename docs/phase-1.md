# ClientFlow Phase 1

This repository contains the Phase 1 foundation for ClientFlow:

- React, TypeScript, Vite dashboard in `apps/web`
- Express, TypeScript, Prisma REST API in `apps/api`
- Shared validation, types, and UI primitives in `packages`
- PostgreSQL, API, and web services in Docker Compose

## Local Development

1. Copy environment files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

2. Install dependencies:

```bash
npm install
```

3. Start PostgreSQL:

```bash
docker compose up postgres
```

4. Run Prisma:

```bash
npm run prisma:generate -w apps/api
npm run prisma:migrate -w apps/api
npm run prisma:seed -w apps/api
```

5. Start the app:

```bash
npm run dev
```

Default admin:

- Email: `admin@clientflow.local`
- Password: `Admin123!`
