import csv
import io
import json
import logging
from datetime import date

from fastapi import HTTPException
from pony.orm import db_session, desc

from src import models, schemas
from src.models import Role

logger = logging.getLogger(__name__)

_ALLOWED_FIELD_TYPES = frozenset({"text", "number", "textarea", "select", "boolean"})


def _deserialize_fields(raw: str | None) -> list[schemas.KpiField]:
    if not raw or not str(raw).strip():
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []
    out: list[schemas.KpiField] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        try:
            out.append(schemas.KpiField.model_validate(item))
        except Exception:
            continue
    return out


def _serialize_fields(fields: list[schemas.KpiField]) -> str:
    return json.dumps([f.model_dump() for f in fields], ensure_ascii=False)


def default_kpis_venta_fields() -> list[schemas.KpiField]:
    """
    Template inicial «KPIs Venta»: fusiona la grilla mensual (métrica / logrado)
    y el listado semanal de ventas; se evitan duplicados obvios
    (p. ej. chats, agendamiento, llamadas totales vs realizadas).
    """
    return [
        schemas.KpiField(
            id="chats_ads",
            label="Cantidad de chats (Ads)",
            type="number",
            required=True,
            options=None,
        ),
        schemas.KpiField(
            id="agendas",
            label="Cantidad de agendas",
            type="number",
            required=True,
            options=None,
        ),
        schemas.KpiField(
            id="pct_agendamiento",
            label="% de agendamiento (tasa; ej. 4,7 = 4,7%)",
            type="number",
            required=True,
            options=None,
        ),
        schemas.KpiField(
            id="llamadas_total",
            label="Cantidad de llamadas (realizadas)",
            type="number",
            required=True,
            options=None,
        ),
        schemas.KpiField(
            id="llamadas_no_presentadas",
            label="Llamadas no presentadas",
            type="number",
            required=False,
            options=None,
        ),
        schemas.KpiField(
            id="llamadas_cerradas_cierres",
            label="Llamadas cerradas / cierres (cantidad)",
            type="number",
            required=False,
            options=None,
        ),
        schemas.KpiField(
            id="llamadas_senadas",
            label="Llamadas señadas",
            type="number",
            required=False,
            options=None,
        ),
        schemas.KpiField(
            id="llamadas_no_cerradas",
            label="Llamadas no cerradas",
            type="number",
            required=False,
            options=None,
        ),
        schemas.KpiField(
            id="llamadas_pend_cobrar",
            label="Llamadas pendientes a cobrar",
            type="number",
            required=False,
            options=None,
        ),
        schemas.KpiField(
            id="cash_collected",
            label="Cash collected ($)",
            type="number",
            required=True,
            options=None,
        ),
        schemas.KpiField(
            id="facturacion",
            label="Facturación ($)",
            type="number",
            required=True,
            options=None,
        ),
        schemas.KpiField(
            id="aov",
            label="AOV — ticket promedio ($)",
            type="number",
            required=False,
            options=None,
        ),
        schemas.KpiField(
            id="pct_show_up",
            label="% Show up rate",
            type="number",
            required=False,
            options=None,
        ),
        schemas.KpiField(
            id="pct_close_shows",
            label="% Close rate / shows",
            type="number",
            required=False,
            options=None,
        ),
        schemas.KpiField(
            id="pct_close_total",
            label="% Close rate total",
            type="number",
            required=False,
            options=None,
        ),
        schemas.KpiField(
            id="pct_llamadas_calificadas",
            label="% de llamadas calificadas",
            type="number",
            required=False,
            options=None,
        ),
        schemas.KpiField(
            id="cash_por_agenda",
            label="Cash por agenda ($)",
            type="number",
            required=False,
            options=None,
        ),
        schemas.KpiField(
            id="cash_por_show",
            label="Cash por show ($)",
            type="number",
            required=False,
            options=None,
        ),
    ]


def default_kpis_mkt_fields() -> list[schemas.KpiField]:
    """Plantilla «KPI Mkt»: métricas de publicación, enlaces y conclusiones."""
    return [
        schemas.KpiField(
            id="reels_subidos",
            label="Reels que subió",
            type="number",
            required=True,
            options=None,
        ),
        schemas.KpiField(
            id="historias_subidas",
            label="Historias que subió",
            type="number",
            required=True,
            options=None,
        ),
        schemas.KpiField(
            id="youtube_subidos",
            label="YouTube que subió",
            type="number",
            required=True,
            options=None,
        ),
        schemas.KpiField(
            id="angulo_utilizado",
            label="Ángulo utilizado",
            type="text",
            required=True,
            options=None,
        ),
        schemas.KpiField(
            id="transcript_fathoms_llamadas_cerradas",
            label="Documento de transcript de llamadas cerradas (Fathoms) — enlaces, uno por línea",
            type="textarea",
            required=False,
            options=None,
        ),
        schemas.KpiField(
            id="captura_chats_cerrados",
            label="Documento de captura de chats cerrados (enlace al doc)",
            type="text",
            required=True,
            options=None,
        ),
        schemas.KpiField(
            id="conclusion_avatar_semana",
            label="Conclusión de avatar que les llegó la última semana",
            type="textarea",
            required=True,
            options=None,
        ),
    ]


@db_session
def seed_kpis_venta_template_if_empty() -> None:
    """Si no hay ningún template KPI, crea «KPIs Venta» y lo deja activo."""
    if models.KpiTemplate.select().first():
        return
    fields = default_kpis_venta_fields()
    t = models.KpiTemplate(
        name="KPIs Venta",
        fields_json=_serialize_fields(fields),
        is_active=True,
    )
    t.flush()
    logger.info("KPI: creado template inicial «KPIs Venta» (%s campos, activo).", len(fields))


MKT_TEMPLATE_NAME = "KPI Mkt"

# Nombres canónicos en /reportes-semanales (comparación sin distinguir mayúsculas / espacios).
PUBLIC_WEEKLY_KPI_TEMPLATE_NAMES: tuple[str, ...] = ("KPIs Venta", "KPI Mkt")
_PUBLIC_WEEKLY_NAME_SET_CF = frozenset(x.casefold() for x in PUBLIC_WEEKLY_KPI_TEMPLATE_NAMES)


def _template_name_casefold(name: str | None) -> str:
    return (name or "").strip().casefold()


def _is_named_public_canonical(name: str | None) -> bool:
    return _template_name_casefold(name) in _PUBLIC_WEEKLY_NAME_SET_CF


def _public_weekly_name_sort_key(name: str | None) -> int:
    n = _template_name_casefold(name)
    for i, canonical in enumerate(PUBLIC_WEEKLY_KPI_TEMPLATE_NAMES):
        if n == canonical.casefold():
            return i
    return 999


def _public_weekly_template_entities() -> list[models.KpiTemplate]:
    """
    Plantillas que se muestran en /reportes-semanales.
    Prioriza las que coinciden con los nombres canónicos (sin distinguir mayúsculas).
    Si ninguna coincide (p. ej. renombradas en el panel), devuelve todas las plantillas KPI
    (activa primero) para que la página no quede vacía.
    """
    all_rows = list(models.KpiTemplate.select())
    strict = [t for t in all_rows if _is_named_public_canonical(t.name)]
    if strict:
        strict.sort(key=lambda t: (_public_weekly_name_sort_key(t.name), t.id))
        return strict
    all_rows.sort(key=lambda t: (not t.is_active, t.id))
    return all_rows


def _public_weekly_allowed_template_ids() -> frozenset[int]:
    return frozenset(t.id for t in _public_weekly_template_entities())


@db_session
def seed_kpis_mkt_template_if_missing() -> None:
    """Si no existe la plantilla «KPI Mkt», la crea inactiva (el director la activa cuando corresponda)."""
    mkt_cf = MKT_TEMPLATE_NAME.casefold()
    for t in models.KpiTemplate.select():
        if _template_name_casefold(t.name) == mkt_cf:
            return
    fields = default_kpis_mkt_fields()
    t = models.KpiTemplate(
        name=MKT_TEMPLATE_NAME,
        fields_json=_serialize_fields(fields),
        is_active=False,
    )
    t.flush()
    logger.info("KPI: creado template «%s» (%s campos, inactivo).", MKT_TEMPLATE_NAME, len(fields))


def _user_display_name(user: models.User) -> str:
    parts = [str(p).strip() for p in (user.first_name or "", user.last_name or "") if str(p).strip()]
    if not parts:
        return user.email or ""
    deduped: list[str] = []
    for p in parts:
        if deduped and deduped[-1].casefold() == p.casefold():
            continue
        deduped.append(p)
    return " ".join(deduped).strip()


def _template_entity_to_out(t: models.KpiTemplate) -> schemas.KpiTemplateOut:
    return schemas.KpiTemplateOut(
        id=t.id,
        name=t.name,
        fields=_deserialize_fields(t.fields_json),
        is_active=t.is_active,
        created_at=t.created_at,
    )


def _report_entity_to_out(r: models.KpiReport) -> schemas.KpiReportOut:
    u = r.user
    try:
        answers = json.loads(r.answers_json or "{}")
    except json.JSONDecodeError:
        answers = {}
    if not isinstance(answers, dict):
        answers = {}
    return schemas.KpiReportOut(
        id=r.id,
        user_email=u.email,
        user_name=_user_display_name(u),
        template_id=r.template.id,
        week_start=r.week_start,
        answers=answers,
        submitted_at=r.submitted_at,
    )


def _get_active_template_entity() -> models.KpiTemplate | None:
    for t in models.KpiTemplate.select().order_by(desc(models.KpiTemplate.id)):
        if t.is_active:
            return t
    return None


def _validate_answers(fields: list[schemas.KpiField], answers: dict) -> None:
    for f in fields:
        val = answers.get(f.id)
        if f.required:
            if val is None or val == "":
                raise HTTPException(
                    status_code=400,
                    detail=f"Campo requerido vacío: {f.label}",
                )
            if f.type == "boolean" and not isinstance(val, bool):
                raise HTTPException(
                    status_code=400,
                    detail=f"Tipo inválido para {f.label}",
                )
        if val is None or val == "":
            continue
        if f.type == "number":
            if isinstance(val, bool) or not isinstance(val, (int, float)):
                try:
                    float(val)
                except (TypeError, ValueError):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Número inválido en {f.label}",
                    )
        if f.type == "select" and f.options:
            if str(val) not in f.options:
                raise HTTPException(
                    status_code=400,
                    detail=f"Opción inválida en {f.label}",
                )


def _find_report_same_week(
    user: models.User, template: models.KpiTemplate, week_start: date
) -> models.KpiReport | None:
    for r in models.KpiReport.select(user=user, template=template):
        if r.week_start == week_start:
            return r
    return None


class KpiService:
    @db_session
    def get_public_weekly_templates(self) -> list[schemas.KpiTemplateOut]:
        return [_template_entity_to_out(t) for t in _public_weekly_template_entities()]

    @db_session
    def get_active_template(self) -> schemas.KpiTemplateOut | None:
        t = _get_active_template_entity()
        if not t:
            return None
        return _template_entity_to_out(t)

    @db_session
    def get_all_templates(self) -> list[schemas.KpiTemplateOut]:
        rows = list(models.KpiTemplate.select().order_by(desc(models.KpiTemplate.created_at)))
        return [_template_entity_to_out(t) for t in rows]

    @db_session
    def create_template(self, data: schemas.KpiTemplateCreate) -> schemas.KpiTemplateOut:
        for f in data.fields:
            if f.type not in _ALLOWED_FIELD_TYPES:
                raise HTTPException(status_code=400, detail=f"Tipo de campo no permitido: {f.type}")
        t = models.KpiTemplate(
            name=data.name.strip(),
            fields_json=_serialize_fields(data.fields),
            is_active=False,
        )
        t.flush()
        return _template_entity_to_out(t)

    @db_session
    def update_template(self, template_id: int, data: schemas.KpiTemplateCreate) -> schemas.KpiTemplateOut:
        t = models.KpiTemplate.get(id=template_id)
        if not t:
            raise HTTPException(status_code=404, detail="Template no encontrado")
        for f in data.fields:
            if f.type not in _ALLOWED_FIELD_TYPES:
                raise HTTPException(status_code=400, detail=f"Tipo de campo no permitido: {f.type}")
        t.name = data.name.strip()
        t.fields_json = _serialize_fields(data.fields)
        return _template_entity_to_out(t)

    @db_session
    def activate_template(self, template_id: int) -> schemas.KpiTemplateOut:
        t = models.KpiTemplate.get(id=template_id)
        if not t:
            raise HTTPException(status_code=404, detail="Template no encontrado")
        for other in models.KpiTemplate.select():
            other.is_active = False
        t.is_active = True
        return _template_entity_to_out(t)

    @db_session
    def verify_email(self, email: str) -> schemas.EmailVerifyResponse:
        raw = (email or "").strip()
        if not raw:
            return schemas.EmailVerifyResponse(exists=False, user_id=None, user_name=None)
        user = models.User.get(email=raw)
        if not user:
            return schemas.EmailVerifyResponse(exists=False, user_id=None, user_name=None)
        return schemas.EmailVerifyResponse(
            exists=True,
            user_id=user.id,
            user_name=_user_display_name(user),
        )

    @db_session
    def get_week_submission(
        self, user_id: int, week_start: date, template_id: int | None = None
    ) -> schemas.KpiWeekSubmissionOut:
        if template_id is not None:
            tpl = models.KpiTemplate.get(id=template_id)
            if not tpl:
                raise HTTPException(status_code=404, detail="Template no encontrado")
            if tpl.id not in _public_weekly_allowed_template_ids():
                raise HTTPException(
                    status_code=400,
                    detail="Este formulario no está disponible en reportes semanales",
                )
            user = models.User.get(id=user_id)
            if not user:
                return schemas.KpiWeekSubmissionOut(submitted=False, answers=None)
            r = _find_report_same_week(user, tpl, week_start)
            if not r:
                return schemas.KpiWeekSubmissionOut(submitted=False, answers=None)
            try:
                answers = json.loads(r.answers_json or "{}")
            except json.JSONDecodeError:
                answers = {}
            if not isinstance(answers, dict):
                answers = {}
            return schemas.KpiWeekSubmissionOut(submitted=True, answers=answers)

        active = _get_active_template_entity()
        if not active:
            return schemas.KpiWeekSubmissionOut(submitted=False, answers=None)
        user = models.User.get(id=user_id)
        if not user:
            return schemas.KpiWeekSubmissionOut(submitted=False, answers=None)
        r = _find_report_same_week(user, active, week_start)
        if not r:
            return schemas.KpiWeekSubmissionOut(submitted=False, answers=None)
        try:
            answers = json.loads(r.answers_json or "{}")
        except json.JSONDecodeError:
            answers = {}
        if not isinstance(answers, dict):
            answers = {}
        return schemas.KpiWeekSubmissionOut(submitted=True, answers=answers)

    @db_session
    def submit_report(self, data: schemas.KpiSubmit) -> schemas.KpiReportOut:
        tpl = models.KpiTemplate.get(id=data.template_id)
        if not tpl:
            raise HTTPException(status_code=404, detail="Template no encontrado")
        if tpl.id not in _public_weekly_allowed_template_ids():
            raise HTTPException(
                status_code=400,
                detail="Este formulario no está disponible en reportes semanales",
            )
        user = models.User.get(id=data.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        fields = _deserialize_fields(tpl.fields_json)
        _validate_answers(fields, data.answers)
        if _find_report_same_week(user, tpl, data.week_start):
            raise HTTPException(
                status_code=409,
                detail="Ya existe un reporte para este usuario en esta semana",
            )
        r = models.KpiReport(
            user=user,
            template=tpl,
            week_start=data.week_start,
            answers_json=json.dumps(data.answers, ensure_ascii=False),
        )
        r.flush()
        return _report_entity_to_out(r)

    @db_session
    def get_all_reports(
        self,
        week_start: date | None = None,
        user_id: int | None = None,
    ) -> list[schemas.KpiReportOut]:
        q = models.KpiReport.select().order_by(desc(models.KpiReport.submitted_at))
        out: list[schemas.KpiReportOut] = []
        for r in q:
            if week_start is not None and r.week_start != week_start:
                continue
            if user_id is not None and r.user.id != user_id:
                continue
            out.append(_report_entity_to_out(r))
        return out

    @db_session
    def delete_report(self, report_id: int) -> None:
        r = models.KpiReport.get(id=report_id)
        if not r:
            raise HTTPException(status_code=404, detail="Reporte no encontrado")
        r.delete()

    @db_session
    def count_client_users(self) -> int:
        return models.User.select(role=Role.CLIENTE).count()

    @db_session
    def get_reports_csv(self, week_start: date | None = None) -> str:
        active = _get_active_template_entity()
        field_labels: list[tuple[str, str]] = []
        if active:
            for f in _deserialize_fields(active.fields_json):
                field_labels.append((f.id, f.label))
        q = models.KpiReport.select().order_by(desc(models.KpiReport.submitted_at))
        reports: list[schemas.KpiReportOut] = []
        for r in q:
            if week_start is not None and r.week_start != week_start:
                continue
            reports.append(_report_entity_to_out(r))
        buffer = io.StringIO()
        w = csv.writer(buffer)
        header = ["email", "user_name", "week_start", "submitted_at", "template_id"]
        for _fid, label in field_labels:
            header.append(label)
        w.writerow(header)
        for rep in reports:
            row = [
                rep.user_email,
                rep.user_name,
                rep.week_start.isoformat(),
                rep.submitted_at.isoformat(),
                rep.template_id,
            ]
            for fid, _ in field_labels:
                row.append(rep.answers.get(fid, ""))
            w.writerow(row)
        return buffer.getvalue()
