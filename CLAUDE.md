# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**WTX** is a WhatsApp automation platform with AI-powered customer service. It integrates WhatsApp (via WAHA/Evolution API), an OpenAI GPT-4 agent, and a React admin dashboard for managing contacts, campaigns, appointments, and inventory.

**Tech Stack:**
- Backend: Python 3.11, FastAPI, SQLAlchemy, PostgreSQL 16
- Frontend: React 19, Vite, TailwindCSS 4.1
- AI: OpenAI GPT-4o-mini with function calling
- Queue: Redis 7 for background jobs
- WhatsApp: WAHA Core / Evolution API integration

## Common Commands

### Development

```bash
# Start all services (PostgreSQL, Redis, API, Worker, Frontend)
docker compose up -d --build

# View logs
docker compose logs -f api
docker compose logs -f worker
docker compose logs -f frontend

# Stop all services
docker compose down

# Rebuild and restart a specific service
docker compose up -d --build api

# Access database
docker compose exec postgres psql -U whatsapp -d whatsapp_agent

# Access API shell
docker compose exec api bash

# Run database migrations
docker compose exec api alembic upgrade head

# Create a new migration
docker compose exec api alembic revision --autogenerate -m "description"
```

### Testing

```bash
# Run dynamic trigger tests (reads current config from DB)
docker compose exec api python tests/test_triggers_dinamico.py

# Run agent flow tests
docker compose exec api python tests/test_agent_flow.py

# Run real conversation tests
docker compose exec api python tests/test_conversaciones_reales.py

# Run AI response tests
docker compose exec api python tests/test_ia_responses.py
```

### Frontend Development

```bash
cd whatsapp-ai-frontend

# Install dependencies
npm install

# Development server (port 3001)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Redis Queue Management

```bash
# Access Redis CLI
docker compose exec redis redis-cli

# Monitor queue
MONITOR

# Check queue length
LLEN background_jobs
```

## Architecture Overview

### Message Flow (WhatsApp → AI → Response)

1. **Incoming Message**: WAHA/Evolution API sends webhook to `POST /api/webhook/whatsapp`
2. **Parse & Store**: Extract message, save/update contact in database
3. **Human Mode Check**: If contact is in human mode, skip AI processing
4. **AI Agent**:
   - Load conversation memory from database (keyed by phone number)
   - Build system prompt from configuration (sections or manual mode)
   - Call OpenAI GPT-4o-mini with available tools
   - Execute function calls (schedule appointments, check inventory, etc.)
5. **Trigger Detection**: Check if message contains human mode triggers (frustration, complaints, etc.)
6. **Send Response**: Use `whatsapp_service.send_message()` to reply via WAHA API
7. **Update Stats**: Track message count, last contact time, campaign responses

### Campaign Processing Flow

1. Admin creates campaign in UI (`/api/campanas`)
2. Campaign saved with estado: "borrador"
3. Admin clicks "Enviar" → estado: "enviando"
4. `campaign_engine.py` runs async worker that:
   - Processes recipients in batches
   - Respects velocity limits (seconds between messages)
   - Replaces variables: `{nombre}`, `{telefono}`, `{tags}`
   - Sends via WAHA API
   - Updates status: "enviado" / "fallido"
5. Webhook tracks responses and marks as "respondido"
6. Campaign completes when all recipients processed

### Background Job System

- Jobs enqueued via `redis_queue.enqueue_job()`
- `worker.py` polls Redis queue using `obtener_siguiente_job_bloqueante()`
- `job_engine.py` dispatches to processors:
  - `verify_contactos`: Re-verify WhatsApp numbers
  - `sync_contactos`: Import contacts from WhatsApp
- Job status tracked in `background_jobs` table (procesando → completado/error)

## Key Components

### AI Agent (`agent.py`, `tools.py`)

- **Conversation Memory**: Stored per contact (phone number as key) in `memoria` table
- **System Prompt**: Two editing modes:
  1. Section-based: role, context, task, constraints, tone
  2. Manual: full prompt editing
- **Function Calling Tools**:
  - `agendar_cita`: Schedule appointments
  - `consultar_inventario`: Query products/services
  - `ver_citas`: List appointments
  - `cancelar_cita`: Cancel appointments
  - `modificar_cita`: Reschedule appointments
- **Tool Management**: Each tool can be enabled/disabled via `tools_config` table

### Human Mode System

**Location**: `api/routers/webhook.py`, `api/routers/contactos.py`

**Trigger Types** (configurable):
- `frustration`: "molesto", "enojado", "frustrado", "harto", etc.
- `complaint`: "queja", "reclamo", "problema grave", etc.
- `human_request`: "hablar con humano", "persona real", etc.
- `urgency`: "urgente", "emergencia", "inmediatamente", etc.
- `complexity`: "no entiendes", "no me ayudas", "inútil", etc.
- `negotiation`: "descuento", "rebaja", "precio especial", etc.

**Behavior**:
- When triggered, contact marked with `modo_humano: true`
- AI stops responding to that contact
- Admin sees visual indicator in dashboard
- Auto-deactivation after configurable hours
- Manual reactivation via "#reactivar" command or dashboard toggle

### Contact Management (`api/routers/contactos.py`)

- **Auto-sync**: Import from WhatsApp via WAHA API
- **Phone Normalization**: E.164 format using `phonenumbers` library
- **Verification**: Re-check if numbers are still active (background job)
- **Tagging**: Multiple tags per contact for segmentation
- **Activity Tracking**: First/last message time, total messages
- **States**: active, inactive, blocked

### Campaign Engine (`campaign_engine.py`)

- **Types**: "unica" (one-time) or "automatica" (recurring)
- **States**: borrador → programada → enviando → completada/pausada
- **Filtering**: By activity date range, tags, contact state, or manual selection
- **Variables**: `{nombre}`, `{telefono}`, `{tags}`, `{fecha}`, `{hora}`
- **Velocity Control**: Configurable delay between messages
- **Metrics**: Sent count, failed count, responses tracked per campaign

### Appointments (`api/routers/appointments.py`, `services.py`)

- Schedule with date, time, and service
- Availability calendar based on `disponibilidad` table
- Block time slots via `horarios_bloqueados`
- Prevents double-booking
- States: pendiente, confirmada, cancelada
- Integrated with AI agent tools

## Database Models

**Key tables** (`models.py`):
- `usuarios`: User accounts with JWT auth
- `contactos`: WhatsApp contacts with metadata
- `campanas`: Bulk messaging campaigns
- `campana_destinatarios`: Campaign recipient tracking
- `citas`: Appointments/bookings
- `inventario`: Products/services
- `configuracion`: Key-value config store
- `tools_config`: AI agent tool enable/disable
- `disponibilidad`: Business hours by weekday
- `horarios_bloqueados`: Blocked time slots
- `memoria`: Conversation history per contact
- `background_jobs`: Async job tracking
- `business_config`: Business profile and modules

## API Structure

**Main Entry Point**: `whatsapp-ai-api/app.py`

**Router Organization** (`api/routers/`):
- `auth.py`: Registration, login, logout
- `config.py`: AI prompt, API keys, model settings
- `contactos.py`: Contact CRUD, sync, human mode
- `campanas.py`: Campaign CRUD, send, pause, preview
- `appointments.py`: Appointment scheduling
- `inventory.py`: Product/service management
- `tools.py`: Tool enable/disable
- `webhook.py`: WhatsApp message webhook
- `dashboard.py`: Analytics and stats
- `business.py`: Business profile and modules

**API Documentation**: Available at `/docs` (Swagger UI) or `/redoc`

## Frontend Structure

**Entry Point**: `whatsapp-ai-frontend/src/App.jsx`

**Key Pages** (`src/pages/`):
- `Dashboard.jsx`: KPIs, charts, system overview
- `Agent.jsx`: AI personality, tools, human mode settings
- `Contactos.jsx`: CRM with filtering, import, bulk actions
- `Campanas.jsx`: Campaign list and monitoring
- `CampanaNueva.jsx`: Campaign creation wizard
- `Inventory.jsx`: Product management
- `Appointments.jsx`: Appointment scheduling
- `Setup.jsx`: Initial onboarding wizard
- `Schedule.jsx`: Business hours configuration

**API Client**: `src/api/client.js` - Namespaced methods with axios interceptors

## Environment Variables

**Required**:
- `OPENAI_API_KEY`: OpenAI API key (required)
- `DATABASE_URL`: PostgreSQL connection string
- `SECRET_KEY`: JWT secret (64 hex characters recommended)
- `WHATSAPP_API_URL`: WAHA/Evolution API endpoint
- `WHATSAPP_API_KEY`: WAHA/Evolution API key
- `REDIS_URL`: Redis connection string

**Optional**:
- `FRONTEND_DOMAIN`: Frontend domain for CORS (default: localhost)
- `CORS_ORIGINS`: Comma-separated allowed origins

## Deployment

**Development**: `docker compose up -d --build`
**Production**: Use `docker-compose.prod.yml` with Coolify or similar platform

**Services**:
1. PostgreSQL (port 5432)
2. Redis (port 6379)
3. API (port 3000)
4. Worker (background jobs, no exposed port)
5. Frontend (port 3001 dev / 80 production)

**Health Checks**:
- API: `GET /` returns 200
- Frontend: `GET /health`
- PostgreSQL: `pg_isready`
- Redis: `redis-cli ping`

## Important Notes

### Phone Number Handling
Always use the `phonenumbers` library for normalization to E.164 format. The system expects phone numbers in international format without the `+` prefix (e.g., "5215512345678").

### Conversation Memory
Memory is stored per contact using phone number as the key. The `obtener_memoria()` function retrieves the last N messages for context. Memory persists across sessions.

### Testing Strategy
The test suite includes a dynamic trigger test (`test_triggers_dinamico.py`) that reads current configuration from the database. This means tests automatically validate newly added triggers without code changes.

### Prompt Editing Modes
- **Section Mode** (default): Prompt built from sections (role, context, task, constraints, tone)
- **Manual Mode**: Full prompt string editing for advanced users
- Toggle via `prompt_edit_mode` configuration

### Background Worker
The worker process (`worker.py`) must run continuously for campaigns and background jobs to process. It gracefully handles shutdown signals (SIGTERM, SIGINT).

### WhatsApp API Compatibility
The system supports both WAHA and Evolution API formats. The `whatsapp_service.py` module handles parsing differences between the two.
