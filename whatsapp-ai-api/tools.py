import json
from services import get_db, CitasService, InventarioService, MemoriaService


def consultar_inventario() -> list:
    """Consultar servicios y productos disponibles"""
    db = get_db()
    try:
        return InventarioService.consultar(db)
    finally:
        db.close()


def obtener_horarios_disponibles(fecha: str) -> list:
    """Obtener horarios disponibles para una fecha"""
    db = get_db()
    try:
        return CitasService.obtener_horarios_disponibles(db, fecha)
    finally:
        db.close()


def agendar_cita(telefono: str, fecha: str, servicio: str) -> str:
    """Agendar una cita para un usuario"""
    db = get_db()
    try:
        return CitasService.agendar(db, telefono, fecha, servicio)
    finally:
        db.close()


def ver_citas(telefono: str) -> list:
    """Ver las citas de un usuario"""
    db = get_db()
    try:
        return CitasService.ver_citas(db, telefono)
    finally:
        db.close()


def cancelar_cita(telefono: str, fecha: str = "", cita_id: int = None) -> str:
    """Cancelar una cita del usuario"""
    db = get_db()
    try:
        return CitasService.cancelar(db, telefono, fecha, cita_id)
    finally:
        db.close()


def modificar_cita(telefono: str, fecha: str = "", nuevo_servicio: str = "", agregar_servicio: str = "", 
                   nueva_fecha: str = "", nueva_hora: str = "", cita_id: int = None) -> str:
    """Modificar una cita existente (cambiar fecha, hora, o servicios)"""
    db = get_db()
    try:
        return CitasService.modificar(db, telefono, fecha, nuevo_servicio, agregar_servicio, 
                                       nueva_fecha, nueva_hora, cita_id)
    finally:
        db.close()


def guardar_memoria(telefono: str, historial: str) -> str:
    """Guardar historial de conversación del usuario"""
    db = get_db()
    try:
        return MemoriaService.guardar(db, telefono, historial)
    finally:
        db.close()


def obtener_memoria(telefono: str) -> list:
    """Obtener historial de conversación del usuario"""
    db = get_db()
    try:
        return MemoriaService.obtener(db, telefono)
    finally:
        db.close()


TOOLS_MAP = {
    "consultar_inventario": consultar_inventario,
    "agendar_cita": agendar_cita,
    "ver_citas": ver_citas,
    "cancelar_cita": cancelar_cita,
    "modificar_cita": modificar_cita,
}
