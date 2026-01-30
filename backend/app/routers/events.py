"""
赛事 API 路由
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.event import EventCreate, EventUpdate, EventRead, EventList
from app.models.event import Event
from sqlalchemy import desc

router = APIRouter(prefix="/api/events", tags=["赛事管理"])


@router.post("", response_model=EventRead, summary="创建赛事")
def create_event(event: EventCreate, db: Session = Depends(get_db)):
    """创建新赛事"""
    db_event = Event(
        name=event.name,
        year=event.year,
        season=event.season,
        start_date=event.start_date,
        end_date=event.end_date,
        location=event.location,
        distance=event.distance,
        competition_format=event.competition_format,
        description=event.description
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event


@router.get("/{event_id}", response_model=EventRead, summary="获取赛事详情")
def get_event(event_id: int, db: Session = Depends(get_db)):
    """获取单个赛事的详细信息"""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="赛事不存在")
    return event


@router.get("", response_model=EventList, summary="获取赛事列表")
def list_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    year: int = Query(None),
    season: str = Query(None),
    db: Session = Depends(get_db)
):
    """获取赛事列表，支持按年度和季度筛选"""
    query = db.query(Event)

    if year is not None:
        query = query.filter(Event.year == year)
    if season:
        query = query.filter(Event.season == season)

    total = query.count()
    skip = (page - 1) * page_size
    events = query.order_by(desc(Event.created_at)).offset(skip).limit(page_size).all()

    return EventList(
        items=events,
        total=total,
        page=page,
        page_size=page_size
    )


@router.put("/{event_id}", response_model=EventRead, summary="更新赛事")
def update_event(
    event_id: int,
    event_update: EventUpdate,
    db: Session = Depends(get_db)
):
    """更新赛事信息"""
    db_event = db.query(Event).filter(Event.id == event_id).first()
    if not db_event:
        raise HTTPException(status_code=404, detail="赛事不存在")

    if event_update.name is not None:
        db_event.name = event_update.name
    if event_update.status is not None:
        db_event.status = event_update.status
    if event_update.description is not None:
        db_event.description = event_update.description

    db.commit()
    db.refresh(db_event)
    return db_event


@router.delete("/{event_id}", summary="删除赛事")
def delete_event(event_id: int, db: Session = Depends(get_db)):
    """删除赛事"""
    db_event = db.query(Event).filter(Event.id == event_id).first()
    if not db_event:
        raise HTTPException(status_code=404, detail="赛事不存在")

    db.delete(db_event)
    db.commit()
    return {"message": "赛事已删除"}
