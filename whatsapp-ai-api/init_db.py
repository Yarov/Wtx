"""
Script de inicialización de la base de datos PostgreSQL.
Crea todas las tablas y datos por defecto.
"""
from models import Base, get_engine, SessionLocal
from models import (
    Configuracion, ToolsConfig
)


def init_database():
    """Crear todas las tablas"""
    print("Creando tablas...")
    Base.metadata.create_all(bind=get_engine())
    print("Tablas creadas")


def seed_data():
    """Insertar datos por defecto"""
    db = SessionLocal()
    
    try:
        # Verificar si ya hay datos
        if db.query(Configuracion).first():
            print("Datos ya existen, omitiendo seed")
            return
        
        print("Insertando datos por defecto...")
        
        # Configuración por defecto
        default_config = [
            ("system_prompt", """Eres un asistente de WhatsApp profesional.
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
            ("transferir_a_humano", True, "Transferir conversación a atención humana"),
        ]

        for nombre, habilitado, descripcion in default_tools:
            db.add(ToolsConfig(nombre=nombre, habilitado=habilitado, descripcion=descripcion))

        db.commit()
        print("Datos por defecto insertados")
        
    except Exception as e:
        print(f"Error en seed: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    init_database()
    seed_data()
    print("Base de datos lista")
