# WhatsApp AI Agent 🤖

Sistema completo de agente IA para WhatsApp con panel de administración.

## Arquitectura

```
agent/
├── whatsapp-ai-api/       # Backend FastAPI
│   ├── app.py             # Webhook principal
│   ├── agent.py           # Agente OpenAI
│   ├── tools.py           # Herramientas del agente
│   ├── admin.py           # API de administración
│   ├── database.py        # SQLite
│   └── Dockerfile
│
├── whatsapp-ai-frontend/  # Frontend React
│   ├── src/
│   │   ├── components/    # Componentes UI
│   │   ├── pages/         # Páginas del admin
│   │   └── api/           # Cliente API
│   └── Dockerfile
│
├── docker-compose.yml     # Orquestación
└── .env.example           # Variables de entorno
```

## Características

### Backend (API)
- 📱 Webhook para Twilio WhatsApp
- 🧠 Agente con OpenAI function calling
- 📅 Agendamiento de citas
- 📦 Gestión de inventario
- 💳 Generación de pagos
- 🧠 Memoria por usuario

### Frontend (Admin Panel)
- ⚙️ Configuración de API Keys
- 🛠 Gestión de Tools
- 📝 Editor de Prompt
- 📦 Administración de inventario
- 📅 Vista de citas
- 💬 Historial de conversaciones

## Instalación

### Con Docker (Recomendado)

```bash
# 1. Clonar y configurar
cp .env.example .env
# Editar .env con tus credenciales

# 2. Levantar servicios
docker-compose up -d --build

# 3. Acceder
# API: http://localhost:3000
# Admin: http://localhost:3001
```

### Sin Docker

#### Backend
```bash
cd whatsapp-ai-api
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

#### Frontend
```bash
cd whatsapp-ai-frontend
npm install
npm run dev
```

## Configuración de Twilio

1. Ve a la [consola de Twilio](https://console.twilio.com)
2. Activa WhatsApp Sandbox o un número dedicado
3. Configura el webhook: `https://tu-dominio.com/whatsapp` (POST)

### Desarrollo local con ngrok

```bash
ngrok http 3000
# Usa la URL HTTPS en Twilio
```

## URLs

| Servicio | URL | Descripción |
|----------|-----|-------------|
| API | http://localhost:3000 | Backend FastAPI |
| Admin | http://localhost:3001 | Panel de administración |
| Webhook | http://localhost:3000/whatsapp | Endpoint Twilio |
| API Docs | http://localhost:3000/docs | Swagger UI |

## Variables de Entorno

| Variable | Descripción |
|----------|-------------|
| `OPENAI_API_KEY` | API key de OpenAI |
| `TWILIO_ACCOUNT_SID` | Account SID de Twilio |
| `TWILIO_AUTH_TOKEN` | Auth Token de Twilio |

## Licencia

MIT
