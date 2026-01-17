# WhatsApp AI Agent 🤖

Agente de IA para WhatsApp usando FastAPI, Twilio y OpenAI.

## Funcionalidades

- 📅 **Agendar citas** - Los usuarios pueden agendar citas
- 🛠 **Servicios** - Consultar servicios disponibles
- 💳 **Pagos** - Generar links de pago simulados
- 📦 **Inventario** - Ver productos y precios
- 🧠 **Memoria** - Recuerda conversaciones por usuario

## Estructura

```
whatsapp-ai/
├── app.py          # Webhook FastAPI para Twilio
├── agent.py        # Agente con OpenAI function calling
├── tools.py        # Funciones/tools del agente
├── database.py     # Base de datos SQLite
├── requirements.txt
└── .env.example
```

## Instalación

```bash
# Crear entorno virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales
```

## Configuración

Edita el archivo `.env`:

```env
OPENAI_API_KEY=sk-xxxx
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxx
```

## Ejecución

### Con Docker (recomendado)

```bash
# Crear archivo .env con tus credenciales
cp .env.example .env
# Editar .env con tus claves

# Construir y ejecutar
docker-compose up -d --build

# Ver logs
docker-compose logs -f

# Detener
docker-compose down
```

### Sin Docker

```bash
# Opción 1: Directamente
python app.py

# Opción 2: Con uvicorn
uvicorn app:app --host 0.0.0.0 --port 3000 --reload
```

## Configurar Twilio

1. Ve a la consola de Twilio
2. Configura el webhook de WhatsApp a: `https://tu-dominio.com/whatsapp`
3. Método: POST

## Uso con ngrok (desarrollo)

```bash
ngrok http 3000
```

Copia la URL HTTPS y configúrala en Twilio.

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Health check |
| POST | `/whatsapp` | Webhook de Twilio |

## Ejemplo de conversación

```
Usuario: Hola
Bot: ¡Hola! Bienvenido. ¿En qué puedo ayudarte hoy?

Usuario: ¿Qué servicios tienen?
Bot: Tenemos disponible:
     - Corte de cabello: $150 MXN
     - Barba: $100 MXN
     - Shampoo premium: $250 MXN

Usuario: Quiero agendar un corte para mañana a las 3pm
Bot: ✅ Cita agendada correctamente para mañana a las 3pm - Corte de cabello
```
