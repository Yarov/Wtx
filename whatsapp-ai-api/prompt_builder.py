"""
prompt_builder - Builds focused prompts for GPT based on skill results.

Instead of one giant system prompt with ALL instructions (see agent.py build_system_prompt),
we build a FOCUSED prompt that tells GPT exactly what happened and what to say.

Structure:
  [IDENTITY]        - Who you are (short, from config)
  [CONTEXT]         - What you know about this client
  [SKILL RESULT]    - What just happened (from skill execution)
  [DIRECTIVE]       - What to say/do now (from funnel step + skill)
  [RULES]           - Brief behavior rules

This module does NOT import OpenAI or make API calls.
It only builds the messages list; the actual OpenAI call happens in responder().
"""

import json
import logging
from database import get_config

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 1. Identity
# ---------------------------------------------------------------------------

def build_identity(db, usuario_id: int) -> str:
    """Extract short identity block from config.

    Pulls agent_name, business_name, role section (from prompt_sections or
    manual_prompt), and agent_products. Kept deliberately brief.
    """
    uid = usuario_id
    agent_name = get_config("agent_name", "Asistente", usuario_id=uid)
    business_name = get_config("business_name", "Mi Negocio", usuario_id=uid)

    # Role from prompt config
    edit_mode = get_config("prompt_edit_mode", "sections", usuario_id=uid)
    role = ""
    if edit_mode == "manual":
        role = get_config("manual_prompt", "", usuario_id=uid)
    else:
        sections_str = get_config("prompt_sections", "", usuario_id=uid)
        try:
            sections = json.loads(sections_str) if sections_str else {}
        except (json.JSONDecodeError, TypeError):
            sections = {}
        role = sections.get("role", "")

    parts = []
    identity_line = f"Eres {agent_name}"
    if business_name and business_name != "Mi Negocio":
        identity_line += f", asistente de {business_name}"
    identity_line += "."
    parts.append(identity_line)

    if role:
        parts.append(role)

    # Products / services (short reference)
    agent_products = get_config("agent_products", "", usuario_id=uid)
    if agent_products:
        parts.append(f"Ofrecemos: {agent_products}")

    return "\n".join(parts)


# ---------------------------------------------------------------------------
# 2. Client context
# ---------------------------------------------------------------------------

def build_client_context(context: dict) -> str:
    """Build a short summary of what we know about this client.

    Expects keys in *context*:
        client_name, lead_score, lead_state, funnel_step,
        captured_data (dict), message_count
    All keys are optional.
    """
    parts = []

    # Name + pending fields
    client_name = context.get("client_name") or "Desconocido"
    pending = context.get("pending_fields") or []
    name_part = f"Cliente: {client_name}"
    if pending:
        name_part += f" ({', '.join(pending)} pendiente(s))"
    parts.append(name_part + ".")

    # Lead score & state
    lead_score = context.get("lead_score")
    lead_state = context.get("lead_state")
    if lead_score is not None or lead_state:
        score_str = ""
        if lead_score is not None:
            score_str = f"Lead score: {lead_score}"
        if lead_state:
            score_str += f" ({lead_state})" if score_str else f"Estado: {lead_state}"
        parts.append(score_str + ".")

    # Funnel step
    funnel_step = context.get("funnel_step")
    if funnel_step:
        parts.append(f"Paso actual: {funnel_step}.")

    # Captured data summary
    captured = context.get("captured_data")
    if captured and isinstance(captured, dict):
        items = [f"{k}: {v}" for k, v in captured.items() if v]
        if items:
            parts.append(f"Datos capturados: {', '.join(items)}.")

    # Message count
    msg_count = context.get("message_count")
    if msg_count is not None:
        parts.append(f"Mensajes: {msg_count}.")

    return " ".join(parts)


# ---------------------------------------------------------------------------
# 3. Skill directive
# ---------------------------------------------------------------------------

def build_skill_directive(skill_result: dict, context: dict) -> str:
    """Build a directive string based on what the skill did.

    *skill_result* should contain at least a ``skill`` key identifying the
    skill type, plus skill-specific data.

    Supported skill types:
        capture, human_handoff, faq, free_chat
    """
    if not skill_result:
        return ""

    skill = skill_result.get("skill", "")

    # --- data captured ---
    if skill == "capture":
        captured_fields = skill_result.get("captured", [])
        pending_fields = skill_result.get("pending", [])
        parts = []
        if captured_fields:
            parts.append(f"Capturaste: {', '.join(captured_fields)}.")
        if pending_fields:
            parts.append(f"Campos pendientes: {', '.join(pending_fields)}.")
        return " ".join(parts)

    # --- human handoff ---
    if skill == "human_handoff":
        return (
            "El cliente sera transferido a un humano. "
            "Despidete amablemente e informa que un agente lo atendera pronto."
        )

    # --- faq / knowledge ---
    if skill == "faq":
        content = skill_result.get("content", "")
        if content:
            return (
                f"Informacion encontrada:\n{content}\n\n"
                "Responde basandote en esta informacion."
            )
        return "No se encontro informacion relevante. Indica que no tienes esa informacion."

    # --- free_chat ---
    if skill == "free_chat":
        return ""

    # Unknown skill — no directive
    return ""


# ---------------------------------------------------------------------------
# 4. Rules
# ---------------------------------------------------------------------------

def build_rules(context: dict) -> str:
    """Brief behavior rules. Adapts based on skill result and disabled skills."""
    rules = [
        "Responde en espanol, conciso y natural.",
        "No inventes informacion.",
        "No uses markdown de imagenes ![](url).",
    ]

    # Pending capture fields
    pending = context.get("pending_fields")
    if pending:
        rules.append(
            f"Intenta obtener {', '.join(pending)} de forma natural en la conversacion."
        )

    # Custom instructions from config
    custom = context.get("custom_instructions")
    if custom:
        rules.append(custom)

    return "Reglas:\n" + "\n".join(f"- {r}" for r in rules)


# ---------------------------------------------------------------------------
# 5. Focused prompt assembler
# ---------------------------------------------------------------------------

def build_focused_prompt(db, context: dict, skill_result: dict) -> list:
    """Build focused messages for GPT -- NO tools needed.

    Parameters
    ----------
    db : SQLAlchemy session
    context : dict
        Must contain ``usuario_id`` and ``historial`` (list of message dicts).
        May contain: client_name, lead_score, lead_state, funnel_step,
        captured_data, pending_fields, message_count,
        funnel_instruction, knowledge_context, custom_instructions,
        skill_result.
    skill_result : dict
        Output from a skill execution. Contains at least ``skill`` key.

    Returns
    -------
    list[dict]
        Messages list ready for OpenAI chat completions API.
    """
    usuario_id = context["usuario_id"]

    identity = build_identity(db, usuario_id)
    client_ctx = build_client_context(context)
    directive = build_skill_directive(skill_result, context)

    # Funnel instruction (if any) -- highest priority
    funnel_inst = context.get("funnel_instruction", "")
    if funnel_inst:
        funnel_inst = (
            ">>> DIRECTIVA PRINCIPAL <<<\n"
            f"{funnel_inst}\n"
            "Sigue esta directiva por encima de todo."
        )

    # Knowledge context — always available for reference
    knowledge = context.get("knowledge_context", "")

    # Store skill_result in context for build_rules
    context_with_skill = {**context, "skill_result": skill_result}
    rules = build_rules(context_with_skill)

    system_content = "\n\n".join(
        part for part in [
            identity,
            knowledge,
            client_ctx,
            directive,
            funnel_inst,
            rules,
        ]
        if part
    )

    messages = [{"role": "system", "content": system_content}]
    messages.extend(context.get("historial", []))

    return messages
