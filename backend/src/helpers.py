"""Utilidades compartidas entre servicios (evita duplicación de código)."""


def get_client_display_name(email: str, user=None) -> str:
    """
    Obtiene el nombre de display para un cliente.

    Prioridad:
    1. Nombre completo del usuario (si tiene first_name o last_name)
    2. Parte local del email (antes del @)
    3. Fallback: "Cliente"

    Args:
        email: Email del cliente (requerido para fallback)
        user: Objeto User con first_name y last_name (opcional)

    Returns:
        Nombre formateado para display en tareas/notificaciones
    """
    if user and (user.first_name or user.last_name):
        parts = [p for p in [user.first_name, user.last_name] if p]
        return " ".join(parts).strip()

    if email:
        return email.split("@")[0].capitalize()

    return "Cliente"
