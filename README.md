# WTX

Plataforma de automatización de WhatsApp con inteligencia artificial para negocios.

**Sitio web:** [wtx.mx](https://wtx.mx)

---

## Descripción

WTX es una solución empresarial que permite automatizar la atención al cliente a través de WhatsApp utilizando agentes de IA. El sistema incluye gestión de contactos, campañas de mensajería, agendamiento de citas, inventario y transferencia a atención humana cuando es necesario.

## Características principales

### Agente de IA
- Respuestas automáticas con OpenAI GPT-4
- Function calling para ejecutar acciones (agendar citas, consultar inventario)
- Memoria conversacional por contacto
- Personalidad y prompts configurables
- Detección de sentimientos para escalamiento a humanos

### Gestión de contactos
- Sincronización automática desde WhatsApp (WAHA/Evolution API)
- Verificación de números activos
- Etiquetas y segmentación
- Historial de conversaciones

### Campañas
- Envío masivo de mensajes
- Programación de campañas
- Control de velocidad de envío
- Métricas de entrega y respuesta

### Modo humano
- Transferencia automática basada en triggers configurables
- Activación manual desde el panel
- Desactivación por tiempo o comando
- Indicadores visuales de contactos en atención humana

### Panel de administración
- Configuración de personalidad del agente
- Gestión de herramientas (tools)
- Inventario de productos/servicios
- Horarios y disponibilidad
- Configuración de WhatsApp API

## Stack tecnológico

| Componente | Tecnología |
|------------|------------|
| Backend | Python 3.11, FastAPI, SQLAlchemy |
| Frontend | React 18, Vite, TailwindCSS |
| Base de datos | PostgreSQL 16 |
| IA | OpenAI GPT-4o-mini |
| WhatsApp | WAHA / Evolution API |
| Contenedores | Docker, Docker Compose |
| Deploy | Coolify / cualquier plataforma Docker |

## Estructura del proyecto

```
wtx/
├── whatsapp-ai-api/          # Backend API
│   ├── app.py                # Aplicación FastAPI
│   ├── agent.py              # Agente de IA
│   ├── tools.py              # Herramientas del agente
│   ├── models.py             # Modelos SQLAlchemy
│   ├── api/routers/          # Endpoints REST
│   └── Dockerfile.prod
│
├── whatsapp-ai-frontend/     # Panel de administración
│   ├── src/pages/            # Páginas React
│   ├── src/components/       # Componentes UI
│   └── Dockerfile.prod
│
├── docker-compose.yml        # Desarrollo local
├── docker-compose.prod.yml   # Producción
└── DEPLOY.md                 # Guía de despliegue
```

## Instalación

### Requisitos
- Docker y Docker Compose
- API Key de OpenAI
- Instancia de WAHA o Evolution API para WhatsApp

### Desarrollo local

```bash
git clone https://github.com/Yarov/Wtx.git
cd Wtx

# Configurar variables
cp .env.example .env
# Editar .env con tus credenciales

# Iniciar servicios
docker compose up -d --build

# Acceder al panel
open http://localhost:5173
```

### Producción (Coolify)

Ver [DEPLOY.md](./DEPLOY.md) para instrucciones detalladas.

```bash
# Variables requeridas en Coolify:
DB_PASSWORD=<password_seguro>
OPENAI_API_KEY=<tu_api_key>
JWT_SECRET=<openssl rand -hex 32>
FRONTEND_DOMAIN=app.wtx.mx
```

## Configuración de WhatsApp

1. Instalar WAHA o Evolution API
2. En el panel de WTX, ir a Configuración
3. Ingresar la URL de la API y credenciales
4. Configurar el webhook en WAHA/Evolution:
   ```
   https://app.wtx.mx/api/webhook/whatsapp
   ```

## Variables de entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `DB_PASSWORD` | Sí | Password de PostgreSQL |
| `OPENAI_API_KEY` | Sí | API key de OpenAI |
| `JWT_SECRET` | Sí | Secret para tokens de autenticación |
| `FRONTEND_DOMAIN` | No | Dominio del frontend (default: localhost) |
| `CORS_ORIGINS` | No | Orígenes permitidos para CORS |

## API

La documentación de la API está disponible en `/docs` (Swagger UI) o `/redoc`.

Endpoints principales:
- `POST /api/webhook/whatsapp` - Webhook para mensajes entrantes
- `GET /api/contactos` - Listar contactos
- `POST /api/campanas` - Crear campaña
- `GET /api/config/prompt` - Obtener configuración del agente

## Licencia

MIT License - Ver [LICENSE](./LICENSE) para más detalles.

---

Desarrollado por [WTX](https://wtx.mx)
