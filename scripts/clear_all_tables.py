"""
Vacía TODAS las tablas de la base de datos (orden correcto por FK).
Ejecutar desde la carpeta backend:
  python scripts/clear_all_tables.py
"""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from pony.orm import db_session, select
from src.db import db
from src import models


ENTITIES_IN_ORDER = [
    models.Notification,
    models.ClientMandatoryTask,
    models.ClientParticularTask,
    models.ActivationTask,
    models.ClientPlatformRequest,
    models.Ticket,
    models.Client,
    models.RegisteredUser,
    models.User,
    models.MandatoryTask,
    models.Platform,
    models.AppSetting,
]


def main() -> None:
    db.generate_mapping(create_tables=True)

    with db_session:
        for entity in ENTITIES_IN_ORDER:
            rows = list(entity.select())
            count = len(rows)
            for row in rows:
                row.delete()
            print(f"  {entity.__name__}: {count} registros eliminados")

    print("\nTodas las tablas vaciadas correctamente.")


if __name__ == "__main__":
    main()
