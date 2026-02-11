"""
赛事 API 路由 - 简化版本
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
from app.database import get_db
from app.schemas.event import EventCreate, EventUpdate, EventRead, EventList
from app.schemas.event_configuration import CreateEventWithConfigs
from app.models.event import Event
from app.services.event_configuration_service import EventConfigurationService

router = APIRouter(prefix="/api/events", tags=["赛事管理"])


@router.post("", response_model=EventRead, summary="创建赛事")
def create_event(event: EventCreate, db: Session = Depends(get_db)):
    """创建新赛事"""
    # 检查年度+季度是否已存在
    existing = db.query(Event).filter(
        and_(Event.year == event.year, Event.season == event.season)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="该年度季度的赛事已存在")
    
    db_event = Event(
        year=event.year,
        season=event.season
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event


@router.post("/with-configs", summary="创建赛事及其配置")
def create_event_with_configs(event_data: CreateEventWithConfigs, db: Session = Depends(get_db)):
    """创建赛事并同时添加配置"""
    try:
        # 创建赛事
        existing = db.query(Event).filter(
            and_(Event.year == event_data.year, Event.season == event_data.season)
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="该年度季度的赛事已存在")
        
        db_event = Event(
            year=event_data.year,
            season=event_data.season
        )
        db.add(db_event)
        db.flush()  # 获取event的ID但不提交
        
        # 添加配置
        configs_with_event_id = []
        for config in event_data.configurations:
            config_dict = config.dict()
            config_dict['event_id'] = db_event.id
            from app.schemas.event_configuration import EventConfigurationCreate
            configs_with_event_id.append(EventConfigurationCreate(**config_dict))
        
        EventConfigurationService.batch_create_configurations(db, configs_with_event_id)
        
        db.commit()
        db.refresh(db_event)
        
        return {
            "id": db_event.id,
            "year": db_event.year,
            "season": db_event.season,
            "created_at": db_event.created_at,
            "updated_at": db_event.updated_at,
            "message": f"赛事及其 {len(configs_with_event_id)} 个配置已创建"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"创建失败：{str(e)}")


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

    # 赛事无可更新的字段
    db.commit()
    db.refresh(db_event)
    return db_event


@router.delete("/{event_id}", summary="删除赛事")
def delete_event(event_id: int, db: Session = Depends(get_db)):
    """删除赛事及其关联的所有成绩和配置"""
    db_event = db.query(Event).filter(Event.id == event_id).first()
    if not db_event:
        raise HTTPException(status_code=404, detail="赛事不存在")

    db.delete(db_event)
    db.commit()
    return {"message": "赛事已删除"}

