# Cloud Daftar - Development Commands

## Setup
```bash
npm install
cp .env.example .env
# Edit .env with your database URL
npx prisma generate
npx prisma db push
npm run db:seed
```

## Development
```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint check
npm run format       # Prettier format
```

## Database
```bash
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Create migration
npm run db:seed      # Seed demo data
npm run db:studio    # Open Prisma Studio
```

## Project Structure
```
src/
  app/               # Next.js App Router pages
    (auth)/          # Login, Register
    (dashboard)/     # All dashboard pages
    api/             # API routes
  components/        # Reusable UI components
    ui/              # shadcn-style primitives
    layout/          # Sidebar, Navbar, Shell
    shared/          # Shared components
    forms/           # Form components
    tables/          # Data table components
  features/          # Feature-based modules
    dashboard/
    inventory/
    sales/
    purchases/
    customers/
    suppliers/
    reports/
    settings/
    users/
  actions/           # Server Actions
  lib/               # Core utilities
  providers/         # React context providers
  types/             # TypeScript types
  utils/             # Helper functions
  hooks/             # Custom React hooks
  services/          # Business logic services
prisma/
  schema.prisma      # Database schema
  seed.ts            # Seed data
```

## Deployment (Vercel + Neon)
1. Push schema to Neon: `npx prisma db push`
2. Deploy to Vercel: `vercel --prod`
3. Set environment variables in Vercel dashboard
4. Run migrations in production: `npx prisma migrate deploy`
