"""
Sistema de pruebas para respuestas de IA
Evalúa: formato, coherencia, triggers y comportamiento
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent import responder
from api.routers.webhook import detectar_trigger_modo_humano
from database import get_config
import json

# Colores para terminal
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_header(text):
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{text}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.END}")

def print_question(num, question):
    print(f"\n{Colors.BOLD}{Colors.BLUE}[Pregunta {num}]{Colors.END}")
    print(f"{Colors.YELLOW}Usuario: {question}{Colors.END}")

def print_response(response, trigger_detected):
    # Analizar formato
    has_newlines = "\n" in response
    line_count = response.count("\n") + 1
    char_count = len(response)
    
    # Status de formato
    format_status = f"{Colors.GREEN}✓ Con formato ({line_count} líneas){Colors.END}" if has_newlines else f"{Colors.RED}✗ Sin saltos de línea{Colors.END}"
    trigger_status = f"{Colors.RED}🚨 MODO HUMANO ACTIVADO{Colors.END}" if trigger_detected else ""
    
    print(f"\n{Colors.BOLD}IA ({char_count} chars) {format_status} {trigger_status}{Colors.END}")
    print(f"{Colors.CYAN}{'─'*50}{Colors.END}")
    
    # Mostrar respuesta con formato visible
    for i, line in enumerate(response.split("\n")):
        prefix = f"  {i+1:2d}│ " if has_newlines else "     "
        print(f"{prefix}{line}")
    
    print(f"{Colors.CYAN}{'─'*50}{Colors.END}")

def analyze_response(response):
    """Analizar calidad de la respuesta"""
    issues = []
    
    # Verificar formato
    if "\n" not in response:
        issues.append("Sin saltos de línea")
    
    # Verificar longitud
    if len(response) > 1000:
        issues.append("Muy larga (>1000 chars)")
    
    # Verificar que no mencione productos si solo hay servicios
    if "producto" in response.lower() and "servicio" not in response.lower():
        issues.append("Menciona productos (solo debe ofrecer servicios)")
    
    return issues

# Lista de preguntas de prueba
TEST_QUESTIONS = [
    # Primer contacto
    {"q": "Hola", "category": "Saludo inicial", "expect_trigger": False},
    {"q": "Sí", "category": "Respuesta corta (primer contacto)", "expect_trigger": False},
    {"q": "Quiero más información", "category": "Solicitud general", "expect_trigger": False},
    
    # Servicios
    {"q": "¿Qué servicios tienen?", "category": "Consulta servicios", "expect_trigger": False},
    {"q": "¿Cuáles son los precios?", "category": "Consulta precios", "expect_trigger": False},
    {"q": "¿Tienen masajes?", "category": "Servicio específico", "expect_trigger": False},
    
    # Triggers - Modo Humano
    {"q": "Me pueden mandar una foto del lugar?", "category": "TRIGGER: foto", "expect_trigger": True},
    {"q": "Quiero ver imágenes de las instalaciones", "category": "TRIGGER: imagen", "expect_trigger": True},
    {"q": "Necesito hablar con una persona real", "category": "TRIGGER: humano", "expect_trigger": True},
    {"q": "Estoy muy molesto con el servicio", "category": "TRIGGER: frustración", "expect_trigger": True},
    
    # Citas
    {"q": "Quiero agendar una cita para mañana", "category": "Agendar cita", "expect_trigger": False},
    {"q": "¿Tienen disponibilidad el sábado?", "category": "Consulta disponibilidad", "expect_trigger": False},
    
    # Preguntas difíciles
    {"q": "¿Qué productos venden?", "category": "Pregunta productos (debe redirigir a servicios)", "expect_trigger": False},
    {"q": "¿Cuál es el mejor servicio?", "category": "Recomendación", "expect_trigger": False},
    {"q": "¿Hacen descuentos?", "category": "TRIGGER: negociación", "expect_trigger": True},
]

def run_tests():
    print_header("SISTEMA DE PRUEBAS DE IA")
    
    # Mostrar config actual
    print(f"\n{Colors.BOLD}Configuración actual:{Colors.END}")
    prompt = get_config("system_prompt", "")
    triggers = get_config("human_mode_triggers", "[]")
    custom = get_config("human_mode_custom_triggers", "")
    print(f"  Prompt: {len(prompt)} chars")
    print(f"  Triggers: {triggers}")
    print(f"  Custom: {custom}")
    
    results = []
    telefono_test = "+5215500000001"
    
    print_header("EJECUTANDO PRUEBAS")
    
    for i, test in enumerate(TEST_QUESTIONS, 1):
        question = test["q"]
        category = test["category"]
        expect_trigger = test["expect_trigger"]
        
        print_question(i, f"[{category}] {question}")
        
        # Obtener respuesta
        try:
            response = responder(question, telefono_test)
            trigger_detected = detectar_trigger_modo_humano(question, response)
            
            print_response(response, trigger_detected)
            
            # Analizar
            issues = analyze_response(response)
            
            # Verificar trigger esperado
            trigger_ok = trigger_detected == expect_trigger
            if not trigger_ok:
                if expect_trigger:
                    issues.append(f"Debió activar modo humano pero NO lo hizo")
                else:
                    issues.append(f"Activó modo humano pero NO debía")
            
            results.append({
                "question": question,
                "category": category,
                "response_len": len(response),
                "has_format": "\n" in response,
                "trigger_detected": trigger_detected,
                "trigger_expected": expect_trigger,
                "trigger_ok": trigger_ok,
                "issues": issues
            })
            
            if issues:
                print(f"{Colors.YELLOW}⚠️  Issues: {', '.join(issues)}{Colors.END}")
                
        except Exception as e:
            print(f"{Colors.RED}❌ Error: {e}{Colors.END}")
            results.append({
                "question": question,
                "category": category,
                "error": str(e)
            })
    
    # Resumen
    print_header("RESUMEN DE PRUEBAS")
    
    total = len(results)
    with_format = sum(1 for r in results if r.get("has_format", False))
    triggers_ok = sum(1 for r in results if r.get("trigger_ok", False))
    with_issues = sum(1 for r in results if r.get("issues", []))
    
    print(f"\n{Colors.BOLD}Estadísticas:{Colors.END}")
    print(f"  Total pruebas: {total}")
    print(f"  Con formato correcto: {with_format}/{total} ({100*with_format//total}%)")
    print(f"  Triggers correctos: {triggers_ok}/{total} ({100*triggers_ok//total}%)")
    print(f"  Con problemas: {with_issues}/{total}")
    
    # Problemas encontrados
    if with_issues > 0:
        print(f"\n{Colors.BOLD}{Colors.YELLOW}Problemas detectados:{Colors.END}")
        for r in results:
            if r.get("issues"):
                print(f"  • [{r['category']}] {', '.join(r['issues'])}")
    
    # Veredicto
    print(f"\n{Colors.BOLD}Veredicto:{Colors.END}")
    if with_format == total and triggers_ok == total:
        print(f"  {Colors.GREEN}✅ TODO OK - IA funcionando correctamente{Colors.END}")
    else:
        print(f"  {Colors.YELLOW}⚠️  HAY ISSUES - Revisar configuración{Colors.END}")
    
    return results

if __name__ == "__main__":
    run_tests()
