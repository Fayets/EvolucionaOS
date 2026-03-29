#!/usr/bin/env python3
"""
Migración: agrega `mandatory_task_deliverables` (TEXT, JSON) a la tabla Client (Pony ORM).

  cd backend && python3 ../scripts/add_client_mandatory_task_deliverables.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
ENV_PATH = BACKEND_DIR / ".env"

if not BACKEND_DIR.is_dir():
    print(f"No se encontró backend en {BACKEND_DIR}", file=sys.stderr)
    sys.exit(1)

COLUMN = "mandatory_task_deliverables"


def _load_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$", line)
        if not m:
            continue
        key, val = m.group(1), m.group(2).strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        out[key] = val
    return out


def _decouple_cfg(path: Path):
    sys.path.insert(0, str(BACKEND_DIR))
    from decouple import Config, RepositoryEnv

    if not path.is_file():
        return None
    return Config(RepositoryEnv(str(path)))


def _get(env: dict[str, str], cfg, key: str, default: str = "") -> str:
    v = env.get(key)
    if v is not None and str(v).strip() != "":
        return str(v).strip()
    if cfg is not None:
        try:
            got = cfg.get(key, default="")
            if got is not None and str(got).strip() != "":
                return str(got).strip()
        except Exception:
            pass
    return default


def _resolved_provider(env: dict[str, str], cfg) -> str:
    p = _get(env, cfg, "DB_PROVIDER").lower()
    if p in ("postgres", "postgresql", "pgsql"):
        return "postgres"
    if p == "sqlite":
        return "sqlite"
    if p:
        return p
    if _get(env, cfg, "DATABASE_URL"):
        return "postgres"
    if _get(env, cfg, "DB_HOST") and _get(env, cfg, "DB_NAME"):
        return "postgres"
    return ""


def _pg_ident(schema: str, table: str) -> str:
    def q(s: str) -> str:
        return '"' + s.replace('"', '""') + '"'

    if schema and schema != "public":
        return f"{q(schema)}.{q(table)}"
    return q(table)


def _connect_postgres(env: dict[str, str], cfg):
    import psycopg2

    url = _get(env, cfg, "DATABASE_URL")
    if url:
        return psycopg2.connect(url)

    sslmode = _get(env, cfg, "DB_SSLMODE", "require")
    return psycopg2.connect(
        user=_get(env, cfg, "DB_USER"),
        password=_get(env, cfg, "DB_PASS"),
        host=_get(env, cfg, "DB_HOST"),
        dbname=_get(env, cfg, "DB_NAME"),
        sslmode=sslmode,
    )


def _find_client_tables(cur) -> list[tuple[str, str]]:
    cur.execute(
        """
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_type = 'BASE TABLE'
          AND table_schema NOT IN ('pg_catalog', 'information_schema')
          AND (
            lower(table_name) = 'client'
            OR table_name = 'Client'
          )
        ORDER BY table_schema, table_name
        """
    )
    found = list(cur.fetchall())
    if found:
        return found

    cur.execute(
        """
        SELECT schemaname::text, tablename::text
        FROM pg_catalog.pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
          AND (
            lower(tablename) = 'client'
            OR tablename = 'Client'
          )
        ORDER BY schemaname, tablename
        """
    )
    return list(cur.fetchall())


def migrate_postgres(env: dict[str, str], cfg) -> None:
    conn = _connect_postgres(env, cfg)
    conn.autocommit = True
    cur = conn.cursor()

    rows = _find_client_tables(cur)
    if not rows:
        print("No se encontró la tabla Client.", file=sys.stderr)
        sys.exit(1)

    for schema, table in rows:
        cur.execute(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = %s
              AND table_name = %s
              AND column_name = %s
            """,
            (schema, table, COLUMN),
        )
        if cur.fetchone():
            print(f"OK — {schema}.{table}.{COLUMN} ya existe, nada que hacer.")
            continue

        fq = _pg_ident(schema, table)
        ddl = f"ALTER TABLE {fq} ADD COLUMN {COLUMN} TEXT NULL"
        print(f"Ejecutando: {ddl}")
        cur.execute(ddl)
        print(f"Listo: columna agregada en {schema}.{table}")

    cur.close()
    conn.close()


def migrate_sqlite(env: dict[str, str], cfg) -> None:
    import sqlite3

    path = _get(env, cfg, "DB_NAME")
    if not path or path == ":memory:":
        print("SQLite: DB_NAME no es un archivo válido.", file=sys.stderr)
        sys.exit(1)

    conn = sqlite3.connect(path)
    cur = conn.cursor()
    cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND "
        "(lower(name) = 'client' OR name = 'Client')"
    )
    tables = [r[0] for r in cur.fetchall()]
    if not tables:
        print("No se encontró tabla client en SQLite.", file=sys.stderr)
        sys.exit(1)

    for table in tables:
        safe = '"' + table.replace('"', '""') + '"'
        cur.execute(f"PRAGMA table_info({safe})")
        cols = {row[1] for row in cur.fetchall()}
        if COLUMN in cols:
            print(f"OK — {table}.{COLUMN} ya existe.")
            continue
        cur.execute(f"ALTER TABLE {safe} ADD COLUMN {COLUMN} TEXT")
        print(f"Listo: columna agregada en {table}")

    conn.commit()
    conn.close()


def main() -> None:
    env = _load_env_file(ENV_PATH)
    cfg = _decouple_cfg(ENV_PATH)

    if not env and cfg is None:
        print(f"No existe {ENV_PATH}. Creá el archivo con tus variables.", file=sys.stderr)
        sys.exit(1)

    provider = _resolved_provider(env, cfg)
    if provider in ("postgres", "postgresql", "pgsql"):
        migrate_postgres(env, cfg)
    elif provider == "sqlite":
        migrate_sqlite(env, cfg)
    else:
        print(
            f"No se detectó proveedor (DB_PROVIDER='{_get(env, cfg, 'DB_PROVIDER')}').\n"
            f"Archivo usado: {ENV_PATH}\n"
            "Definí DB_PROVIDER=postgres y/o DATABASE_URL en backend/.env.",
            file=sys.stderr,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
