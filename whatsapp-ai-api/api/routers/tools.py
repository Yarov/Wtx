"""
Tools router
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from database import get_all_tools_config, set_tool_enabled
from models import Usuario
from auth import get_current_user

router = APIRouter(prefix="/tools", tags=["tools"])


class ToolToggle(BaseModel):
    enabled: bool


@router.get("/")
async def get_tools(current_user: Usuario = Depends(get_current_user)):
    """Get all tools configuration"""
    tools = get_all_tools_config()
    return [
        {"id": t["nombre"], "enabled": t["habilitado"], "description": t["descripcion"]}
        for t in tools
    ]


@router.patch("/{name}")
async def toggle_tool(name: str, data: ToolToggle, current_user: Usuario = Depends(get_current_user)):
    """Enable/disable a tool"""
    set_tool_enabled(name, data.enabled)
    return {"status": "ok"}
