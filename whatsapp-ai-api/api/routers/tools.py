"""
Tools Router - AI agent capabilities management
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from database import get_all_tools_config, set_tool_enabled
from models import Usuario
from auth import get_current_user

router = APIRouter(
    prefix="/tools", 
    tags=["AI Tools"],
    responses={401: {"description": "Not authenticated"}}
)


class ToolToggle(BaseModel):
    enabled: bool


@router.get("", summary="List AI tools", description="Get all available AI agent tools/functions with their enabled status.")
async def get_tools(current_user: Usuario = Depends(get_current_user)):
    tools = get_all_tools_config()
    return [
        {"id": t["nombre"], "enabled": t["habilitado"], "description": t["descripcion"]}
        for t in tools
    ]


@router.patch("/{name}", summary="Toggle tool", description="Enable or disable a specific AI tool. Disabled tools won't be available to the agent.")
async def toggle_tool(name: str, data: ToolToggle, current_user: Usuario = Depends(get_current_user)):
    set_tool_enabled(name, data.enabled)
    return {"status": "ok"}
