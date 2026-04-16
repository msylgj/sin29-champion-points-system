"""
赛事报名 API 路由
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.event_registration import (
    EventRegistrationBatchImport,
    EventRegistrationList,
    EventRegistrationRead,
    EventRegistrationUpdate,
)
from app.security import verify_admin_token
from app.services.event_registration_service import EventRegistrationService

router = APIRouter(prefix="/api/event-registrations", tags=["赛事报名管理"])


@router.get("", response_model=EventRegistrationList, summary="获取赛事报名列表")
def list_event_registrations(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=1000),
    year: int = Query(None),
    season: str = Query(None),
    name: str = Query(None),
    db: Session = Depends(get_db),
    _auth: dict = Depends(verify_admin_token)
):
    skip = (page - 1) * page_size
    items, total = EventRegistrationService.list_registrations(
        db,
        skip=skip,
        limit=page_size,
        year=year,
        season=season,
        name=name,
    )
    return EventRegistrationList(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/batch/import", response_model=list[EventRegistrationRead], summary="批量导入赛事报名")
def batch_import_event_registrations(
    batch_import: EventRegistrationBatchImport,
    db: Session = Depends(get_db),
    _auth: dict = Depends(verify_admin_token)
):
    try:
        return EventRegistrationService.batch_create_registrations(db, batch_import.registrations)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败：{str(e)}")


@router.put("/{registration_id}", response_model=EventRegistrationRead, summary="更新赛事报名")
def update_event_registration(
    registration_id: int,
    registration_update: EventRegistrationUpdate,
    db: Session = Depends(get_db),
    _auth: dict = Depends(verify_admin_token)
):
    try:
        registration = EventRegistrationService.update_registration(db, registration_id, registration_update)
        if not registration:
            raise HTTPException(status_code=404, detail="报名不存在")
        return registration
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新失败：{str(e)}")


@router.delete("/{registration_id}", summary="删除赛事报名")
def delete_event_registration(
    registration_id: int,
    db: Session = Depends(get_db),
    _auth: dict = Depends(verify_admin_token)
):
    success = EventRegistrationService.delete_registration(db, registration_id)
    if not success:
        raise HTTPException(status_code=404, detail="报名不存在")
    return {"detail": "删除成功"}
