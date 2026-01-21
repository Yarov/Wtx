"""
Test DINÁMICO de triggers - lee configuración actual y valida automáticamente
Si agregas nuevos triggers desde el frontend, este test los detectará
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_config
from api.routers.webhook import detectar_trigger_modo_humano
import json

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'

# Keywords predefinidos por tipo de trigger (del código)
TRIGGER_KEYWORDS = {
    "frustration": ["molesto", "enojado", "frustrado", "harto", "cansado de", "no sirve", "pésimo", "horrible", "terrible", "indignado"],
    "complaint": ["queja", "reclamo", "demanda", "problema grave", "inaceptable", "exijo", "reembolso", "devolución"],
    "human_request": ["hablar con humano", "persona real", "agente humano", "hablar con alguien", "asesor", "ejecutivo", "representante", "operador", "supervisor"],
    "urgency": ["urgente", "emergencia", "ahora mismo", "inmediatamente", "lo antes posible", "crítico"],
    "complexity": ["no entiendes", "no me ayudas", "no puedes", "no sabes", "inútil", "no sirves"],
    "negotiation": ["descuento", "rebaja", "precio especial", "promoción", "negociar", "oferta"]
}

def generar_mensaje_test(keyword):
    """Genera un mensaje de prueba que contenga la keyword"""
    # Para frases, crear mensaje natural
    if " " in keyword:
        return f"Hola, {keyword} por favor"
    # Para palabras sueltas
    return f"Quiero {keyword} ahora"

def run_dynamic_test():
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*70}")
    print("TEST DINÁMICO DE TRIGGERS")
    print("Lee la configuración actual y valida automáticamente")
    print(f"{'='*70}{Colors.END}\n")
    
    # Leer configuración actual
    triggers_str = get_config("human_mode_triggers", '[]')
    custom_str = get_config("human_mode_custom_triggers", "")
    
    try:
        triggers_activos = json.loads(triggers_str)
    except:
        triggers_activos = []
    
    custom_keywords = [k.strip() for k in custom_str.split(",") if k.strip()]
    
    print(f"{Colors.BOLD}Configuración detectada:{Colors.END}")
    print(f"  Triggers activos: {triggers_activos}")
    print(f"  Custom keywords: {custom_keywords}")
    
    resultados = {"passed": 0, "failed": 0, "errors": []}
    
    # ========================================
    # TEST 1: Triggers predefinidos activos
    # ========================================
    print(f"\n{Colors.BOLD}{Colors.CYAN}--- TEST 1: Triggers Predefinidos Activos ---{Colors.END}")
    
    for trigger_type in triggers_activos:
        if trigger_type in TRIGGER_KEYWORDS:
            keywords = TRIGGER_KEYWORDS[trigger_type]
            print(f"\n  [{trigger_type}] - {len(keywords)} keywords")
            
            for keyword in keywords[:3]:  # Probar primeras 3 de cada tipo
                msg = generar_mensaje_test(keyword)
                result = detectar_trigger_modo_humano(msg, "")
                
                if result:
                    print(f"    {Colors.GREEN}✅ \"{keyword}\" -> detectado{Colors.END}")
                    resultados["passed"] += 1
                else:
                    print(f"    {Colors.RED}❌ \"{keyword}\" -> NO detectado{Colors.END}")
                    resultados["failed"] += 1
                    resultados["errors"].append(f"Trigger '{trigger_type}' con keyword '{keyword}' no detectado")
    
    # ========================================
    # TEST 2: Custom keywords
    # ========================================
    print(f"\n{Colors.BOLD}{Colors.CYAN}--- TEST 2: Custom Keywords ---{Colors.END}")
    
    if custom_keywords:
        for keyword in custom_keywords:
            msg = generar_mensaje_test(keyword)
            result = detectar_trigger_modo_humano(msg, "")
            
            if result:
                print(f"  {Colors.GREEN}✅ \"{keyword}\" -> detectado{Colors.END}")
                resultados["passed"] += 1
            else:
                print(f"  {Colors.RED}❌ \"{keyword}\" -> NO detectado{Colors.END}")
                resultados["failed"] += 1
                resultados["errors"].append(f"Custom keyword '{keyword}' no detectado")
    else:
        print(f"  {Colors.YELLOW}⚠ No hay custom keywords configurados{Colors.END}")
    
    # ========================================
    # TEST 3: Falsos positivos (no debe activar)
    # ========================================
    print(f"\n{Colors.BOLD}{Colors.CYAN}--- TEST 3: Falsos Positivos (NO debe activar) ---{Colors.END}")
    
    mensajes_normales = [
        "Hola buenos días",
        "Quiero información",
        "Cuáles son los precios?",
        "Gracias por la información",
        "Me interesa el servicio",
        "Tienen disponibilidad mañana?",
    ]
    
    for msg in mensajes_normales:
        result = detectar_trigger_modo_humano(msg, "")
        
        if not result:
            print(f"  {Colors.GREEN}✅ \"{msg}\" -> normal (correcto){Colors.END}")
            resultados["passed"] += 1
        else:
            print(f"  {Colors.RED}❌ \"{msg}\" -> TRIGGER (falso positivo!){Colors.END}")
            resultados["failed"] += 1
            resultados["errors"].append(f"Falso positivo en: '{msg}'")
    
    # ========================================
    # RESUMEN
    # ========================================
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*70}")
    print("RESUMEN")
    print(f"{'='*70}{Colors.END}")
    
    total = resultados["passed"] + resultados["failed"]
    pct = (resultados["passed"] / total * 100) if total > 0 else 0
    
    print(f"\n  Tests pasados: {resultados['passed']}/{total} ({pct:.0f}%)")
    print(f"  Tests fallidos: {resultados['failed']}")
    
    if resultados["errors"]:
        print(f"\n{Colors.BOLD}{Colors.RED}Errores encontrados:{Colors.END}")
        for err in resultados["errors"]:
            print(f"  • {err}")
    
    # Veredicto
    if pct >= 95:
        print(f"\n{Colors.GREEN}{Colors.BOLD}✅ EXCELENTE - Sistema de triggers funcionando correctamente{Colors.END}")
    elif pct >= 80:
        print(f"\n{Colors.YELLOW}{Colors.BOLD}⚠️ ACEPTABLE - Algunos triggers pueden necesitar ajuste{Colors.END}")
    else:
        print(f"\n{Colors.RED}{Colors.BOLD}❌ REVISAR - Hay problemas con la detección de triggers{Colors.END}")
    
    # Instrucciones
    print(f"\n{Colors.BOLD}Para agregar nuevos triggers:{Colors.END}")
    print("  1. Ve al frontend -> Agente -> Modo Humano")
    print("  2. Agrega keywords en 'Triggers personalizados'")
    print("  3. Guarda y ejecuta este test de nuevo")
    print(f"  4. Comando: {Colors.CYAN}docker compose exec api python tests/test_triggers_dinamico.py{Colors.END}")
    
    return resultados["failed"] == 0

if __name__ == "__main__":
    success = run_dynamic_test()
    sys.exit(0 if success else 1)
