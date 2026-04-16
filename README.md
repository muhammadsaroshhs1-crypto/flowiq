# FlowIQ

FlowIQ is an intelligent workflow platform for agencies and operators managing SEO, Amazon, web design, content, social publishing, alerts, and recurring client execution. It combines structured project workflows with practical intelligence suggestions so teams can see what needs attention, why it matters, and what to do next.

The MVP includes workspace onboarding, project management, pipeline execution, topical authority mapping, content-to-social draft generation, Amazon suggestion queues, website monitoring, unified alerts, integration management, and a command-centre dashboard.

## Tech Stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- PostgreSQL
- Prisma ORM
- Clerk auth
- BullMQ
- Redis
- Server-Sent Events
- OpenAI GPT-4o
- Vercel and Railway

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env.local
```

3. Fill in the required values:

- `DATABASE_URL`: PostgreSQL connection string
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk publishable key
- `CLERK_SECRET_KEY`: Clerk secret key
- `CLERK_WEBHOOK_SECRET`: Clerk webhook signing secret
- `OPENAI_API_KEY`: OpenAI API key
- `REDIS_URL`: Redis connection string
- `INTEGRATION_SECRET`: long random secret for credential encryption
- `NEXT_PUBLIC_APP_URL`: public app URL

4. Run database migrations:

```bash
npm run db:migrate
```

5. Start development:

```bash
npm run dev
```

## Deployment

Deploy the Next.js app to Vercel. Add all environment variables from `.env.example` to the Vercel project settings.

Provision PostgreSQL and Redis on Railway. Use the Railway PostgreSQL connection string for `DATABASE_URL` and the Railway Redis connection string for `REDIS_URL`. After deployment, run Prisma migrations against the production database from a trusted environment.

## Notes

The Amazon module uses realistic mock data in the MVP. Production Amazon data requires SP-API and Ads API approval. OAuth flows are placeholders for the first MVP pass and are ready to be replaced with provider-specific authorization flows.
