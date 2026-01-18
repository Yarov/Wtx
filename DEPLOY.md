# Despliegue en Coolify

## Opción 1: Docker Compose (Recomendado)

1. **Sube el repositorio a GitHub/GitLab**

2. **En Coolify:**
   - Crear nuevo proyecto
   - Seleccionar "Docker Compose"
   - Conectar tu repositorio
   - Seleccionar `docker-compose.prod.yml`

3. **Configurar variables de entorno en Coolify:**
   ```
   POSTGRES_PASSWORD=<password_seguro>
   OPENAI_API_KEY=<tu_api_key>
   JWT_SECRET=<genera_con_openssl_rand_hex_32>
   FRONTEND_DOMAIN=app.tudominio.com
   API_DOMAIN=api.tudominio.com
   ```

4. **Desplegar** - Coolify construirá y desplegará automáticamente

---

## Opción 2: Servicios Separados

### 1. PostgreSQL
- En Coolify: **New Resource → Database → PostgreSQL**
- Guarda la URL de conexión

### 2. API (Backend)
- **New Resource → Application**
- Conectar repositorio
- Build Pack: **Dockerfile**
- Dockerfile Location: `whatsapp-ai-api/Dockerfile.prod`
- Variables de entorno:
  ```
  DATABASE_URL=postgresql://user:pass@host:5432/db
  OPENAI_API_KEY=sk-xxx
  JWT_SECRET=xxx
  ```
- Puerto: `3000`

### 3. Frontend
- **New Resource → Application**
- Conectar repositorio
- Build Pack: **Dockerfile**
- Dockerfile Location: `whatsapp-ai-frontend/Dockerfile.prod`
- Build Args:
  ```
  VITE_API_URL=/api
  ```
- Puerto: `80`

---

## Configuración de Red en Coolify

Coolify automáticamente:
- Crea una red compartida para tus servicios
- Configura Traefik como proxy inverso
- Genera certificados SSL con Let's Encrypt

Para que el frontend pueda comunicarse con la API:
1. Ambos servicios deben estar en el **mismo proyecto** de Coolify
2. El frontend usa `http://api:3000` internamente (nombre del servicio)
3. Externamente, Traefik enruta por dominio

---

## Dominios

Configura en Coolify:
- **Frontend:** `app.tudominio.com`
- **API:** `api.tudominio.com` (opcional, puede ser solo interno)

El frontend ya tiene configurado el proxy en nginx para `/api` → `http://api:3000`

---

## Webhook de WhatsApp

Después del despliegue, configura el webhook en tu proveedor (WAHA/Evolution):
```
https://app.tudominio.com/api/webhook/whatsapp
```

---

## Verificar Despliegue

```bash
# Health check API
curl https://app.tudominio.com/api/

# Health check Frontend
curl https://app.tudominio.com/health
```

---

## Estructura de Archivos

```
/
├── docker-compose.prod.yml    # Compose para producción
├── .env.example               # Variables de entorno
├── DEPLOY.md                  # Esta guía
├── whatsapp-ai-api/
│   ├── Dockerfile             # Dev
│   └── Dockerfile.prod        # Producción
└── whatsapp-ai-frontend/
    ├── Dockerfile             # Dev
    ├── Dockerfile.prod        # Producción
    ├── nginx.conf             # Dev
    └── nginx.prod.conf        # Producción
```
