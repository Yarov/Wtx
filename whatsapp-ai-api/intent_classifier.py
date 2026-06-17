"""
Intent Classifier — 3-level message classification for WhatsApp messages.

Classifies incoming messages into skill intents deterministically before
invoking the AI agent. Levels (cheapest first):
  1. Keyword matching (free, instant)
  2. Funnel context (free, instant)
  3. Mini AI classifier (~50 tokens, only when ambiguous)
"""

import os
import json
import logging
import unicodedata
from typing import Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# ─── Result dataclass ──────────────────────────────────────────────────────


@dataclass
class IntentResult:
    primary: str  # main skill: "appointment", "catalog", "human_handoff", etc.
    secondary: str | None = None  # additional skill (e.g. "data_capture" from funnel)
    confidence: str = "keyword"  # "keyword", "funnel", "ai", "default"
    matched_keywords: list = field(default_factory=list)  # for debugging


# ─── Skill keyword registry ───────────────────────────────────────────────
# Multi-word phrases are checked BEFORE single words so that "cancelar cita"
# matches cancel_appointment instead of appointment.
#
# To add a new skill, append an entry here — no other code changes needed
# for level-1 classification.

SKILL_KEYWORDS: dict[str, list[str]] = {
    "human_handoff": [
        "hablar con humano",
        "persona real",
        "hablar con alguien",
        "quiero hablar con",
        "asesor",
        "agente real",
        "representante",
    ],
    "faq": [
        "horario de atencion",
        "donde estan",
        "direccion",
        "ubicacion",
        "estacionamiento",
        "formas de pago",
        "politica",
    ],
}

# Pre-sort each skill's keywords so multi-word phrases are tried first.
# Longer phrases are more specific and should take priority.
for _skill in SKILL_KEYWORDS:
    SKILL_KEYWORDS[_skill].sort(key=lambda kw: -len(kw))


# ─── Helpers ───────────────────────────────────────────────────────────────


def _normalize(text: str) -> str:
    """Remove accents and lowercase for flexible matching.

    Uses NFD decomposition to strip combining characters (accents),
    so "cómo estás" becomes "como estas".
    """
    nfkd = unicodedata.normalize("NFKD", text.lower())
    return "".join(ch for ch in nfkd if not unicodedata.combining(ch))


# ─── Level 1: Keyword matching ────────────────────────────────────────────


def classify_by_human_triggers(
    message: str, usuario_id: int = 1, perfil_id: int = None
) -> IntentResult | None:
    """Level 0: Check user-configured human mode triggers FIRST.

    These are the highest priority — if the user configured "agendar" as a
    human trigger, it takes precedence over the appointment skill.

    Loads triggers from DB config (same as HumanModeTab in frontend).
    """
    from database import get_config
    import json

    normalized = _normalize(message)

    # Load configured trigger categories
    triggers_str = get_config("human_mode_triggers", '["frustration","complaint","human_request"]', usuario_id=usuario_id, perfil_id=perfil_id)
    try:
        active_categories = json.loads(triggers_str) if triggers_str else []
    except (json.JSONDecodeError, TypeError):
        active_categories = []

    # Check hardcoded keywords for active categories
    if "human_handoff" in SKILL_KEYWORDS:
        for kw in SKILL_KEYWORDS["human_handoff"]:
            if _normalize(kw) in normalized:
                logger.info("Human trigger (built-in keyword): '%s'", kw)
                return IntentResult(
                    primary="human_handoff",
                    confidence="keyword",
                    matched_keywords=[kw],
                )

    # Check custom triggers from config
    custom_str = get_config("human_mode_custom_triggers", "", usuario_id=usuario_id, perfil_id=perfil_id)
    if custom_str:
        custom_triggers = [t.strip() for t in custom_str.split(",") if t.strip()]

        # First pass: exact keyword match (fast, free)
        for trigger in custom_triggers:
            if _normalize(trigger) in normalized:
                logger.info("Human trigger (custom keyword): '%s'", trigger)
                return IntentResult(
                    primary="human_handoff",
                    confidence="keyword",
                    matched_keywords=[trigger],
                )

        # Second pass: AI intent match for descriptive triggers
        # e.g. "cuando el usuario quiera agendar" → checks if message MEANS that
        descriptive_triggers = [t for t in custom_triggers if len(t.split()) > 2]
        if descriptive_triggers:
            match = _match_triggers_by_ai(message, descriptive_triggers, usuario_id)
            if match:
                logger.info("Human trigger (AI intent match): '%s'", match)
                return IntentResult(
                    primary="human_handoff",
                    confidence="ai",
                    matched_keywords=[match],
                )

    return None


def _match_triggers_by_ai(message: str, triggers: list[str], usuario_id: int) -> str | None:
    """Use mini-AI to check if message matches any descriptive trigger intent.
    Returns the matched trigger string or None.
    """
    try:
        from agent import get_openai_client

        client = get_openai_client(usuario_id)
        triggers_list = "\n".join(f"- {t}" for t in triggers)

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Evalua si el mensaje del cliente coincide con alguna de estas intenciones.\n"
                        f"Intenciones:\n{triggers_list}\n\n"
                        "Si el mensaje coincide con alguna, responde SOLO con el texto exacto de la intencion.\n"
                        "Si no coincide con ninguna, responde SOLO: NO"
                    ),
                },
                {"role": "user", "content": message},
            ],
            temperature=0,
            max_tokens=50,
        )

        result = response.choices[0].message.content.strip()
        if result.upper() == "NO":
            return None

        # Validate that the response is one of the triggers
        for trigger in triggers:
            if _normalize(trigger) in _normalize(result) or _normalize(result) in _normalize(trigger):
                return trigger

        return None

    except Exception as e:
        logger.error("AI trigger matching failed: %s", e)
        return None


def classify_by_keywords(
    message: str, enabled_skills: list[str]
) -> IntentResult | None:
    """Level 1: Fast keyword matching against SKILL_KEYWORDS.

    Only checks ENABLED skills. Disabled skills are simply skipped.
    human_handoff is handled separately in Level 0.
    """
    normalized = _normalize(message)
    best_skill: str | None = None
    best_length: int = 0
    matched: list[str] = []

    for skill in SKILL_KEYWORDS:
        # Skip human_handoff (handled in Level 0) and disabled skills
        if skill == "human_handoff":
            continue
        if skill not in enabled_skills:
            continue

        for keyword in SKILL_KEYWORDS[skill]:
            norm_kw = _normalize(keyword)
            if norm_kw in normalized:
                matched.append(keyword)
                if len(norm_kw) > best_length:
                    best_length = len(norm_kw)
                    best_skill = skill

    if best_skill:
        logger.info(
            "Intent classified by keyword: %s (matched: %s)",
            best_skill,
            matched,
        )
        return IntentResult(
            primary=best_skill,
            confidence="keyword",
            matched_keywords=matched,
        )

    return None


# ─── Level 2: Funnel context ──────────────────────────────────────────────


def classify_by_funnel(context: dict) -> str | None:
    """Level 2: Check funnel state for pending data capture.

    If the contact has pending required fields (datos_pendientes),
    returns "data_capture". This is used as a secondary intent.
    """
    datos_pendientes = context.get("datos_pendientes")
    if datos_pendientes and len(datos_pendientes) > 0:
        logger.debug(
            "Funnel context: pending fields %s → data_capture",
            datos_pendientes,
        )
        return "data_capture"
    return None


# ─── Level 3: Mini AI classifier ──────────────────────────────────────────


def classify_by_ai(
    message: str,
    enabled_skills: list[str],
    recent_messages: list,
    usuario_id: int,
) -> str:
    """Level 3: Minimal AI classification (~50 tokens).

    Only called when levels 1 and 2 produce no primary match.
    Uses gpt-4o-mini with a tiny prompt to classify into one skill.
    Returns the skill name string.
    """
    from agent import get_openai_client

    skills_str = ", ".join(enabled_skills + ["free_chat"])

    # Build minimal conversation context (last 2 messages)
    context_lines = ""
    for msg in (recent_messages or [])[-2:]:
        role = msg.get("role", "user")
        text = msg.get("content", "")[:100]
        context_lines += f"{role}: {text}\n"

    system_prompt = (
        "You are a message classifier. Classify the user message into "
        "exactly ONE of these skills: " + skills_str + ".\n"
        "Reply with ONLY the skill name, nothing else."
    )

    user_prompt = ""
    if context_lines:
        user_prompt += f"Recent conversation:\n{context_lines}\n"
    user_prompt += f"New message: {message}"

    try:
        client = get_openai_client(usuario_id)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=10,
            temperature=0,
        )
        skill = response.choices[0].message.content.strip().lower()

        # Validate the returned skill is in our list
        valid_skills = set(enabled_skills + ["free_chat"])
        if skill not in valid_skills:
            logger.warning(
                "AI classifier returned unknown skill '%s', falling back to free_chat",
                skill,
            )
            return "free_chat"

        logger.info("Intent classified by AI: %s", skill)
        return skill

    except Exception as e:
        logger.error("AI classifier failed: %s — falling back to free_chat", e)
        return "free_chat"


# ─── Main classifier ──────────────────────────────────────────────────────


def classify_intent(
    message: str,
    context: dict,
    enabled_skills: list[str],
    usuario_id: int = 1,
) -> IntentResult:
    """Main classifier — tries levels 1, 2, 3 in order.

    Args:
        message: The incoming WhatsApp message text.
        context: Dict with telefono, datos_pendientes, paso_funnel,
                 condiciones_paso, recent_messages, enabled_skills.
        enabled_skills: List of skill names currently enabled for this user.
        usuario_id: User/tenant ID for OpenAI client lookup.

    Returns:
        IntentResult with primary skill, optional secondary, and confidence.
    """
    logger.debug("Classifying intent for message: '%.60s...'", message)

    perfil_id = context.get("perfil_id")

    # Level 0: Human mode triggers — HIGHEST PRIORITY
    # User-configured triggers always win over skills
    human_result = classify_by_human_triggers(message, usuario_id, perfil_id=perfil_id)
    if human_result:
        return human_result

    # Level 1: Keyword matching for enabled skills
    result = classify_by_keywords(message, enabled_skills)

    # Level 2: Funnel context — adds secondary intent
    funnel_intent = classify_by_funnel(context)

    if result:
        if funnel_intent:
            result.secondary = funnel_intent
        return result

    # Level 3: Mini AI classifier (only when no keyword match)
    recent_messages = context.get("recent_messages", [])
    ai_skill = classify_by_ai(message, enabled_skills, recent_messages, usuario_id)

    return IntentResult(
        primary=ai_skill,
        secondary=funnel_intent,
        confidence="ai" if ai_skill != "free_chat" else "default",
        matched_keywords=[],
    )
