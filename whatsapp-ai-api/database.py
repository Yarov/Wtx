"""
Database module - PostgreSQL con SQLAlchemy
"""
import os
from models import engine, SessionLocal, Base
from models import Configuracion, ToolsConfig, Inventario, Disponibilidad

# Crear tablas al importar
Base.metadata.create_all(bind=engine)


def get_session():
    return SessionLocal()


def get_config(clave: str, default: str = "") -> str:
    """Obtener valor de configuración de la DB"""
    db = SessionLocal()
    try:
        config = db.query(Configuracion).filter(Configuracion.clave == clave).first()
        return config.valor if config else default
    finally:
        db.close()


def set_config(clave: str, valor: str):
    """Guardar valor de configuración en la DB"""
    db = SessionLocal()
    try:
        config = db.query(Configuracion).filter(Configuracion.clave == clave).first()
        if config:
            config.valor = valor
        else:
            db.add(Configuracion(clave=clave, valor=valor))
        db.commit()
    finally:
        db.close()


def get_all_config() -> dict:
    """Obtener toda la configuración"""
    db = SessionLocal()
    try:
        configs = db.query(Configuracion).all()
        return {c.clave: c.valor for c in configs}
    finally:
        db.close()


def is_tool_enabled(nombre: str) -> bool:
    """Verificar si un tool está habilitado"""
    db = SessionLocal()
    try:
        tool = db.query(ToolsConfig).filter(ToolsConfig.nombre == nombre).first()
        return tool.habilitado if tool else True
    finally:
        db.close()


def set_tool_enabled(nombre: str, habilitado: bool):
    """Habilitar/deshabilitar un tool"""
    db = SessionLocal()
    try:
        tool = db.query(ToolsConfig).filter(ToolsConfig.nombre == nombre).first()
        if tool:
            tool.habilitado = habilitado
            db.commit()
    finally:
        db.close()


def get_all_tools_config() -> list:
    """Obtener configuración de todos los tools"""
    db = SessionLocal()
    try:
        tools = db.query(ToolsConfig).all()
        return [{"nombre": t.nombre, "habilitado": t.habilitado, "descripcion": t.descripcion} for t in tools]
    finally:
        db.close()


def init_default_data():
    """Inicializar datos por defecto si no existen"""
    db = SessionLocal()
    try:
        # Verificar si ya hay configuración
        if db.query(Configuracion).first():
            return
        
        # Configuración por defecto
        default_config = [
            ("system_prompt", """Eres un asistente de WhatsApp para una barbería/salón.
Ofreces servicios, agendas citas y consultas inventario.
Responde claro, corto y amable.
Siempre saluda al cliente y ofrece ayuda."""),
            ("model", "gpt-4o-mini"),
            ("temperature", "0.7"),
            ("max_tokens", "500"),
            ("business_name", "Mi Negocio"),
            ("business_type", "barbería"),
        ]
        
        for clave, valor in default_config:
            db.add(Configuracion(clave=clave, valor=valor))
        
        # Tools por defecto
        default_tools = [
            ("consultar_inventario", True, "Consultar servicios y productos disponibles"),
            ("agendar_cita", True, "Agendar citas para clientes"),
            ("ver_citas", True, "Ver citas programadas del cliente"),
            ("cancelar_cita", True, "Cancelar citas existentes"),
            ("modificar_cita", True, "Modificar citas o agregar servicios"),
        ]
        
        for nombre, habilitado, descripcion in default_tools:
            db.add(ToolsConfig(nombre=nombre, habilitado=habilitado, descripcion=descripcion))
        
        # Inventario por defecto
        default_inventory = [
            ("Corte de cabello", 10, 150.0),
            ("Barba", 5, 100.0),
            ("Shampoo premium", 20, 250.0),
        ]
        
        for producto, stock, precio in default_inventory:
            db.add(Inventario(producto=producto, stock=stock, precio=precio))
        
        # Disponibilidad por defecto
        dias_config = [
            (0, "09:00", "18:00", True),
            (1, "09:00", "18:00", True),
            (2, "09:00", "18:00", True),
            (3, "09:00", "18:00", True),
            (4, "09:00", "18:00", True),
            (5, "09:00", "14:00", True),
            (6, "00:00", "00:00", False),
        ]
        
        for dia_semana, hora_inicio, hora_fin, activo in dias_config:
            db.add(Disponibilidad(
                dia_semana=dia_semana,
                hora_inicio=hora_inicio,
                hora_fin=hora_fin,
                activo=activo
            ))
        
        db.commit()
        print("✅ Datos por defecto inicializados")
        
    except Exception as e:
        print(f"Error inicializando datos: {e}")
        db.rollback()
    finally:
        db.close()


# Inicializar datos al importar
init_default_data()
