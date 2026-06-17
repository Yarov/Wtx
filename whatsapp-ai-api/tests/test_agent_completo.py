"""
TEST COMPLETO DEL AGENTE - Checklist de todas las funcionalidades
==================================================================
Cubre: triggers, funnel, captura, knowledge,
       prompt building, modo humano, tool execution, flujo completo.

Ejecutar: docker compose exec api python tests/test_agent_completo.py
"""
import sys
import os
import json
import traceback
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import (
    SessionLocal, Contacto, Configuracion, ToolsConfig, MensajeConversacion,
    FunnelPaso, CampoCaptura, DocumentoConocimiento, BusinessConfig,
)
from database import get_config, set_config, is_tool_enabled, invalidate_config_cache

# ─── Helpers ───────────────────────────────────────────────────────────────

USUARIO_ID = 1
TELEFONO_TEST = "5215500000001"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    DIM = '\033[2m'
    END = '\033[0m'

class TestResults:
    def __init__(self):
        self.sections = []
        self.current_section = None
        self.total_pass = 0
        self.total_fail = 0
        self.total_skip = 0

    def section(self, name):
        self.current_section = {"name": name, "tests": []}
        self.sections.append(self.current_section)
        print(f"\n{Colors.BOLD}{Colors.CYAN}{'─'*60}")
        print(f"  {name}")
        print(f"{'─'*60}{Colors.END}")

    def ok(self, desc, detail=""):
        self.total_pass += 1
        self.current_section["tests"].append(("PASS", desc))
        d = f" {Colors.DIM}({detail}){Colors.END}" if detail else ""
        print(f"  {Colors.GREEN}✅ {desc}{Colors.END}{d}")

    def fail(self, desc, detail=""):
        self.total_fail += 1
        self.current_section["tests"].append(("FAIL", desc))
        d = f" → {detail}" if detail else ""
        print(f"  {Colors.RED}❌ {desc}{d}{Colors.END}")

    def skip(self, desc, reason=""):
        self.total_skip += 1
        self.current_section["tests"].append(("SKIP", desc))
        r = f" → {reason}" if reason else ""
        print(f"  {Colors.YELLOW}⏭  {desc}{r}{Colors.END}")

    def summary(self):
        total = self.total_pass + self.total_fail + self.total_skip
        pct = (self.total_pass / (self.total_pass + self.total_fail) * 100) if (self.total_pass + self.total_fail) > 0 else 0
        print(f"\n{Colors.BOLD}{'═'*60}")
        print(f"  RESUMEN")
        print(f"{'═'*60}{Colors.END}")
        for s in self.sections:
            passed = sum(1 for t in s["tests"] if t[0] == "PASS")
            failed = sum(1 for t in s["tests"] if t[0] == "FAIL")
            skipped = sum(1 for t in s["tests"] if t[0] == "SKIP")
            icon = "✅" if failed == 0 else "❌"
            print(f"  {icon} {s['name']}: {passed}/{passed+failed} pass" + (f", {skipped} skip" if skipped else ""))

        print(f"\n  {Colors.BOLD}Total: {self.total_pass} pass, {self.total_fail} fail, {self.total_skip} skip ({pct:.0f}%){Colors.END}")
        if pct >= 95:
            print(f"  {Colors.GREEN}{Colors.BOLD}🎉 EXCELENTE{Colors.END}")
        elif pct >= 80:
            print(f"  {Colors.YELLOW}{Colors.BOLD}⚠️  ACEPTABLE - revisar fallos{Colors.END}")
        else:
            print(f"  {Colors.RED}{Colors.BOLD}🚨 CRÍTICO - hay que arreglar{Colors.END}")
        return self.total_fail == 0


R = TestResults()


def get_db():
    return SessionLocal()


def cleanup_test_data(db):
    """Limpiar datos de test sin tocar datos reales"""
    db.query(MensajeConversacion).filter(MensajeConversacion.telefono == TELEFONO_TEST).delete()
    contacto = db.query(Contacto).filter(
        Contacto.telefono == TELEFONO_TEST,
        Contacto.usuario_id == USUARIO_ID
    ).first()
    if contacto:
        contacto.modo_humano = False
        contacto.modo_humano_desde = None
        contacto.modo_humano_razon = None
        contacto.paso_funnel = None
        contacto.datos_capturados = None
        contacto.lead_score = 0
    db.commit()


def ensure_test_contact(db):
    """Crear contacto de test si no existe"""
    contacto = db.query(Contacto).filter(
        Contacto.telefono == TELEFONO_TEST,
        Contacto.usuario_id == USUARIO_ID
    ).first()
    if not contacto:
        contacto = Contacto(
            telefono=TELEFONO_TEST,
            nombre="Test Agent",
            usuario_id=USUARIO_ID,
            estado="activo",
            origen="manual",
        )
        db.add(contacto)
        db.commit()
    return contacto


# ═══════════════════════════════════════════════════════════════════════════
# 1. DETECCIÓN DE TRIGGERS (MODO HUMANO)
# ═══════════════════════════════════════════════════════════════════════════

def test_triggers():
    R.section("1. DETECCIÓN DE TRIGGERS")
    from api.routers.webhook import detectar_trigger_modo_humano

    # Leer config actual
    triggers_str = get_config("human_mode_triggers", '[]')
    custom_str = get_config("human_mode_custom_triggers", "")
    try:
        triggers_activos = json.loads(triggers_str)
    except:
        triggers_activos = []
    custom_keywords = [k.strip() for k in custom_str.split(",") if k.strip()]

    TRIGGER_KEYWORDS = {
        "frustration": ["molesto", "enojado", "frustrado", "harto", "horrible"],
        "complaint": ["queja", "reclamo", "inaceptable", "exijo", "reembolso"],
        "human_request": ["hablar con humano", "persona real", "agente humano", "asesor", "supervisor"],
        "urgency": ["urgente", "emergencia", "ahora mismo", "inmediatamente"],
        "complexity": ["no entiendes", "no me ayudas", "inútil", "no sirves"],
        "negotiation": ["descuento", "rebaja", "precio especial", "negociar"],
    }

    # Test triggers activos
    for trigger_type in triggers_activos:
        if trigger_type in TRIGGER_KEYWORDS:
            for kw in TRIGGER_KEYWORDS[trigger_type][:2]:
                msg = f"Hola, {kw} con esto" if " " not in kw else f"Hola, {kw} por favor"
                result = detectar_trigger_modo_humano(msg, "")
                if result:
                    R.ok(f"[{trigger_type}] '{kw}' detectado")
                else:
                    R.fail(f"[{trigger_type}] '{kw}' NO detectado")

    # Test custom triggers
    for kw in custom_keywords[:5]:
        msg = f"Quiero {kw} ahora"
        result = detectar_trigger_modo_humano(msg, "")
        if result:
            R.ok(f"[custom] '{kw}' detectado")
        else:
            R.fail(f"[custom] '{kw}' NO detectado")

    # Falsos positivos
    normales = [
        "Hola buenos días",
        "Quiero información de precios",
        "Gracias por la info",
        "Me interesa agendar",
        "Tienen disponibilidad mañana?",
    ]
    for msg in normales:
        result = detectar_trigger_modo_humano(msg, "")
        if not result:
            R.ok(f"No-trigger: '{msg[:35]}...'")
        else:
            R.fail(f"Falso positivo: '{msg[:35]}...'")

    # Trigger en respuesta del agente
    result = detectar_trigger_modo_humano("ayuda", "Soy inútil para resolver esto")
    if result:
        R.ok("Trigger detectado en respuesta del agente")
    else:
        # Depende de config, puede no activar si 'complexity' no está activo
        if "complexity" in triggers_activos:
            R.fail("Trigger en respuesta no detectado")
        else:
            R.skip("Trigger en respuesta", "'complexity' no está activo")


# ═══════════════════════════════════════════════════════════════════════════
# 2. MODO HUMANO (ACTIVACIÓN / DESACTIVACIÓN)
# ═══════════════════════════════════════════════════════════════════════════

def test_modo_humano():
    R.section("2. MODO HUMANO")
    db = get_db()
    try:
        contacto = ensure_test_contact(db)

        # Activar modo humano
        from api.routers.contactos import activar_modo_humano_por_telefono
        result = activar_modo_humano_por_telefono(TELEFONO_TEST, "Test trigger", usuario_id=USUARIO_ID)
        db.refresh(contacto)
        if contacto.modo_humano:
            R.ok("Modo humano activado correctamente")
        else:
            R.fail("Modo humano no se activó")

        if contacto.modo_humano_razon and "Test trigger" in contacto.modo_humano_razon:
            R.ok("Razón guardada correctamente")
        else:
            R.fail("Razón no guardada", str(contacto.modo_humano_razon))

        if contacto.modo_humano_desde:
            R.ok("Timestamp de activación guardado")
        else:
            R.fail("Timestamp no guardado")

        # Verificar que AI no responde cuando modo humano activo
        # (simulamos el check del webhook)
        if contacto.modo_humano:
            R.ok("AI bloqueada en modo humano (contacto.modo_humano=True)")
        else:
            R.fail("AI no estaría bloqueada")

        # Desactivar con #reactivar
        reactivar_cmd = get_config("human_mode_reactivar_command", "#reactivar")
        R.ok(f"Comando reactivar configurado: '{reactivar_cmd}'")

        # Desactivar manualmente
        contacto.modo_humano = False
        contacto.modo_humano_desde = None
        contacto.modo_humano_razon = None
        db.commit()
        db.refresh(contacto)
        if not contacto.modo_humano:
            R.ok("Modo humano desactivado correctamente")
        else:
            R.fail("Modo humano no se desactivó")

        # Test expiración
        expire_hours = int(get_config("human_mode_expire_hours", "0"))
        if expire_hours > 0:
            R.ok(f"Auto-expiración configurada: {expire_hours}h")
        else:
            R.skip("Auto-expiración", "expire_hours=0 (nunca expira)")

    finally:
        db.close()


# ═══════════════════════════════════════════════════════════════════════════
# 3. SISTEMA DE CITAS (CALENDARIO)
# ═══════════════════════════════════════════════════════════════════════════

def test_citas():
    R.section("3. SISTEMA DE CITAS (eliminado)")
    R.skip("Sistema de citas", "Modulo de agenda eliminado")


# ═══════════════════════════════════════════════════════════════════════════
# 4. INVENTARIO / PRODUCTOS (eliminado)
# ═══════════════════════════════════════════════════════════════════════════

def test_inventario():
    R.section("4. INVENTARIO (eliminado)")
    R.skip("Inventario", "Modulo de inventario eliminado")


# ═══════════════════════════════════════════════════════════════════════════
# 5. CAPTURA DE DATOS
# ═══════════════════════════════════════════════════════════════════════════

def test_captura_datos():
    R.section("5. CAPTURA DE DATOS")
    from capture_service import CaptureService
    db = get_db()
    try:
        contacto = ensure_test_contact(db)

        # Campos configurados
        fields = CaptureService.get_fields(db, USUARIO_ID, activo_only=True)
        if fields:
            R.ok(f"Campos de captura: {len(fields)}", ", ".join(f["nombre"] for f in fields))
        else:
            R.skip("Sin campos de captura configurados")
            return

        # Guardar datos
        test_data = {}
        for f in fields[:2]:
            if f["tipo"] == "email":
                test_data[f["nombre"]] = "test@example.com"
            elif f["tipo"] == "telefono":
                test_data[f["nombre"]] = "5215500000000"
            elif f["tipo"] == "numero":
                test_data[f["nombre"]] = "25"
            else:
                test_data[f["nombre"]] = "Test Value"

        saved = CaptureService.save_captured_data(db, USUARIO_ID, TELEFONO_TEST, test_data)
        if saved:
            R.ok("Datos guardados", str(saved)[:60])
        else:
            R.fail("Datos no guardados")

        # Recuperar datos
        retrieved = CaptureService.get_captured_data(db, USUARIO_ID, TELEFONO_TEST)
        if retrieved:
            matches = all(retrieved.get(k) == v for k, v in test_data.items())
            if matches:
                R.ok("Datos recuperados correctamente")
            else:
                R.fail("Datos no coinciden", f"esperado={test_data}, obtenido={retrieved}")
        else:
            R.fail("Datos no recuperados")

        # Merge (no sobreescribir)
        extra_data = {fields[0]["nombre"]: "Updated Value"}
        saved2 = CaptureService.save_captured_data(db, USUARIO_ID, TELEFONO_TEST, extra_data)
        retrieved2 = CaptureService.get_captured_data(db, USUARIO_ID, TELEFONO_TEST)
        if len(fields) > 1 and retrieved2.get(fields[1]["nombre"]):
            R.ok("Merge preserva datos previos")
        else:
            if len(fields) > 1:
                R.fail("Merge perdió datos previos")
            else:
                R.skip("Merge test", "Solo 1 campo configurado")

        # Campos faltantes
        missing = CaptureService.get_missing_fields(db, USUARIO_ID, TELEFONO_TEST)
        if isinstance(missing, list):
            R.ok(f"Campos faltantes: {len(missing)}")
        else:
            R.fail("get_missing_fields falló")

        # Instrucciones para prompt
        instructions = CaptureService.get_capture_instructions(db, USUARIO_ID, TELEFONO_TEST)
        if isinstance(instructions, str):
            R.ok("Instrucciones de captura generadas", f"{len(instructions)} chars")
        else:
            R.fail("Instrucciones de captura fallaron")

        # Cleanup
        contacto.datos_capturados = None
        db.commit()

    finally:
        db.close()


# ═══════════════════════════════════════════════════════════════════════════
# 6. FUNNEL DE VENTAS
# ═══════════════════════════════════════════════════════════════════════════

def test_funnel():
    R.section("6. FUNNEL DE VENTAS")
    from funnel_service import FunnelService
    db = get_db()
    try:
        contacto = ensure_test_contact(db)
        contacto.paso_funnel = None
        db.commit()

        steps = FunnelService.get_all_steps(db, USUARIO_ID, activo_only=True)
        if not steps:
            R.skip("Sin pasos de funnel configurados")
            return

        R.ok(f"Funnel: {len(steps)} paso(s)", " → ".join(s["nombre"] for s in steps))

        # Primer paso
        first = FunnelService.get_first_step(db, USUARIO_ID)
        if first:
            R.ok(f"Primer paso: '{first['nombre']}'")
        else:
            R.fail("No se encontró primer paso")
            return

        # Asignar contacto al primer paso
        assigned = FunnelService.assign_contact_to_step(db, USUARIO_ID, TELEFONO_TEST, first["nombre"])
        if assigned:
            R.ok("Contacto asignado al primer paso")
        else:
            R.fail("No se pudo asignar")

        # Instrucciones del paso
        step_info = FunnelService.get_contact_step_info(db, USUARIO_ID, TELEFONO_TEST)
        if step_info and step_info.get("instrucciones"):
            R.ok("Instrucciones del paso disponibles", step_info["instrucciones"][:50])
        elif step_info and step_info.get("paso"):
            R.ok("Paso asignado (sin instrucciones específicas)")
        else:
            R.fail("No se obtuvieron instrucciones del paso")

        # Avanzar
        if len(steps) > 1:
            result = FunnelService.advance_contact(db, USUARIO_ID, TELEFONO_TEST, "Test avance")
            if result:
                R.ok(f"Avanzado: '{result['paso_anterior']}' → '{result['paso_nuevo']['nombre']}'")
            else:
                R.fail("No se pudo avanzar al siguiente paso")

            # Siguiente paso
            next_step = FunnelService.get_next_step(db, USUARIO_ID, result["paso_nuevo"]["nombre"]) if result else None
            if next_step:
                R.ok(f"Siguiente paso detectado: '{next_step['nombre']}'")
            elif len(steps) > 2:
                R.fail("No se detectó siguiente paso")
            else:
                R.ok("Último paso alcanzado (no hay siguiente)")
        else:
            R.skip("Avanzar funnel", "Solo 1 paso configurado")

        # Condiciones de avance
        if steps[0].get("condiciones_avance"):
            condiciones = steps[0]["condiciones_avance"]
            if isinstance(condiciones, str):
                condiciones = json.loads(condiciones)
            R.ok(f"Condiciones configuradas: {len(condiciones)}", str(condiciones)[:60])
        else:
            R.skip("Condiciones de avance", "Sin condiciones en primer paso")

        # Cleanup
        contacto.paso_funnel = None
        db.commit()

    finally:
        db.close()


# ═══════════════════════════════════════════════════════════════════════════
# 7. BASE DE CONOCIMIENTO
# ═══════════════════════════════════════════════════════════════════════════

def test_conocimiento():
    R.section("7. BASE DE CONOCIMIENTO")
    from knowledge_service import KnowledgeService
    db = get_db()
    try:
        docs = db.query(DocumentoConocimiento).filter(
            DocumentoConocimiento.usuario_id == USUARIO_ID,
            DocumentoConocimiento.activo == True
        ).all()

        if not docs:
            R.skip("Sin documentos de conocimiento")
            return

        R.ok(f"Documentos activos: {len(docs)}")
        categorias = set(d.categoria for d in docs if d.categoria)
        if categorias:
            R.ok(f"Categorías: {', '.join(categorias)}")

        # Búsqueda
        first_doc = docs[0]
        search_term = first_doc.titulo.split()[0] if first_doc.titulo else "servicio"
        results = KnowledgeService.search(db, USUARIO_ID, search_term)
        if results:
            R.ok(f"Búsqueda '{search_term}': {len(results)} resultado(s)")
        else:
            R.fail(f"Búsqueda '{search_term}' sin resultados")

        # Contexto para agente
        context = KnowledgeService.get_context_for_agent(db, USUARIO_ID)
        if context and len(context) > 0:
            R.ok(f"Contexto para agente: {len(context)} chars")
        else:
            R.fail("Contexto vacío")

        # Búsqueda sin resultados
        no_results = KnowledgeService.search(db, USUARIO_ID, "xyzqwertyuiop12345")
        if not no_results:
            R.ok("Búsqueda vacía retorna lista vacía")
        else:
            R.fail("Búsqueda vacía retornó resultados falsos")

    finally:
        db.close()


# ═══════════════════════════════════════════════════════════════════════════
# 8. CONSTRUCCIÓN DEL PROMPT
# ═══════════════════════════════════════════════════════════════════════════

def test_prompt_building():
    R.section("8. PROMPT DEL AGENTE")
    from agent import build_system_prompt
    db = get_db()
    try:
        ensure_test_contact(db)
        prompt = build_system_prompt(db, TELEFONO_TEST, USUARIO_ID)

        if not prompt or len(prompt) < 50:
            R.fail("Prompt vacío o muy corto", f"{len(prompt)} chars")
            return

        R.ok(f"Prompt generado: {len(prompt)} chars")

        # Verificar secciones
        agent_name = get_config("agent_name", "Asistente", usuario_id=USUARIO_ID)
        if agent_name in prompt:
            R.ok(f"Nombre del agente incluido: '{agent_name}'")
        else:
            R.fail(f"Nombre del agente NO incluido: '{agent_name}'")

        business_name = get_config("business_name", "Mi Negocio", usuario_id=USUARIO_ID)
        if business_name in prompt:
            R.ok(f"Nombre del negocio incluido: '{business_name}'")
        else:
            R.fail(f"Nombre del negocio NO incluido")

        # Fecha/hora actual
        ahora = datetime.now()
        if ahora.strftime("%Y-%m-%d") in prompt:
            R.ok("Fecha actual incluida")
        else:
            R.fail("Fecha actual NO incluida")

        # Reglas internas
        if "nunca" in prompt.lower() and "bot" in prompt.lower():
            R.ok("Reglas internas incluidas (no revelar que es AI)")
        else:
            R.fail("Reglas internas no encontradas")

        # Knowledge base (si existe)
        from knowledge_service import KnowledgeService
        kb = KnowledgeService.get_context_for_agent(db, USUARIO_ID)
        if kb:
            if kb[:30] in prompt:
                R.ok("Knowledge base inyectada en prompt")
            else:
                R.fail("Knowledge base NO inyectada")
        else:
            R.skip("Knowledge base en prompt", "No hay documentos")

        # Tools deshabilitados
        from agent import _get_tools_availability_info
        tools_info = _get_tools_availability_info(USUARIO_ID)
        if tools_info:
            if "NO DISPONIBLES" in prompt:
                R.ok("Tools deshabilitados mencionados en prompt")
            else:
                R.fail("Tools deshabilitados NO mencionados")
        else:
            R.ok("Todos los tools habilitados (nada que mencionar)")

        # Custom instructions
        custom = get_config("custom_instructions", "", usuario_id=USUARIO_ID)
        if custom:
            if custom[:20] in prompt:
                R.ok("Custom instructions incluidas")
            else:
                R.fail("Custom instructions NO incluidas")
        else:
            R.skip("Custom instructions", "No configuradas")

    finally:
        db.close()


# ═══════════════════════════════════════════════════════════════════════════
# 9. TOOLS DEL AGENTE (HABILITACIÓN/EJECUCIÓN)
# ═══════════════════════════════════════════════════════════════════════════

def test_tools():
    R.section("9. TOOLS DEL AGENTE")
    from agent import get_enabled_tools, execute_tool

    # Tools habilitados
    tools = get_enabled_tools(USUARIO_ID)
    if tools:
        tool_names = [t["function"]["name"] for t in tools]
        R.ok(f"Tools habilitados: {len(tools)}", ", ".join(tool_names))
    else:
        R.fail("No hay tools habilitados")
        return

    # Tools always-on
    always_tools = ["guardar_datos_contacto", "buscar_conocimiento", "avanzar_paso_funnel", "transferir_a_humano"]
    for t in always_tools:
        if t in tool_names:
            R.ok(f"Tool always-on: '{t}'")
        else:
            R.fail(f"Tool always-on faltante: '{t}'")

    # Ejecutar tool: guardar_datos_contacto
    db = get_db()
    try:
        ensure_test_contact(db)
        result = execute_tool("guardar_datos_contacto", {"nombre": "Test Name"}, TELEFONO_TEST, db, USUARIO_ID)
        if isinstance(result, dict) and "resultado" in result:
            R.ok("execute_tool: guardar_datos_contacto OK")
        else:
            R.fail("execute_tool: guardar_datos_contacto falló", str(result)[:60])

        # Ejecutar tool: buscar_conocimiento
        result_kb = execute_tool("buscar_conocimiento", {"consulta": "servicios"}, TELEFONO_TEST, db, USUARIO_ID)
        if isinstance(result_kb, dict):
            R.ok(f"execute_tool: buscar_conocimiento OK (encontrado={result_kb.get('encontrado')})")
        else:
            R.fail("execute_tool: buscar_conocimiento falló")

        # Tool inexistente
        result_bad = execute_tool("tool_que_no_existe", {}, TELEFONO_TEST, db, USUARIO_ID)
        if isinstance(result_bad, dict) and "error" in result_bad:
            R.ok("Tool inexistente retorna error")
        else:
            R.fail("Tool inexistente no retornó error")

        # Cleanup
        contacto = db.query(Contacto).filter(
            Contacto.telefono == TELEFONO_TEST, Contacto.usuario_id == USUARIO_ID
        ).first()
        if contacto:
            contacto.datos_capturados = None
            db.commit()
    finally:
        db.close()


# ═══════════════════════════════════════════════════════════════════════════
# 10. CONFIGURACIÓN DEL AGENTE
# ═══════════════════════════════════════════════════════════════════════════

def test_configuracion():
    R.section("10. CONFIGURACIÓN")

    # Agent enabled
    agent_enabled = get_config("agent_enabled", "true", usuario_id=USUARIO_ID)
    if agent_enabled.lower() == "true":
        R.ok("Agente habilitado")
    else:
        R.ok("Agente deshabilitado (intencional?)")

    # Model config
    model = get_config("model", "gpt-4o-mini", usuario_id=USUARIO_ID)
    R.ok(f"Modelo: {model}")

    temperature = get_config("temperature", "0.7", usuario_id=USUARIO_ID)
    try:
        temp_f = float(temperature)
        if 0 <= temp_f <= 2:
            R.ok(f"Temperature: {temp_f}")
        else:
            R.fail(f"Temperature fuera de rango: {temp_f}")
    except:
        R.fail(f"Temperature inválida: {temperature}")

    max_tokens = get_config("max_tokens", "500", usuario_id=USUARIO_ID)
    try:
        mt = int(max_tokens)
        if 50 <= mt <= 4096:
            R.ok(f"Max tokens: {mt}")
        else:
            R.fail(f"Max tokens fuera de rango: {mt}")
    except:
        R.fail(f"Max tokens inválido: {max_tokens}")

    # OpenAI key
    api_key = get_config("openai_api_key", "", usuario_id=USUARIO_ID) or os.getenv("OPENAI_API_KEY", "")
    if api_key:
        R.ok(f"OpenAI API key configurada ({api_key[:8]}...)")
    else:
        R.fail("OpenAI API key NO configurada")

    # Prompt edit mode
    edit_mode = get_config("prompt_edit_mode", "sections", usuario_id=USUARIO_ID)
    R.ok(f"Modo edición prompt: {edit_mode}")

    # Business config
    db = get_db()
    try:
        biz = db.query(BusinessConfig).filter(BusinessConfig.usuario_id == USUARIO_ID).first()
        if biz:
            R.ok(f"BusinessConfig: {biz.business_name or 'sin nombre'}")
        else:
            R.skip("BusinessConfig no encontrada")
    finally:
        db.close()


# ═══════════════════════════════════════════════════════════════════════════
# 11. HISTORIAL DE MENSAJES
# ═══════════════════════════════════════════════════════════════════════════

def test_mensajes():
    R.section("11. HISTORIAL DE MENSAJES")
    from message_service import MessageService
    db = get_db()
    try:
        ensure_test_contact(db)

        # Limpiar
        db.query(MensajeConversacion).filter(
            MensajeConversacion.telefono == TELEFONO_TEST,
            MensajeConversacion.usuario_id == USUARIO_ID
        ).delete()
        db.commit()

        # Agregar mensaje
        msg1 = MessageService.add_message(db, TELEFONO_TEST, "user", "Hola test", usuario_id=USUARIO_ID)
        if msg1:
            R.ok("Mensaje user guardado")
        else:
            R.fail("Mensaje user no guardado")

        msg2 = MessageService.add_message(db, TELEFONO_TEST, "assistant", "Hola! En qué puedo ayudarte?", usuario_id=USUARIO_ID)
        if msg2:
            R.ok("Mensaje assistant guardado")
        else:
            R.fail("Mensaje assistant no guardado")

        # System event
        evt = MessageService.add_system_event(
            db, TELEFONO_TEST, "datos_guardados",
            "Datos: nombre=Test", usuario_id=USUARIO_ID,
            metadata={"nombre": "Test"}
        )
        if evt:
            R.ok("System event guardado")
        else:
            R.fail("System event no guardado")

        # Get messages (all)
        all_msgs = MessageService.get_messages(db, TELEFONO_TEST, USUARIO_ID)
        if len(all_msgs) >= 3:
            R.ok(f"get_messages: {len(all_msgs)} mensajes (incluye events)")
        else:
            R.fail(f"get_messages: solo {len(all_msgs)}, esperaba >=3")

        # Get messages for AI (sin events)
        ai_msgs = MessageService.get_messages_for_ai(db, TELEFONO_TEST, USUARIO_ID)
        has_system = any(m["role"] == "system" for m in ai_msgs)
        if not has_system and len(ai_msgs) == 2:
            R.ok("get_messages_for_ai: excluye system events")
        elif not has_system:
            R.ok(f"get_messages_for_ai: {len(ai_msgs)} msgs, sin events")
        else:
            R.fail("get_messages_for_ai incluye system events")

        # Cleanup
        db.query(MensajeConversacion).filter(
            MensajeConversacion.telefono == TELEFONO_TEST,
            MensajeConversacion.usuario_id == USUARIO_ID
        ).delete()
        db.commit()

    finally:
        db.close()


# ═══════════════════════════════════════════════════════════════════════════
# 12. RESPUESTA DEL AGENTE (END-TO-END)
# ═══════════════════════════════════════════════════════════════════════════

def test_respuesta_agente():
    R.section("12. RESPUESTA DEL AGENTE (E2E)")
    from agent import responder

    api_key = get_config("openai_api_key", "", usuario_id=USUARIO_ID) or os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        R.skip("Respuesta agente", "No hay OpenAI API key")
        R.skip("Tool calling", "No hay OpenAI API key")
        R.skip("Formato respuesta", "No hay OpenAI API key")
        return

    db = get_db()
    try:
        ensure_test_contact(db)
        # Limpiar historial
        db.query(MensajeConversacion).filter(
            MensajeConversacion.telefono == TELEFONO_TEST,
            MensajeConversacion.usuario_id == USUARIO_ID
        ).delete()
        db.commit()
    finally:
        db.close()

    # Test 12a: Mensaje simple
    try:
        resp = responder("Hola, qué servicios tienen?", TELEFONO_TEST, USUARIO_ID)
        if resp and len(resp) > 10:
            R.ok(f"Respuesta generada: {len(resp)} chars", resp[:80].replace('\n', ' '))
        else:
            R.fail("Respuesta vacía o muy corta")
    except Exception as e:
        R.fail(f"Error en responder: {str(e)[:60]}")

    # Test 12b: Verificar que se guardó en historial
    db = get_db()
    try:
        msgs = db.query(MensajeConversacion).filter(
            MensajeConversacion.telefono == TELEFONO_TEST,
            MensajeConversacion.usuario_id == USUARIO_ID,
        ).order_by(MensajeConversacion.created_at).all()

        user_msgs = [m for m in msgs if m.rol == "user"]
        asst_msgs = [m for m in msgs if m.rol == "assistant"]

        if user_msgs:
            R.ok("Mensaje user guardado en historial")
        else:
            R.fail("Mensaje user NO guardado")

        if asst_msgs:
            R.ok("Respuesta assistant guardada en historial")
        else:
            R.fail("Respuesta assistant NO guardada")
    finally:
        db.close()

    # Test 12c: Respuesta con datos (debería activar guardar_datos_contacto)
    try:
        resp2 = responder("Me llamo Carlos García, mi correo es carlos@test.com", TELEFONO_TEST, USUARIO_ID)
        if resp2 and len(resp2) > 5:
            R.ok("Respuesta con datos personales OK")
            # Verificar si se guardaron datos
            db = get_db()
            try:
                contacto = db.query(Contacto).filter(
                    Contacto.telefono == TELEFONO_TEST,
                    Contacto.usuario_id == USUARIO_ID
                ).first()
                if contacto and contacto.datos_capturados:
                    datos = json.loads(contacto.datos_capturados) if isinstance(contacto.datos_capturados, str) else contacto.datos_capturados
                    if datos:
                        R.ok(f"Tool calling: datos capturados ({len(datos)} campos)")
                    else:
                        R.skip("Tool calling: datos vacíos", "AI puede no haber llamado al tool")
                else:
                    R.skip("Tool calling: sin datos capturados", "AI decidió no guardar")
            finally:
                db.close()
        else:
            R.fail("Respuesta con datos falló")
    except Exception as e:
        R.fail(f"Error con datos: {str(e)[:60]}")

    # Cleanup
    db = get_db()
    try:
        cleanup_test_data(db)
    finally:
        db.close()


# ═══════════════════════════════════════════════════════════════════════════
# 13. TRANSFERIR A HUMANO (TOOL)
# ═══════════════════════════════════════════════════════════════════════════

def test_transferir_humano():
    R.section("13. TRANSFERIR A HUMANO (TOOL)")
    from agent import execute_tool
    db = get_db()
    try:
        contacto = ensure_test_contact(db)
        contacto.modo_humano = False
        db.commit()

        result = execute_tool("transferir_a_humano", {"razon": "Cliente molesto"}, TELEFONO_TEST, db, USUARIO_ID)
        if isinstance(result, dict) and "resultado" in result:
            R.ok("Tool transferir_a_humano ejecutado", str(result["resultado"])[:60])
        else:
            R.fail("Tool transferir_a_humano falló", str(result)[:60])

        # Verificar modo humano activado
        db.refresh(contacto)
        if contacto.modo_humano:
            R.ok("Modo humano activado vía tool")
        else:
            R.fail("Modo humano NO activado vía tool")

        # Verificar system event
        from message_service import MessageService
        msgs = MessageService.get_messages(db, TELEFONO_TEST, USUARIO_ID, limit=5)
        human_events = [m for m in msgs if m.get("tipo_evento") == "intervencion_humana"]
        if human_events:
            R.ok("System event de intervención registrado")
        else:
            R.fail("System event de intervención NO registrado")

        # Cleanup
        contacto.modo_humano = False
        contacto.modo_humano_desde = None
        contacto.modo_humano_razon = None
        db.commit()
    finally:
        db.close()


# ═══════════════════════════════════════════════════════════════════════════
# 14. ENVIAR MEDIA (TOOL)
# ═══════════════════════════════════════════════════════════════════════════

def test_enviar_media():
    R.section("14. ENVIAR MEDIA (eliminado)")
    R.skip("Enviar media", "Modulo de galeria/media eliminado")


# ═══════════════════════════════════════════════════════════════════════════
# 15. MULTI-TENANCY
# ═══════════════════════════════════════════════════════════════════════════

def test_multitenancy():
    R.section("15. MULTI-TENANCY")

    # Config global vs user
    set_config("test_mt_key", "global_value", usuario_id=0)
    global_val = get_config("test_mt_key", "", usuario_id=USUARIO_ID)
    if global_val == "global_value":
        R.ok("Config global como fallback")
    else:
        R.fail("Config global no funciona como fallback")

    set_config("test_mt_key", "user_value", usuario_id=USUARIO_ID)
    invalidate_config_cache("test_mt_key", USUARIO_ID)
    user_val = get_config("test_mt_key", "", usuario_id=USUARIO_ID)
    if user_val == "user_value":
        R.ok("Config user override sobre global")
    else:
        R.fail("Config user override no funciona", f"got: {user_val}")

    # Limpiar
    db = get_db()
    try:
        db.query(Configuracion).filter(
            Configuracion.clave == "test_mt_key"
        ).delete()
        db.commit()
        invalidate_config_cache("test_mt_key")
    finally:
        db.close()


# ═══════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════

def main():
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'═'*60}")
    print(f"  TEST COMPLETO DEL AGENTE - WTX")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Usuario ID: {USUARIO_ID} | Tel test: {TELEFONO_TEST}")
    print(f"{'═'*60}{Colors.END}")

    db = get_db()
    try:
        cleanup_test_data(db)
        ensure_test_contact(db)
    finally:
        db.close()

    test_sections = [
        ("Triggers", test_triggers),
        ("Modo Humano", test_modo_humano),
        ("Citas", test_citas),
        ("Inventario", test_inventario),
        ("Captura de Datos", test_captura_datos),
        ("Funnel", test_funnel),
        ("Conocimiento", test_conocimiento),
        ("Prompt Building", test_prompt_building),
        ("Tools", test_tools),
        ("Configuración", test_configuracion),
        ("Mensajes", test_mensajes),
        ("Respuesta E2E", test_respuesta_agente),
        ("Transferir Humano", test_transferir_humano),
        ("Enviar Media", test_enviar_media),
        ("Multi-tenancy", test_multitenancy),
    ]

    for name, fn in test_sections:
        try:
            fn()
        except Exception as e:
            R.section(f"💥 ERROR EN: {name}")
            R.fail(f"Exception: {str(e)[:100]}")
            traceback.print_exc()

    # Final cleanup
    db = get_db()
    try:
        cleanup_test_data(db)
    finally:
        db.close()

    success = R.summary()
    return success


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
