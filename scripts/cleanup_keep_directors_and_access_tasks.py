"""
Limpia la base de datos dejando solo:
- Usuarios que NO son clientes (directores / equipo interno).
- Tareas predeterminadas de la fase "Acceso" y sus asignaciones.

Borra:
- Usuarios con rol CLIENTE y todo lo asociado (Client, tareas, notificaciones, etc.).
- Tareas predeterminadas de otras fases y sus ClientMandatoryTask.
- Usuarios registrados provisoriamente (RegisteredUser).

Ejecutar desde la carpeta backend con el entorno configurado:

  python scripts/cleanup_keep_directors_and_access_tasks.py
"""
from pathlib import Path
import sys

# Aseguramos que `src` esté en el path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from pony.orm import db_session, select  # type: ignore

from src.db import db  # type: ignore
from src import models  # type: ignore
from src.models import Role  # type: ignore


def main() -> None:
    db.generate_mapping(create_tables=True)

    with db_session:
        # 1) Borrar tareas predeterminadas que NO sean de la fase Acceso
        #    (evitamos select con generador por incompatibilidad con Python 3.13)
        for task in list(models.MandatoryTask.select()):
            if task.phase == "Acceso":
                continue
            for ct in list(task.client_tasks):
                ct.delete()
            print(f"Eliminando MandatoryTask (no Acceso): {task.slug}")
            task.delete()

        # 2) Borrar usuarios registrados provisoriamente
        for ru in list(models.RegisteredUser.select()):
            print(f"Eliminando RegisteredUser: {ru.username}")
            ru.delete()

        # 3) Borrar clientes (usuarios con rol CLIENTE) y todos sus datos asociados
        for user in list(models.User.select()):
            if user.role != Role.CLIENTE:
                continue
            print(f"Eliminando cliente y datos asociados: {user.email}")

            # Notificaciones del usuario
            for n in list(user.notifications):
                n.delete()

            client = user.client
            if client:
                # Tareas obligatorias y particulares
                for ct in list(client.mandatory_tasks):
                    ct.delete()
                for pt in list(client.particular_tasks):
                    pt.delete()

                # Activation tasks
                for at in list(client.activation_tasks):
                    at.delete()

                # Accesos a plataformas
                for pr in list(client.platform_requests):
                    pr.delete()

                client.delete()

            # Tickets donde sea autor o asignado
            for t in list(user.authored_tickets):
                t.delete()
            for t in list(user.assigned_tickets):
                t.delete()

            user.delete()

        print("Limpieza completada. Directores y tareas de la fase 'Acceso' conservadas.")


if __name__ == "__main__":
    main()

