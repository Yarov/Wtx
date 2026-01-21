"""
Test completo del flujo del agente:
1. Guardado de prompt (manual y secciones)
2. Detección de triggers de modo humano
3. Formato de respuestas
4. Coherencia del flujo
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_config, set_config
import json


def test_prompt_save():
    """Test 1: Verificar que el prompt se guarda correctamente"""
    print("\n=== TEST 1: Guardado de Prompt ===")
    
    # Simular guardado de prompt manual
    test_prompt = """Eres la asistente virtual de Element Spa.

## INSTRUCCIONES
- Ofrece SOLO servicios, NO productos
- Responde con saltos de línea para mejor lectura
- Si piden FOTO, activa modo humano
- Sé cálida y profesional

## SERVICIOS
1. Masaje Relajante - $500
2. Facial Express - $400"""
    
    set_config("system_prompt", test_prompt)
    set_config("prompt_edit_mode", "manual")
    set_config("manual_prompt", test_prompt)
    
    # Verificar
    saved = get_config("system_prompt", "")
    assert len(saved) > 100, f"Prompt no guardado correctamente. Len: {len(saved)}"
    assert "Element Spa" in saved, "Contenido del prompt incorrecto"
    print(f"✅ Prompt guardado: {len(saved)} chars")
    print(f"   Preview: {saved[:100]}...")
    return True


def test_triggers_config():
    """Test 2: Configurar y verificar triggers"""
    print("\n=== TEST 2: Configuración de Triggers ===")
    
    # Configurar triggers
    triggers = ["frustration", "complaint", "human_request"]
    custom_triggers = "foto,fotografía,imagen,quiero ver"
    
    set_config("human_mode_triggers", json.dumps(triggers))
    set_config("human_mode_custom_triggers", custom_triggers)
    
    # Verificar
    saved_triggers = get_config("human_mode_triggers", "[]")
    saved_custom = get_config("human_mode_custom_triggers", "")
    
    assert "frustration" in saved_triggers, "Triggers no guardados"
    assert "foto" in saved_custom, "Custom triggers no guardados"
    print(f"✅ Triggers: {saved_triggers}")
    print(f"✅ Custom: {saved_custom}")
    return True


def test_trigger_detection():
    """Test 3: Detección de triggers"""
    print("\n=== TEST 3: Detección de Triggers ===")
    
    # Importar función de detección
    from api.routers.webhook import detectar_trigger_modo_humano
    
    test_cases = [
        ("Hola, quiero información", "", False, "Mensaje normal"),
        ("Estoy muy molesto con el servicio", "", True, "Frustración"),
        ("Quiero hablar con alguien real", "", True, "Solicitud humano"),
        ("Me pueden mandar una foto?", "", True, "Palabra: foto"),
        ("Quiero ver una imagen del lugar", "", True, "Palabra: imagen"),
        ("Dame información de precios", "", False, "Consulta normal"),
        ("Esto es inaceptable, exijo hablar con el gerente", "", True, "Queja + solicitud"),
    ]
    
    passed = 0
    for mensaje, respuesta, expected, desc in test_cases:
        result = detectar_trigger_modo_humano(mensaje, respuesta)
        status = "✅" if result == expected else "❌"
        print(f"  {status} {desc}: '{mensaje[:40]}...' -> {result} (expected: {expected})")
        if result == expected:
            passed += 1
    
    print(f"\n  Resultado: {passed}/{len(test_cases)} tests pasados")
    return passed == len(test_cases)


def test_agent_response():
    """Test 4: Respuesta del agente"""
    print("\n=== TEST 4: Respuesta del Agente ===")
    
    from agent import responder
    
    # Test con mensaje simple
    telefono_test = "+521234567890"
    mensaje = "Hola, quiero información"
    
    try:
        respuesta = responder(mensaje, telefono_test)
        print(f"  Mensaje: {mensaje}")
        print(f"  Respuesta ({len(respuesta)} chars):")
        print(f"  ---")
        print(f"  {respuesta[:300]}...")
        print(f"  ---")
        
        # Verificar que tiene contenido
        assert len(respuesta) > 20, "Respuesta muy corta"
        print("✅ Agente respondió correctamente")
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_response_format():
    """Test 5: Formato de respuesta (saltos de línea)"""
    print("\n=== TEST 5: Formato de Respuesta ===")
    
    from agent import responder
    
    telefono_test = "+521234567891"
    mensaje = "Qué servicios tienen disponibles?"
    
    try:
        respuesta = responder(mensaje, telefono_test)
        
        # Verificar saltos de línea
        has_newlines = "\n" in respuesta
        line_count = respuesta.count("\n") + 1
        
        print(f"  Tiene saltos de línea: {has_newlines}")
        print(f"  Número de líneas: {line_count}")
        print(f"  Preview formateado:")
        for i, line in enumerate(respuesta.split("\n")[:5]):
            print(f"    {i+1}. {line[:60]}...")
        
        if not has_newlines:
            print("⚠️ La respuesta no tiene saltos de línea - revisar prompt")
        else:
            print("✅ Respuesta con formato correcto")
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def run_all_tests():
    """Ejecutar todos los tests"""
    print("=" * 60)
    print("TESTS DE FLUJO DEL AGENTE")
    print("=" * 60)
    
    results = []
    
    results.append(("Guardado de Prompt", test_prompt_save()))
    results.append(("Configuración de Triggers", test_triggers_config()))
    results.append(("Detección de Triggers", test_trigger_detection()))
    results.append(("Respuesta del Agente", test_agent_response()))
    results.append(("Formato de Respuesta", test_response_format()))
    
    print("\n" + "=" * 60)
    print("RESUMEN")
    print("=" * 60)
    
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {status}: {name}")
    
    total_passed = sum(1 for _, p in results if p)
    print(f"\nTotal: {total_passed}/{len(results)} tests pasados")
    
    return all(p for _, p in results)


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
