#!/usr/bin/env python3
"""
Limpia la base de datos conservando:
- La tabla User (usuarios)
- La tabla MandatoryTask (tareas por fase)

Ejecutar desde la raiz del repo:
  python scripts/cleanup_database.py
"""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
BACKEND_ROOT = ROOT / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

from pony.orm import db_session  # type: ignore
from src.db import db  # type: ignore
from src import models  # type: ignore


ENTITIES_TO_CLEAR_IN_ORDER = [
    models.Notification,
    models.ClientMandatoryTask,
    models.ClientParticularTask,
    models.ActivationTask,
    models.ClientPlatformRequest,
    models.Ticket,
    models.Client,
    models.RegisteredUser,
    models.Platform,
    models.AppSetting,
]


def main() -> None:
    db.generate_mapping(create_tables=True)

    with db_session:
        for entity in ENTITIES_TO_CLEAR_IN_ORDER:
            rows = list(entity.select())
            count = len(rows)
            for row in rows:
                row.delete()
            print(f"{entity.__name__}: {count} registros eliminados")

    print("\nLimpieza completada.")
    print("Se conservaron datos de User y MandatoryTask.")


if __name__ == "__main__":
    main()
