import os
import json
from openai import OpenAI
from dotenv import load_dotenv
from tools import consultar_inventario, agendar_cita, ver_citas, cancelar_cita, modificar_cita, generar_pago, guardar_memoria, obtener_memoria
from database import get_config, is_tool_enabled

load_dotenv()


def get_openai_client():
    """Obtener cliente OpenAI con API key de config o env"""
    api_key = get_config("openai_api_key") or os.getenv("OPENAI_API_KEY")
    return OpenAI(api_key=api_key)


def get_enabled_tools() -> list:
    """Obtener tools habilitados desde la configuración de la app"""
    all_tools = [
        {
            "id": "consultar_inventario",
            "definition": {
                "type": "function",
                "function": {
                    "name": "consultar_inventario",
                    "description": "Consultar servicios y productos disponibles con stock y precios"
                }
            }
        },
        {
            "id": "agendar_cita",
            "definition": {
                "type": "function",
                "function": {
                    "name": "agendar_cita",
                    "description": "Agendar una cita para el cliente",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "fecha": {"type": "string", "description": "Fecha y hora de la cita"},
                            "servicio": {"type": "string", "description": "Nombre del servicio"}
                        },
                        "required": ["fecha", "servicio"]
                    }
                }
            }
        },
        {
            "id": "ver_citas",
            "definition": {
                "type": "function",
                "function": {
                    "name": "ver_citas",
                    "description": "Ver las citas programadas del cliente"
                }
            }
        },
        {
            "id": "generar_pago",
            "definition": {
                "type": "function",
                "function": {
                    "name": "generar_pago",
                    "description": "Generar link de pago para un servicio",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "servicio": {"type": "string", "description": "Nombre del servicio"},
                            "monto": {"type": "number", "description": "Monto a pagar"}
                        },
                        "required": ["servicio", "monto"]
                    }
                }
            }
        },
        {
            "id": "cancelar_cita",
            "definition": {
                "type": "function",
                "function": {
                    "name": "cancelar_cita",
                    "description": "Cancelar una cita existente del cliente",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "fecha": {"type": "string", "description": "Fecha de la cita a cancelar (opcional si solo tiene una)"}
                        }
                    }
                }
            }
        },
        {
            "id": "modificar_cita",
            "definition": {
                "type": "function",
                "function": {
                    "name": "modificar_cita",
                    "description": "Modificar una cita existente: cambiar fecha, hora, agregar servicio o cambiar el servicio",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "fecha": {"type": "string", "description": "Fecha de la cita actual a modificar (YYYY-MM-DD)"},
                            "nueva_fecha": {"type": "string", "description": "Nueva fecha para reagendar (YYYY-MM-DD)"},
                            "nueva_hora": {"type": "string", "description": "Nueva hora para reagendar (HH:MM)"},
                            "agregar_servicio": {"type": "string", "description": "Servicio adicional a agregar a la cita"},
                            "nuevo_servicio": {"type": "string", "description": "Nuevo servicio para reemplazar el actual"}
                        }
                    }
                }
            }
        }
    ]
    
    return [t["definition"] for t in all_tools if is_tool_enabled(t["id"])]


def execute_tool(name: str, args: dict, telefono: str):
    """Ejecutar herramienta configurada en la app"""
    if name == "consultar_inventario":
        return consultar_inventario()
    elif name == "agendar_cita":
        args["telefono"] = telefono
        return agendar_cita(**args)
    elif name == "ver_citas":
        return ver_citas(telefono)
    elif name == "cancelar_cita":
        args["telefono"] = telefono
        return cancelar_cita(**args)
    elif name == "modificar_cita":
        args["telefono"] = telefono
        return modificar_cita(**args)
    elif name == "generar_pago":
        args["telefono"] = telefono
        return generar_pago(**args)
    else:
        return {"error": "Función no encontrada"}


def responder(mensaje: str, telefono: str) -> str:
    """Responder usando configuración de la app (prompt, tools, modelo)"""
    from datetime import datetime
    
    client = get_openai_client()
    historial = obtener_memoria(telefono)
    
    system_prompt = get_config("system_prompt", "Eres un asistente útil.")
    model = get_config("model", "gpt-4o-mini")
    temperature = float(get_config("temperature", "0.7"))
    max_tokens = int(get_config("max_tokens", "500"))
    tools = get_enabled_tools()
    
    # Agregar fecha y hora actual al prompt
    ahora = datetime.now()
    fecha_info = f"\n\nFecha y hora actual: {ahora.strftime('%Y-%m-%d %H:%M')} ({ahora.strftime('%A')}). Usa esta fecha como referencia para 'hoy', 'mañana', etc."
    
    messages = [{"role": "system", "content": system_prompt + fecha_info}]
    messages.extend(historial)
    messages.append({"role": "user", "content": mensaje})

    call_params = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    
    if tools:
        call_params["tools"] = tools
        call_params["tool_choice"] = "auto"

    response = client.chat.completions.create(**call_params)
    msg = response.choices[0].message

    if msg.tool_calls:
        tool_results = []
        
        for tool_call in msg.tool_calls:
            name = tool_call.function.name
            args = json.loads(tool_call.function.arguments) if tool_call.function.arguments else {}
            result = execute_tool(name, args, telefono)
            tool_results.append({
                "tool_call_id": tool_call.id,
                "role": "tool",
                "content": json.dumps(result, ensure_ascii=False)
            })

        messages.append(msg)
        messages.extend(tool_results)

        final_response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        respuesta = final_response.choices[0].message.content
    else:
        respuesta = msg.content

    historial.append({"role": "user", "content": mensaje})
    historial.append({"role": "assistant", "content": respuesta})
    
    if len(historial) > 20:
        historial = historial[-20:]
    
    guardar_memoria(telefono, json.dumps(historial, ensure_ascii=False))

    return respuesta
