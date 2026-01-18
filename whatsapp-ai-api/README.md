# Wtx API

Backend API para Wtx - Agente de IA para WhatsApp con FastAPI, PostgreSQL y OpenAI.

## Funcionalidades

- **Agente IA** - Respuestas inteligentes con OpenAI function calling
- **Agendar citas** - Gestionar citas con disponibilidad configurable
- **Inventario** - Productos y servicios con precios
- **Campanas masivas** - Envio de mensajes a contactos
- **WhatsApp** - Soporte para WAHA y Evolution API
- **Autenticacion JWT** - Sistema de usuarios con roles
- **Modo humano** - Pausar IA cuando un humano toma la conversacion

## Estructura

```
whatsapp-ai-api/
├── app.py              # FastAPI principal y webhooks
├── agent.py            # Agente con OpenAI function calling
├── auth.py             # Autenticacion JWT y bcrypt
├── models.py           # Modelos SQLAlchemy
├── database.py         # Configuracion PostgreSQL
├── services.py         # Logica de negocio (citas, inventario)
├── whatsapp_service.py # Cliente WhatsApp multi-proveedor
├── campaign_engine.py  # Motor de campanas masivas
├── job_engine.py       # Worker para jobs en background
├── api/
│   ├── routers/        # Endpoints por modulo
│   └── schemas/        # Modelos Pydantic
├── Dockerfile
└── requirements.txt
```

## Requisitos

- Python 3.11+
- PostgreSQL 15+
- Docker (recomendado)

## Instalacion

### Con Docker (recomendado)

```bash
# Desde la raiz del proyecto
docker-compose up -d --build

# Ver logs
docker-compose logs -f api
```

### Sin Docker

```bash
# Crear entorno virtual
python -m venv venv
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Ejecutar
uvicorn app:app --host 0.0.0.0 --port 3000 --reload
```

## Variables de Entorno

```env
# Base de datos
DATABASE_URL=postgresql://user:pass@localhost:5432/wtx

# OpenAI
OPENAI_API_KEY=sk-xxxx

# JWT
SECRET_KEY=tu-secret-key-seguro

# WhatsApp (WAHA/Evolution API)
WHATSAPP_API_URL=http://localhost:3001
WHATSAPP_API_KEY=tu-api-key
WHATSAPP_SESSION=default
```

## API Endpoints

### Autenticacion
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/api/auth/register` | Registrar usuario |
| POST | `/api/auth/login` | Iniciar sesion |
| GET | `/api/auth/me` | Usuario actual |

### Negocio
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/business/modules` | Modulos activos |
| POST | `/api/business/skip-onboarding` | Saltar onboarding |
| POST | `/api/business/chat` | Chat de onboarding |

### Configuracion
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/config` | Obtener config |
| PUT | `/api/config` | Actualizar config |
| GET | `/api/tools` | Tools del agente |
| PUT | `/api/tools/{nombre}` | Toggle tool |

### Citas
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/appointments` | Listar citas |
| GET | `/api/appointments/availability` | Disponibilidad |
| GET | `/api/appointments/available-slots/{fecha}` | Horarios libres |

### Inventario
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/inventory` | Listar productos |
| POST | `/api/inventory` | Crear producto |
| PUT | `/api/inventory/{id}` | Actualizar |
| DELETE | `/api/inventory/{id}` | Eliminar |

### Contactos y Campanas
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/contactos` | Listar contactos |
| POST | `/api/contactos/import` | Importar desde WhatsApp |
| GET | `/api/campanas` | Listar campanas |
| POST | `/api/campanas` | Crear campana |

### Webhooks
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/whatsapp` | Webhook WhatsApp |
| GET | `/` | Health check |

## Configurar WhatsApp

### WAHA / Evolution API
1. Despliega WAHA o Evolution API
2. Configura `WHATSAPP_API_URL` y `WHATSAPP_API_KEY`
3. Configura el webhook en tu proveedor a `https://tu-dominio.com/whatsapp`

## Desarrollo

```bash
# Ejecutar tests
pytest

# Formatear codigo
black .

# Verificar tipos
mypy .
```
