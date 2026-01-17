"""
Config schemas - Pydantic models for validation
"""
from pydantic import BaseModel
from typing import Optional


class ApiKeysModel(BaseModel):
    openai_api_key: Optional[str] = ""
    twilio_account_sid: Optional[str] = ""
    twilio_auth_token: Optional[str] = ""
    twilio_phone_number: Optional[str] = ""


class PromptModel(BaseModel):
    system_prompt: Optional[str] = ""
    prompt_sections: Optional[dict] = None
    model: Optional[str] = "gpt-4o-mini"
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 500
    business_name: Optional[str] = ""
    business_type: Optional[str] = ""


class ImprovePromptModel(BaseModel):
    section: str
    current_content: Optional[str] = ""
    business_name: Optional[str] = ""
    business_type: Optional[str] = ""
    all_sections: Optional[dict] = None


class PaymentConfigModel(BaseModel):
    payment_provider: Optional[str] = "none"
    stripe_secret_key: Optional[str] = ""
    mercadopago_access_token: Optional[str] = ""
    payment_currency: Optional[str] = "MXN"
