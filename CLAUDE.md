# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a commercial-grade AI web platform built as a monorepo with three main modules:

- **admin**: Admin dashboard (Vue 3 + Vite)
- **chat**: User-facing chat interface (Vue 3 + Vite)
- **service**: Backend API service (NestJS + TypeORM)
- **AIWebQuickDeploy**: Production deployment bundle (generated from build script)

## Architecture

### Module Structure

```
project/
├── admin/           # Admin dashboard frontend (Fantastic Admin Basic)
│   └── src/
│       ├── api/     # API client functions
│       ├── views/   # Page components
│       ├── store/   # Pinia stores
│       ├── router/  # Vue Router config
│       └── components/
├── chat/            # User chat interface frontend
│   └── src/
│       ├── api/     # API client functions
│       ├── views/   # Page components
│       ├── store/   # Pinia stores
│       ├── components/
│       └── services/
├── service/         # NestJS backend
│   └── src/
│       ├── modules/ # Feature modules (auth, chat, user, etc.)
│       ├── common/  # Shared utilities
│       │   ├── guards/      # Auth guards
│       │   ├── interceptors/
│       │   ├── decorators/
│       │   ├── filters/     # Exception filters
│       │   └── utils/
│       ├── app.module.ts
│       └── main.ts
└── AIWebQuickDeploy/ # Production build output
    ├── dist/        # Compiled service
    ├── public/
    │   ├── admin/   # Built admin assets
    │   └── chat/    # Built chat assets
    └── package.json
```

### Backend Modules

The service is organized into NestJS modules (located in `service/src/modules/`):

- **auth**: Authentication & JWT
- **user**: User management
- **chat**: Chat functionality & AI integration
- **app**: Application/agent management
- **models**: AI model configuration
- **chatLog**: Conversation history
- **globalConfig**: System configuration
- **pay/order**: Payment processing
- **crami**: Credit/voucher system
- **upload**: File upload handling
- **plugin**: Plugin system
- **voice**: Voice/TTS features
- **affection**: Affection system (roleplay mechanics)
- **badWords**: Content filtering
- **autoReply**: Auto-reply system
- **statistic**: Analytics & statistics
- **redisCache**: Redis caching layer
- **database**: TypeORM configuration
- **rateLimit**: Rate limiting middleware

## Development Commands

### Prerequisites

- Node.js ^18.18.0 || ^20.9.0 || >=21.1.0
- pnpm (package manager)
- MySQL database
- Redis server

### Service (Backend)

```bash
cd service

# Development with hot reload
pnpm dev

# Build
pnpm build

# Format code
pnpm format

# Run tests
pnpm test
pnpm test:watch
pnpm test:cov

# Start with PM2
pnpm start
```

**Service runs on port 9520** (configurable via `.env` PORT variable)

### Admin (Dashboard)

```bash
cd admin

# Development server
pnpm dev

# Build for production
pnpm build

# Build for test environment
pnpm build:test

# Type check
pnpm lint  # Actually runs vue-tsc

# Format code
pnpm format

# Serve built files locally
pnpm serve
```

### Chat (User Interface)

```bash
cd chat

# Development server
pnpm dev

# Build for production
pnpm build

# Type check
pnpm type-check

# Format code
pnpm format

# Preview build
pnpm preview
```

### Full Project Build

To build all modules and create the deployment bundle:

```bash
# From project root
./build.sh
```

This script:
1. Installs dependencies for each module
2. Builds admin, chat, and service
3. Copies built files to `AIWebQuickDeploy/`
4. Prepares the production-ready package

## Configuration

### Environment Variables (service/.env)

Key configuration variables:

```bash
PORT=9520                    # Service port
DB_HOST=127.0.0.1           # MySQL host
DB_PORT=3306                # MySQL port
DB_USER=root                # MySQL user
DB_PASS=                    # MySQL password
DB_DATABASE=chatgpt         # Database name
REDIS_HOST=127.0.0.1        # Redis host
REDIS_PORT=6379             # Redis port
REDIS_PASSWORD=             # Redis password
REDIS_DB=0                  # Redis database index
ISDEV=false                 # Development mode flag
ADMIN_SERVE_ROOT=/admin     # Admin dashboard route prefix
```

Copy `service/.env.example` to `service/.env` and configure before running.

## Tech Stack

### Frontend (admin & chat)
- **Framework**: Vue 3 (Composition API)
- **Build Tool**: Vite
- **State Management**: Pinia
- **Routing**: Vue Router 4
- **UI Libraries**:
  - Admin: Element Plus, Headless UI
  - Chat: Tailwind CSS, custom components
- **Markdown**: markdown-it, md-editor-v3
- **Code Editor**: CodeMirror 6
- **Charts/Diagrams**: Mermaid, Markmap, ECharts

### Backend (service)
- **Framework**: NestJS 10
- **ORM**: TypeORM 0.3
- **Database**: MySQL (via mysql2)
- **Cache**: Redis (via ioredis)
- **Authentication**: JWT (passport-jwt)
- **AI Integration**: OpenAI SDK, Langchain, Google GenAI
- **Process Manager**: PM2
- **API Docs**: Swagger/OpenAPI

### Package Manager
- **pnpm** is enforced across all modules

## Common Development Patterns

### Adding a New Backend Module

1. Generate module using NestJS CLI (from `service/`):
   ```bash
   nest g module modules/your-module
   nest g controller modules/your-module
   nest g service modules/your-module
   ```

2. Register module in `service/src/app.module.ts`:
   ```typescript
   import { YourModule } from './modules/your-module/your-module.module';

   @Module({
     imports: [
       // ... other modules
       YourModule,
     ],
   })
   ```

3. Create entities in `service/src/common/entity/` if needed

### Working with TypeORM

Entities are centralized in `service/src/common/entity/`. When creating/modifying entities:
- Use TypeORM decorators (@Entity, @Column, etc.)
- Register in database module if needed
- Run migrations or sync in development

### Frontend API Integration

API functions are organized in `src/api/` directories:
- Use axios for HTTP requests
- Maintain consistent error handling
- Use TypeScript interfaces for request/response types

### Static File Serving

The service serves static files from multiple paths (configured in app.module.ts):
- `/admin` → admin dashboard
- `/` → chat interface (SPA fallback)
- `/file` → uploaded files
- `/open-docs` → API documentation

## Testing

### Service Tests
```bash
cd service
pnpm test           # Run all tests
pnpm test:watch     # Watch mode
pnpm test:cov       # With coverage
pnpm test:e2e       # E2E tests
```

Test files use `.spec.ts` suffix and are located alongside source files.

## Deployment

### Production Deployment

1. Build the project:
   ```bash
   ./build.sh
   ```

2. Deploy the `AIWebQuickDeploy/` directory to your server

3. Install production dependencies:
   ```bash
   cd AIWebQuickDeploy
   pnpm install --prod
   ```

4. Configure `.env` file with production settings

5. Start with PM2:
   ```bash
   pnpm start
   ```

### Docker Deployment

Docker configuration files are provided:
- `Dockerfile`
- `docker-compose.yml`
- `.env.docker` (Docker environment template)

```bash
docker-compose up -d
```

## Important Notes

- **Node Version**: Requires Node.js 18+
- **Package Manager**: Only pnpm is allowed (enforced by preinstall hooks)
- **Code Formatting**: Use `pnpm format` before committing (runs Prettier)
- **License**: Apache 2.0 - commercial use permitted with proper attribution
- **API Documentation**: Available at `/api-docs` when service is running (Swagger UI)

## Troubleshooting

### Port 9520 Already in Use
Change `PORT` in `service/.env` or stop conflicting process

### Database Connection Errors
- Verify MySQL is running
- Check credentials in `service/.env`
- Ensure database exists: `CREATE DATABASE chatgpt;`

### Redis Connection Errors
- Verify Redis is running
- Check REDIS_* variables in `service/.env`

### Build Failures
- Ensure all dependencies are installed: `pnpm install` in each module
- Clear node_modules and reinstall if issues persist
- Check Node.js version compatibility
