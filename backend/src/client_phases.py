"""Fases del programa (canónicas) y aliases legacy para validar avances."""

PHASE_ORDER = [
    "Acceso",
    "Onboarding",
    "Base de Negocios",
    "Marketing",
    "Proceso de Ventas",
    "Optimizar",
]

LEGACY_TO_CANONICAL = {
    "tasks": "Acceso",
    "onboarding": "Onboarding",
    "Bases de Negocio": "Base de Negocios",
    "Creación de Funnels": "Marketing",
    "Marketing y Comunicación": "Marketing",
    "Ecosistema de Contenido": "Proceso de Ventas",
    "Procesos de Venta": "Proceso de Ventas",
    "Producto y Funnel Interno": "Optimizar",
}


def canonicalize_target_phase(p: str) -> str | None:
    """Normaliza la fase objetivo enviada por el cliente (o 'done')."""
    s = (p or "").strip()
    if s == "done":
        return "done"
    if s in PHASE_ORDER:
        return s
    return LEGACY_TO_CANONICAL.get(s)


def normalize_client_program_phase(stored: str) -> str | None:
    """
    Convierte la fase guardada en BD a una fase canónica del programa.
    initial / platforms / done no son pasos del programa lineal.
    """
    s = (stored or "").strip()
    if s in ("initial", "platforms", "done"):
        return None
    if s in PHASE_ORDER:
        return s
    return LEGACY_TO_CANONICAL.get(s)


def expected_next_program_phase(stored_phase: str) -> str | None:
    """Siguiente fase permitida (canónica o 'done') desde la fase actual en BD."""
    c = normalize_client_program_phase(stored_phase)
    if c is None:
        return None
    idx = PHASE_ORDER.index(c)
    if idx < len(PHASE_ORDER) - 1:
        return PHASE_ORDER[idx + 1]
    return "done"
