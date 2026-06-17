"""
Tools Router - AI agent capabilities management
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from database import get_all_tools_config, set_tool_enabled
from models import SessionLocal, ToolsConfig, Usuario
from auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/tools",
    tags=["AI Tools"],
    responses={401: {"description": "Not authenticated"}}
)


class ToolToggle(BaseModel):
    enabled: bool


@router.get("", summary="List AI tools", description="Get all available AI agent tools/functions with their enabled status.")
async def get_tools(current_user: Usuario = Depends(get_current_user)):
    try:
        tools = get_all_tools_config(usuario_id=current_user.id)
        return [
            {"id": t["nombre"], "enabled": t["habilitado"], "description": t["descripcion"]}
            for t in tools
        ]
    except Exception as e:
        logger.error(f"Error listing tools: {e}")
        raise HTTPException(status_code=500, detail="Error loading tools")


@router.get("/{name}", summary="Get tool details", description="Get details and status of a specific AI tool.")
async def get_tool(name: str, current_user: Usuario = Depends(get_current_user)):
    db = SessionLocal()
    try:
        tool = db.query(ToolsConfig).filter(
            ToolsConfig.nombre == name,
            ToolsConfig.usuario_id == current_user.id,
        ).first()
        if not tool:
            raise HTTPException(status_code=404, detail=f"Tool '{name}' not found")
        return {
            "id": tool.nombre,
            "enabled": tool.habilitado,
            "description": tool.descripcion,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting tool {name}: {e}")
        raise HTTPException(status_code=500, detail="Error loading tool")
    finally:
        db.close()


@router.put("/{name}", summary="Toggle tool", description="Enable or disable a specific AI tool. Disabled tools won't be available to the agent.")
async def toggle_tool(name: str, data: ToolToggle, current_user: Usuario = Depends(get_current_user)):
    db = SessionLocal()
    try:
        tool = db.query(ToolsConfig).filter(
            ToolsConfig.nombre == name,
            ToolsConfig.usuario_id == current_user.id,
        ).first()
        if not tool:
            tool = ToolsConfig(nombre=name, usuario_id=current_user.id, habilitado=data.enabled)
            db.add(tool)
        else:
            tool.habilitado = data.enabled
        db.commit()
        return {"status": "ok", "id": name, "enabled": data.enabled}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error toggling tool {name}: {e}")
        raise HTTPException(status_code=500, detail="Error updating tool")
    finally:
        db.close()


@router.patch("/{name}", summary="Toggle tool (PATCH)", description="Enable or disable a specific AI tool. Disabled tools won't be available to the agent.")
async def toggle_tool_patch(name: str, data: ToolToggle, current_user: Usuario = Depends(get_current_user)):
    """PATCH alias for backwards compatibility."""
    return await toggle_tool(name, data, current_user)
