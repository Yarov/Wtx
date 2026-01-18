"""
Script de inicialización de la base de datos PostgreSQL.
Crea todas las tablas y datos por defecto.
"""
from models import Base, engine, SessionLocal
from models import (
    Cita, Inventario, Memoria, Disponibilidad, 
    HorarioBloqueado, Pago, Configuracion, ToolsConfig
)


def init_database():
    """Crear todas las tablas"""
    print("🔧 Creando tablas...")
    Base.metadata.create_all(bind=engine)
    print("✅ Tablas creadas")


def seed_data():
    """Insertar datos por defecto"""
    db = SessionLocal()
    
    try:
        # Verificar si ya hay datos
        if db.query(Configuracion).first():
            print("ℹ️  Datos ya existen, omitiendo seed")
            return
        
        print("🌱 Insertando datos por defecto...")
        
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
            ("transferir_a_humano", True, "Transferir conversación a atención humana"),
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
        
        # Disponibilidad por defecto (Lunes-Viernes 9-18, Sábado 9-14, Domingo cerrado)
        dias_config = [
            (0, "09:00", "18:00", True),   # Lunes
            (1, "09:00", "18:00", True),   # Martes
            (2, "09:00", "18:00", True),   # Miércoles
            (3, "09:00", "18:00", True),   # Jueves
            (4, "09:00", "18:00", True),   # Viernes
            (5, "09:00", "14:00", True),   # Sábado
            (6, "00:00", "00:00", False),  # Domingo
        ]
        
        for dia_semana, hora_inicio, hora_fin, activo in dias_config:
            db.add(Disponibilidad(
                dia_semana=dia_semana,
                hora_inicio=hora_inicio,
                hora_fin=hora_fin,
                activo=activo
            ))
        
        db.commit()
        print("✅ Datos por defecto insertados")
        
    except Exception as e:
        print(f"❌ Error en seed: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    init_database()
    seed_data()
    print("🚀 Base de datos lista")
