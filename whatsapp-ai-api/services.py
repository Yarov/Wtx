from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models import SessionLocal, Cita, Inventario, Disponibilidad, HorarioBloqueado, Memoria
import json


def get_db():
    return SessionLocal()


class CitasService:
    @staticmethod
    def verificar_disponibilidad(db: Session, fecha: str, hora: str) -> dict:
        """Verificar si una fecha/hora está disponible"""
        try:
            fecha_dt = datetime.strptime(fecha, "%Y-%m-%d")
            dia_semana = fecha_dt.weekday()
            ahora = datetime.now()
            
            # Verificar si es fecha pasada
            if fecha_dt.date() < ahora.date():
                return {"disponible": False, "razon": "No se puede agendar en fechas pasadas"}
            
            # Verificar si es hoy y la hora ya pasó
            if fecha_dt.date() == ahora.date():
                hora_dt = datetime.strptime(hora, "%H:%M")
                hora_completa = fecha_dt.replace(hour=hora_dt.hour, minute=hora_dt.minute)
                if hora_completa <= ahora:
                    return {"disponible": False, "razon": "Este horario ya pasó"}
            
            # Verificar horario del día
            disp = db.query(Disponibilidad).filter(
                Disponibilidad.dia_semana == dia_semana
            ).first()
            
            if not disp or not disp.activo:
                return {"disponible": False, "razon": "Cerrado este día"}
            
            if hora < disp.hora_inicio or hora >= disp.hora_fin:
                return {"disponible": False, "razon": f"Horario: {disp.hora_inicio} - {disp.hora_fin}"}
            
            # Verificar si está bloqueado
            bloqueado = db.query(HorarioBloqueado).filter(
                HorarioBloqueado.fecha == fecha,
                HorarioBloqueado.hora == hora
            ).first()
            
            if bloqueado:
                return {"disponible": False, "razon": bloqueado.motivo or "Horario bloqueado"}
            
            # Verificar si ya hay cita
            cita_existente = db.query(Cita).filter(
                Cita.fecha == fecha,
                Cita.hora == hora,
                Cita.estado != "cancelada"
            ).first()
            
            if cita_existente:
                return {"disponible": False, "razon": "Ya hay una cita en este horario"}
            
            return {"disponible": True}
        except Exception as e:
            return {"disponible": False, "razon": str(e)}
    
    @staticmethod
    def obtener_horarios_disponibles(db: Session, fecha: str) -> list:
        """Obtener horarios disponibles para una fecha"""
        try:
            fecha_dt = datetime.strptime(fecha, "%Y-%m-%d")
            dia_semana = fecha_dt.weekday()
            ahora = datetime.now()
            
            # Si es fecha pasada, no hay horarios disponibles
            if fecha_dt.date() < ahora.date():
                return []
            
            disp = db.query(Disponibilidad).filter(
                Disponibilidad.dia_semana == dia_semana
            ).first()
            
            if not disp or not disp.activo:
                return []
            
            hora_inicio = datetime.strptime(disp.hora_inicio, "%H:%M")
            hora_fin = datetime.strptime(disp.hora_fin, "%H:%M")
            
            # Si es hoy, la hora mínima es la siguiente hora completa
            if fecha_dt.date() == ahora.date():
                hora_minima = ahora.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
                if hora_minima.time() > hora_inicio.time():
                    hora_inicio = hora_minima
            
            # Obtener citas ocupadas
            citas = db.query(Cita.hora).filter(
                Cita.fecha == fecha,
                Cita.estado != "cancelada"
            ).all()
            ocupadas = {c.hora for c in citas}
            
            # Obtener bloqueados
            bloqueados = db.query(HorarioBloqueado.hora).filter(
                HorarioBloqueado.fecha == fecha
            ).all()
            bloqueados_set = {b.hora for b in bloqueados}
            
            horarios = []
            hora_actual = hora_inicio
            while hora_actual < hora_fin:
                hora_str = hora_actual.strftime("%H:%M")
                if hora_str not in ocupadas and hora_str not in bloqueados_set:
                    horarios.append(hora_str)
                hora_actual += timedelta(hours=1)
            
            return horarios
        except:
            return []
    
    @staticmethod
    def agendar(db: Session, telefono: str, fecha: str, servicio: str) -> str:
        """Agendar una cita"""
        try:
            if "T" in fecha:
                fecha_dt = datetime.fromisoformat(fecha.replace("Z", ""))
                fecha_str = fecha_dt.strftime("%Y-%m-%d")
                hora_str = fecha_dt.strftime("%H:%M")
            else:
                fecha_str = fecha
                hora_str = "10:00"
        except:
            return "❌ Formato de fecha inválido. Usa: YYYY-MM-DD o YYYY-MM-DDTHH:MM"
        
        # Verificar disponibilidad
        disp = CitasService.verificar_disponibilidad(db, fecha_str, hora_str)
        if not disp["disponible"]:
            horarios = CitasService.obtener_horarios_disponibles(db, fecha_str)
            if horarios:
                return f"❌ {disp['razon']}. Horarios disponibles: {', '.join(horarios[:5])}"
            return f"❌ {disp['razon']}"
        
        cita = Cita(
            telefono=telefono,
            fecha=fecha_str,
            hora=hora_str,
            servicio=servicio,
            estado="confirmada"
        )
        db.add(cita)
        db.commit()
        
        return f"✅ Cita agendada: {servicio} el {fecha_str} a las {hora_str}"
    
    @staticmethod
    def ver_citas(db: Session, telefono: str) -> list:
        """Ver citas del usuario"""
        citas = db.query(Cita).filter(
            Cita.telefono == telefono,
            Cita.estado != "cancelada"
        ).order_by(Cita.fecha, Cita.hora).all()
        
        return [c.to_dict() for c in citas]
    
    @staticmethod
    def cancelar(db: Session, telefono: str, fecha: str = "", cita_id: int = None) -> str:
        """Cancelar una cita"""
        query = db.query(Cita).filter(
            Cita.telefono == telefono,
            Cita.estado != "cancelada"
        )
        
        if cita_id:
            query = query.filter(Cita.id == cita_id)
        elif fecha:
            if "T" in fecha:
                fecha_dt = datetime.fromisoformat(fecha.replace("Z", ""))
                query = query.filter(
                    Cita.fecha == fecha_dt.strftime("%Y-%m-%d"),
                    Cita.hora == fecha_dt.strftime("%H:%M")
                )
            else:
                query = query.filter(Cita.fecha == fecha)
        
        cita = query.order_by(Cita.fecha, Cita.hora).first()
        
        if not cita:
            return "❌ No encontré ninguna cita para cancelar. ¿Puedes indicarme la fecha?"
        
        cita.estado = "cancelada"
        db.commit()
        
        return f"✅ Cita cancelada: {cita.servicio} del {cita.fecha} a las {cita.hora}"
    
    @staticmethod
    def modificar(db: Session, telefono: str, fecha: str = "", nuevo_servicio: str = "", 
                  agregar_servicio: str = "", nueva_fecha: str = "", nueva_hora: str = "", 
                  cita_id: int = None) -> str:
        """Modificar una cita"""
        query = db.query(Cita).filter(
            Cita.telefono == telefono,
            Cita.estado != "cancelada"
        )
        
        if cita_id:
            query = query.filter(Cita.id == cita_id)
        elif fecha:
            if "T" in fecha:
                fecha_dt = datetime.fromisoformat(fecha.replace("Z", ""))
                query = query.filter(
                    Cita.fecha == fecha_dt.strftime("%Y-%m-%d"),
                    Cita.hora == fecha_dt.strftime("%H:%M")
                )
            else:
                query = query.filter(Cita.fecha == fecha)
        
        cita = query.order_by(Cita.fecha, Cita.hora).first()
        
        if not cita:
            return "❌ No encontré ninguna cita para modificar. ¿Puedes indicarme la fecha?"
        
        cambios = []
        
        # Cambiar fecha/hora
        if nueva_fecha or nueva_hora:
            if nueva_fecha:
                if "T" in nueva_fecha:
                    nf_dt = datetime.fromisoformat(nueva_fecha.replace("Z", ""))
                    nueva_fecha_str = nf_dt.strftime("%Y-%m-%d")
                    if not nueva_hora:
                        nueva_hora = nf_dt.strftime("%H:%M")
                else:
                    nueva_fecha_str = nueva_fecha
            else:
                nueva_fecha_str = cita.fecha
            
            nueva_hora_str = nueva_hora if nueva_hora else cita.hora
            
            # Verificar disponibilidad
            disp = CitasService.verificar_disponibilidad(db, nueva_fecha_str, nueva_hora_str)
            if not disp["disponible"]:
                horarios = CitasService.obtener_horarios_disponibles(db, nueva_fecha_str)
                if horarios:
                    return f"❌ {disp['razon']}. Horarios disponibles: {', '.join(horarios[:5])}"
                return f"❌ {disp['razon']}"
            
            cita.fecha = nueva_fecha_str
            cita.hora = nueva_hora_str
            cambios.append(f"reagendada para {nueva_fecha_str} a las {nueva_hora_str}")
        
        # Agregar servicio
        if agregar_servicio:
            cita.servicio = f"{cita.servicio} + {agregar_servicio}"
            cambios.append(f"servicios: {cita.servicio}")
        elif nuevo_servicio:
            cita.servicio = nuevo_servicio
            cambios.append(f"servicio: {nuevo_servicio}")
        
        if cambios:
            db.commit()
            return f"✅ Cita modificada: {', '.join(cambios)}. Tu cita: {cita.servicio} el {cita.fecha} a las {cita.hora}"
        
        return "❌ Indica qué quieres modificar: fecha, hora, o servicio"


class InventarioService:
    @staticmethod
    def consultar(db: Session) -> list:
        """Consultar productos disponibles"""
        productos = db.query(Inventario).all()
        return [{"producto": p.producto, "stock": p.stock, "precio": p.precio} for p in productos]


class MemoriaService:
    @staticmethod
    def obtener(db: Session, telefono: str) -> list:
        """Obtener historial de conversación"""
        memoria = db.query(Memoria).filter(Memoria.telefono == telefono).first()
        if memoria and memoria.historial:
            return json.loads(memoria.historial)
        return []
    
    @staticmethod
    def guardar(db: Session, telefono: str, historial: str) -> str:
        """Guardar historial de conversación"""
        memoria = db.query(Memoria).filter(Memoria.telefono == telefono).first()
        if memoria:
            memoria.historial = historial
            memoria.updated_at = datetime.utcnow()
        else:
            memoria = Memoria(telefono=telefono, historial=historial)
            db.add(memoria)
        db.commit()
        return "ok"
