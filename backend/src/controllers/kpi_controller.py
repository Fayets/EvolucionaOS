from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from src import schemas
from src.controllers.auth_controller import get_director_user
from src.services.kpi_service import KpiService

router = APIRouter()
service = KpiService()


@router.post("/verify-email", response_model=schemas.EmailVerifyResponse)
def verify_email(payload: schemas.EmailVerifyRequest):
    try:
        return service.verify_email(str(payload.email))
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al verificar email")


@router.get("/active-template", response_model=schemas.KpiTemplateOut)
def get_active_template_public():
    t = service.get_active_template()
    if not t:
        raise HTTPException(status_code=404, detail="No hay formulario activo")
    return t


@router.get("/public-weekly-templates", response_model=list[schemas.KpiTemplateOut])
def get_public_weekly_templates_public():
    """Plantillas KPIs Venta + KPI Mkt para la página /reportes-semanales."""
    try:
        rows = service.get_public_weekly_templates()
        if not rows:
            raise HTTPException(status_code=404, detail="No hay formularios de reporte semanal configurados")
        return rows
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al cargar formularios")


@router.get("/week-submission", response_model=schemas.KpiWeekSubmissionOut)
def get_week_submission_public(
    user_id: int = Query(..., ge=1),
    week_start: date = Query(...),
    template_id: int | None = Query(None),
):
    try:
        return service.get_week_submission(user_id, week_start, template_id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al consultar envío")


@router.post("/submit")
def submit_report_public(payload: schemas.KpiSubmit):
    try:
        rep = service.submit_report(payload)
        return {"ok": True, "report_id": rep.id}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al guardar reporte")


@router.get("/reports", response_model=list[schemas.KpiReportOut])
def list_reports_admin(
    week_start: date | None = Query(None),
    user_id: int | None = Query(None, ge=1),
    _director=Depends(get_director_user),
):
    try:
        return service.get_all_reports(week_start=week_start, user_id=user_id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al listar reportes")


@router.delete("/reports/{report_id}", status_code=204)
def delete_report_admin(
    report_id: int,
    _director=Depends(get_director_user),
):
    try:
        service.delete_report(report_id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al eliminar reporte")


@router.get("/reports/export-csv")
def export_reports_csv_admin(
    week_start: date | None = Query(None),
    _director=Depends(get_director_user),
):
    try:
        csv_text = service.get_reports_csv(week_start=week_start)
        filename = "kpi-reportes.csv"
        return StreamingResponse(
            iter([csv_text.encode("utf-8-sig")]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al exportar CSV")


@router.get("/templates", response_model=list[schemas.KpiTemplateOut])
def list_templates_admin(_director=Depends(get_director_user)):
    try:
        return service.get_all_templates()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al listar templates")


@router.post("/templates", response_model=schemas.KpiTemplateOut)
def create_template_admin(
    payload: schemas.KpiTemplateCreate,
    _director=Depends(get_director_user),
):
    try:
        return service.create_template(payload)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al crear template")


@router.put("/templates/{template_id}", response_model=schemas.KpiTemplateOut)
def update_template_admin(
    template_id: int,
    payload: schemas.KpiTemplateCreate,
    _director=Depends(get_director_user),
):
    try:
        return service.update_template(template_id, payload)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al actualizar template")


@router.patch("/templates/{template_id}/activate", response_model=schemas.KpiTemplateOut)
def activate_template_admin(
    template_id: int,
    _director=Depends(get_director_user),
):
    try:
        return service.activate_template(template_id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al activar template")
