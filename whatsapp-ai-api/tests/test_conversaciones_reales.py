"""
Tests basados en conversaciones REALES de wtx.elementspa.mx
Extraídas de producción el 2026-01-20
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent import responder
from api.routers.webhook import detectar_trigger_modo_humano
from database import get_config

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'

# Preguntas REALES de usuarios en producción
PREGUNTAS_REALES = [
    # Saludos simples
    {"q": "Hola buenos días", "categoria": "Saludo", "debe_tener": ["hola", "ayudar"], "trigger": False},
    {"q": "Si", "categoria": "Respuesta corta", "debe_tener": ["ayudar"], "trigger": False},
    {"q": ".", "categoria": "Punto solo", "debe_tener": ["hola", "ayudar"], "trigger": False},
    
    # Solicitud de información
    {"q": "¡Hola! Quiero más información", "categoria": "Info general", "debe_tener": ["servicio", "masaje"], "trigger": False},
    {"q": "¡Hola! Quiero más información.", "categoria": "Info general 2", "debe_tener": ["servicio"], "trigger": False},
    
    # Preguntas específicas (TRIGGERS)
    {"q": "Tienes catálogo de las terapeutas?", "categoria": "TRIGGER: catálogo terapeutas", "debe_tener": [], "trigger": True},
    {"q": "Me mandas fotos de las chicas?", "categoria": "TRIGGER: fotos chicas", "debe_tener": [], "trigger": True},
    {"q": "Fotos de terapeutas", "categoria": "TRIGGER: fotos terapeutas", "debe_tener": [], "trigger": True},
    
    # Flujo de reserva
    {"q": "Quedo al pendiente", "categoria": "Cliente indeciso", "debe_tener": ["ayudar", "aquí"], "trigger": False},
    {"q": "Si me gustaría el número 2 para el día sabado", "categoria": "Selección servicio", "debe_tener": ["conexión", "esencial"], "trigger": False},
    {"q": "Roma Norte", "categoria": "Selección sucursal", "debe_tener": ["roma", "norte"], "trigger": False},
    {"q": "Me interesa", "categoria": "Interés", "debe_tener": ["ayudar"], "trigger": False},
    {"q": "Con Fernanda me interesa", "categoria": "Terapeuta específica", "debe_tener": ["fernanda"], "trigger": False},
    {"q": "Sabado 24", "categoria": "Fecha específica", "debe_tener": ["sábado", "24"], "trigger": False},
    {"q": "Por mensaje o llamada dices", "categoria": "Consulta método", "debe_tener": ["llam"], "trigger": False},
    
    # Preguntas de precio/servicio
    {"q": "Cuáles son los precios?", "categoria": "Precios", "debe_tener": ["$", "precio"], "trigger": False},
    {"q": "Qué servicios tienen?", "categoria": "Servicios", "debe_tener": ["servicio", "masaje"], "trigger": False},
    
    # Edge cases
    {"q": "Disculpa por cual", "categoria": "Clarificación", "debe_tener": [], "trigger": False},
    {"q": "Por favor", "categoria": "Cortesía", "debe_tener": ["ayudar"], "trigger": False},
]

def analizar_respuesta(respuesta, debe_tener):
    """Verifica si la respuesta contiene las palabras esperadas"""
    respuesta_lower = respuesta.lower()
    faltantes = []
    for palabra in debe_tener:
        if palabra.lower() not in respuesta_lower:
            faltantes.append(palabra)
    return faltantes

def verificar_formato(respuesta):
    """Verifica el formato de la respuesta"""
    tiene_saltos = "\n" in respuesta
    lineas = respuesta.count("\n") + 1
    largo = len(respuesta)
    
    problemas = []
    if largo > 1500:
        problemas.append(f"Muy larga ({largo} chars)")
    if largo < 20:
        problemas.append(f"Muy corta ({largo} chars)")
    
    return tiene_saltos, lineas, problemas

def run_tests():
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*70}")
    print("TESTS DE CONVERSACIONES REALES - wtx.elementspa.mx")
    print(f"{'='*70}{Colors.END}\n")
    
    # Mostrar config
    print(f"{Colors.BOLD}Configuración actual:{Colors.END}")
    print(f"  Prompt: {len(get_config('system_prompt', ''))} chars")
    print(f"  Triggers: {get_config('human_mode_triggers', '[]')}")
    print(f"  Custom: {get_config('human_mode_custom_triggers', '')}")
    
    resultados = []
    telefono = "+5215500000099"
    
    print(f"\n{Colors.BOLD}{'='*70}")
    print("EJECUTANDO TESTS")
    print(f"{'='*70}{Colors.END}\n")
    
    for i, test in enumerate(PREGUNTAS_REALES, 1):
        pregunta = test["q"]
        categoria = test["categoria"]
        debe_tener = test["debe_tener"]
        espera_trigger = test["trigger"]
        
        print(f"{Colors.BOLD}{Colors.BLUE}[{i:2d}] {categoria}{Colors.END}")
        print(f"    {Colors.YELLOW}Usuario: \"{pregunta}\"{Colors.END}")
        
        try:
            # Obtener respuesta
            respuesta = responder(pregunta, telefono)
            trigger = detectar_trigger_modo_humano(pregunta, respuesta)
            
            # Analizar
            faltantes = analizar_respuesta(respuesta, debe_tener)
            tiene_formato, lineas, prob_formato = verificar_formato(respuesta)
            
            # Status
            trigger_ok = trigger == espera_trigger
            contenido_ok = len(faltantes) == 0
            formato_ok = len(prob_formato) == 0
            
            # Mostrar respuesta (primeras líneas)
            preview = respuesta[:200].replace('\n', ' ↵ ')
            print(f"    {Colors.CYAN}IA: \"{preview}...\"{Colors.END}")
            
            # Status icons
            status_parts = []
            if trigger:
                status_parts.append(f"{Colors.RED}🚨 MODO HUMANO{Colors.END}")
            if tiene_formato:
                status_parts.append(f"{Colors.GREEN}✓ Formato ({lineas} líneas){Colors.END}")
            else:
                status_parts.append(f"{Colors.YELLOW}○ Sin saltos{Colors.END}")
            
            if not trigger_ok:
                if espera_trigger:
                    status_parts.append(f"{Colors.RED}✗ Debió activar trigger{Colors.END}")
                else:
                    status_parts.append(f"{Colors.RED}✗ Trigger inesperado{Colors.END}")
            
            if faltantes:
                status_parts.append(f"{Colors.YELLOW}⚠ Falta: {', '.join(faltantes)}{Colors.END}")
            
            print(f"    {' | '.join(status_parts)}")
            print()
            
            resultados.append({
                "pregunta": pregunta,
                "categoria": categoria,
                "respuesta_len": len(respuesta),
                "tiene_formato": tiene_formato,
                "trigger": trigger,
                "trigger_esperado": espera_trigger,
                "trigger_ok": trigger_ok,
                "contenido_ok": contenido_ok,
                "faltantes": faltantes,
            })
            
        except Exception as e:
            print(f"    {Colors.RED}❌ Error: {e}{Colors.END}\n")
            resultados.append({"error": str(e), "categoria": categoria})
    
    # RESUMEN
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*70}")
    print("RESUMEN")
    print(f"{'='*70}{Colors.END}\n")
    
    total = len(resultados)
    errores = sum(1 for r in resultados if "error" in r)
    con_formato = sum(1 for r in resultados if r.get("tiene_formato", False))
    triggers_ok = sum(1 for r in resultados if r.get("trigger_ok", False))
    contenido_ok = sum(1 for r in resultados if r.get("contenido_ok", False))
    
    print(f"  Total tests: {total}")
    print(f"  Errores: {errores}")
    print(f"  Con formato (saltos de línea): {con_formato}/{total-errores} ({100*con_formato//(total-errores) if total-errores > 0 else 0}%)")
    print(f"  Triggers correctos: {triggers_ok}/{total-errores} ({100*triggers_ok//(total-errores) if total-errores > 0 else 0}%)")
    print(f"  Contenido esperado: {contenido_ok}/{total-errores} ({100*contenido_ok//(total-errores) if total-errores > 0 else 0}%)")
    
    # Tests fallidos
    fallidos = [r for r in resultados if not r.get("trigger_ok", True) or r.get("faltantes")]
    if fallidos:
        print(f"\n{Colors.BOLD}{Colors.YELLOW}Tests con problemas:{Colors.END}")
        for r in fallidos:
            problemas = []
            if not r.get("trigger_ok", True):
                problemas.append("trigger incorrecto")
            if r.get("faltantes"):
                problemas.append(f"falta: {', '.join(r['faltantes'])}")
            print(f"  • [{r.get('categoria', '?')}] {', '.join(problemas)}")
    
    # Veredicto final
    score = (triggers_ok + contenido_ok) / (2 * (total - errores)) * 100 if total - errores > 0 else 0
    print(f"\n{Colors.BOLD}Score general: {score:.0f}%{Colors.END}")
    
    if score >= 90:
        print(f"{Colors.GREEN}✅ EXCELENTE - IA funcionando correctamente{Colors.END}")
    elif score >= 70:
        print(f"{Colors.YELLOW}⚠️ ACEPTABLE - Algunas mejoras necesarias{Colors.END}")
    else:
        print(f"{Colors.RED}❌ NECESITA AJUSTES - Revisar prompt y triggers{Colors.END}")
    
    return resultados

if __name__ == "__main__":
    run_tests()
