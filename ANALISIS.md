# Análisis Completo WTX — Estado Técnico, IT y Negocio

> Fecha: 2026-06-15 · Auditoría sobre `main` (con cambios locales sin commitear)

---

## TL;DR — ¿Dónde estamos parados?

WTX es un **MVP técnicamente sólido y bien diseñado** (arquitectura skill-first del agente, multi-tenancy en datos, onboarding pulido), pero **NO está listo para producción comercial**. Tres bloqueadores lo definen:

1. **Seguridad:** claves reales expuestas en git, webhook sin auth, fugas de datos cross-tenant, secretos por defecto.
2. **Modelo de negocio inexistente en código:** sin billing, sin planes, sin medición de uso. No hay forma de cobrar.
3. **Arquitectura single-tenant de facto:** la base de datos es multi-tenant pero el WhatsApp bridge usa UNA sola sesión → 1 número por despliegue. No escala como SaaS.

**Veredicto:** listo para **1–pocos clientes piloto en modo "instalación por cliente"**. NO listo para SaaS auto-servicio ni para escalar comercialmente sin trabajo significativo.

---

## 1. Estado Técnico (Backend)

**Lo bueno:**
- **Orchestrator V2 maduro**: intent classifier (4 niveles, del más barato al más caro) + skill executor determinista. Reemplaza el function-calling de GPT. Técnicamente superior a competidores tipo ManyChat.
- Multi-tenancy en datos (FK + CASCADE), caché de config con TTL, dedup de mensajes, recuperación de jobs huérfanos, graceful shutdown del worker.

**Deuda técnica alta:**
| Problema | Ubicación | Impacto |
|---|---|---|
| Doble motor de agente (legacy vivo) | `agent.py:30,266,573` | Código muerto de alto volumen, lógica duplicada |
| Dos sistemas de prompts divergentes | `agent.py:573` vs `prompt_builder.py` | Editar uno no actualiza el otro; reglas ya divergieron |
| Dos capas de mensajes (`Memoria` + `MensajeConversacion`) | `agent.py:774` | Doble escritura en cada respuesta |
| `tools.py` abre sesión DB nueva por llamada | `tools.py:7-58` | Inconsistencias de transacción |
| 11 `except:` desnudos | varios | Errores silenciados |
| Deps sin pinear | `requirements.txt` | Builds no reproducibles |
| `Cita.fecha/hora` como String | `models.py:107` | Comparación lexicográfica, riesgo double-booking |

**Madurez producción:**
- ❌ **Sin tests reales** — los 5 archivos en `tests/` son scripts manuales (cero pytest, requieren DB + OpenAI vivos, mutan config global). No gatean merges.
- ❌ Observabilidad mínima (`logging.basicConfig` y nada más; sin Sentry/métricas/tracing).
- ❌ Health check trivial (`GET /` estático, no verifica DB/Redis/OpenAI).
- ⚠️ Campaign worker corre dentro del proceso API → con multi-worker uvicorn = envíos duplicados (sin lock).

---

## 2. Estado Técnico (Frontend)

**Lo bueno:** React 19 + Vite + Tailwind 4, buena estructura, diseño pulido (skeletons, charts SVG propios, WebSocket en tiempo real con backoff/heartbeat). 18 páginas, mayoría funcionales.

**Bugs y problemas confirmados:**
| Severidad | Problema | Ubicación |
|---|---|---|
| CRÍTICO | `whatsappApi.testConnection()` no existe → estado WhatsApp siempre "warning" | `useDashboard.js:39` |
| CRÍTICO | Clases Tailwind dinámicas (`bg-${color}-100`) → se rompen en build de producción | `HealthCheck.jsx`, `CampanaNueva.jsx`, `ToolsTab.jsx` |
| CRÍTICO | `Caddyfile` (prod) NO proxea `/ws` ni `/uploads` → WebSocket y media rotos en prod | `whatsapp-ai-frontend/Caddyfile` |
| ALTO | Errores silenciosos sistémicos: guardas creen que persisten cuando fallan | 74 `console.*`, 16 `alert()` |
| ALTO | Guardado optimista falso en inventario (muestra "Guardado" sin persistir) | `Inventory.jsx:48,69` |
| ALTO | KPI "Esta Semana" muestra total, no la semana | `Appointments.jsx:178` |
| ALTO | Setup navega a `/settings` (ruta inexistente) → pantalla en blanco | `Setup.jsx:61` |

**Código muerto:** `ApiKeys.jsx` (Twilio obsoleto), `ModelTab`/`HumanModeTab`/`HealthCheck` (no importados), doble implementación de campañas (`Campanas.jsx` modal vs `CampanaNueva.jsx`).

---

## 3. Estado de IT / Infraestructura

**Lo bueno:** multi-stage builds en prod, healthchecks (Postgres/Redis/API/bridge), `depends_on: service_healthy`, red `internal` aislada en prod, Dependabot configurado.

**Crítico:**
| Problema | Detalle |
|---|---|
| 🔴 Claves reales en git | 2 claves OpenAI + WhatsApp API key en historial (`bd62d4a`, `3e0b4ae`) + `.env` local. **Rotar YA.** |
| 🔴 Webhook sin auth | `webhook.py:154,457` — endpoint público, cualquiera inyecta mensajes (coste OpenAI, contaminación) |
| 🔴 Secretos por defecto | `DB_PASSWORD:-changeme_in_production`, `JWT_SECRET:-default...`, `SECRET_KEY:-dev-secret-key` |
| 🔴 CORS `*` + credentials | `docker-compose.prod.yml:58` — combinación inválida/insegura |

**Alto:**
- Bridge de WhatsApp = **SPOF no escalable** (sesión única `"default"`, stateful, Chromium frágil, sin HA).
- API single-process (sin gunicorn/workers) → se satura bajo carga.
- **Sin backups** de Postgres ni del volumen `whatsapp_auth`.
- Puertos 5432/6379 expuestos al host en dev; Redis sin password.
- **Sin CI/CD** (`.github/workflows` no existe) — sin tests/lint/secret-scan en push.

---

## 4. Estado de Negocio / Producto

**Propuesta de valor:** suite todo-en-uno sobre WhatsApp (agente IA + CRM + funnel + lead scoring + campañas + agenda + inventario) para PYMES de servicios hispanohablantes (LATAM, dominio `wtx.mx`). Diferenciador real: **agente IA en español con funnel/scoring, económico, vs incumbentes caros en inglés** (WATI, Respond.io, ManyChat).

**Hallazgo clave — Monetización:**
- ❌ **Cero infraestructura de cobro**: sin Stripe/MercadoPago, sin planes, sin trials, sin cuotas, sin medición de uso. Auth solo tiene `is_active`/`is_admin`.
- ⚠️ **Contradicción arquitectónica**: datos multi-tenant (todas las tablas con `usuario_id`) PERO WhatsApp single-tenant (bridge sesión `"default"`, `tenant.py:45` cae a `usuario_id=1`). No puede servir N clientes desde un despliegue.

**Riesgos de negocio:**
1. **WhatsApp no oficial (existencial):** `whatsapp-web.js v1.26-alpha` viola ToS de Meta. Combinado con campañas masivas = patrón de baneo. Competidores usan Cloud API oficial.
2. **Costos OpenAI sin medir** por cliente → margen impredecible (cada mensaje = 1-2 llamadas a GPT).
3. **Cumplimiento:** almacena datos personales de terceros sin opt-in/consentimiento/borrado (LFPDPPP/GDPR). Campañas masivas = riesgo de spam legal.

**Caminos estratégicos:**
- **A — Agencia/Done-for-you (monetizable ya):** instancia por cliente, setup fee + retainer. Aprovecha el estado actual. No escala, intensivo en operación.
- **B — SaaS multi-tenant (mayor upside):** requiere sesiones de bridge por usuario + billing + límites por plan + panel de tenants. Inversión significativa.

---

## 5. Roadmap priorizado

### P0 — Seguridad (esta semana, bloqueante)
1. **Rotar TODAS las claves** (2x OpenAI, WhatsApp bridge) y purgar historial git (BFG/`git filter-repo`).
2. Autenticar el webhook de WhatsApp.
3. Eliminar secretos por defecto (fail-closed si faltan) + arreglar CORS prod.
4. Scopear queries cross-tenant (`stats.py`, `config.py clear_memory`, appointments, business onboarding).

### P1 — Producción mínima viable
5. Test suite real (pytest + mocks OpenAI), priorizando aislamiento cross-tenant y auth.
6. Sacar campaign worker del proceso API (o lock) + health check real.
7. Backups de Postgres y volumen `whatsapp_auth`.
8. Arreglar bugs frontend críticos (Tailwind dinámico, Caddyfile `/ws`+`/uploads`, `testConnection`, errores silenciosos).
9. CI con secret-scanning (gitleaks) + tests + lint.

### P2 — Comercialización
10. **Decisión estratégica: Camino A vs B** (define todo lo demás).
11. Migrar a WhatsApp Cloud API oficial (bloqueador #1 de credibilidad).
12. Billing + planes + límites de uso (protege margen vs costos OpenAI).
13. Si SaaS: bridge multi-sesión por tenant + panel de gestión.
14. Cumplimiento: opt-in, retención, borrado.

### P3 — Deuda técnica
15. Eliminar motor de agente legacy + unificar prompts.
16. Consolidar doble implementación de campañas (frontend).
17. Pinear deps, normalizar datetime a UTC, migrar `Cita.fecha/hora` a tipos temporales.
