"""
赛事 API 路由 - 简化版本
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
from app.database import get_db
from app.schemas.event_configuration import CreateEventWithConfigs, EventConfigurationBase
from app.models.event import Event
from app.models.event_configuration import EventConfiguration
from app.services.event_configuration_service import EventConfigurationService
from app.security import verify_admin_token

router = APIRouter(prefix="/api/events", tags=["赛事管理"])


@router.get("/years", summary="获取可用赛事年度")
def list_event_years(db: Session = Depends(get_db)):
    """公开返回已有赛事年度列表，供积分展示页筛选使用"""
    rows = db.query(Event.year).distinct().order_by(Event.year.desc()).all()
    return {
        "items": [item[0] for item in rows if item[0] is not None]
    }


@router.post("/with-configs", summary="创建赛事及其配置")
def create_event_with_configs(event_data: CreateEventWithConfigs, db: Session = Depends(get_db), _auth: dict = Depends(verify_admin_token)):
    """创建赛事并同时添加配置"""
    configs_with_event_id = []
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
        
        # 添加配置 - 为每个配置添加 event_id
        for config in event_data.configurations:
            configs_with_event_id.append(EventConfigurationBase(
                event_id=db_event.id,
                bow_type=config.bow_type,
                distance=config.distance,
                individual_participant_count=config.individual_participant_count,
                mixed_doubles_team_count=config.mixed_doubles_team_count,
                team_count=config.team_count,
            ))
        
        # 使用 service 批量创建
        for config in configs_with_event_id:
            EventConfigurationService.create_configuration(db, config, commit=False)
        
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
    except HTTPException:
        db.rollback()
        raise
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"创建失败：{str(e)}")


@router.get("/{event_id}", summary="获取赛事详情")
def get_event(event_id: int, db: Session = Depends(get_db), _auth: dict = Depends(verify_admin_token)):
    """获取单个赛事的详细信息"""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="赛事不存在")
    configs = db.query(EventConfiguration).filter(EventConfiguration.event_id == event.id).all()
    return {
        "id": event.id,
        "year": event.year,
        "season": event.season,
        "created_at": event.created_at,
        "updated_at": event.updated_at,
        "configurations": [
            {
                "id": cfg.id,
                "event_id": cfg.event_id,
                "bow_type": cfg.bow_type,
                "distance": cfg.distance,
                "individual_participant_count": cfg.individual_participant_count,
                "mixed_doubles_team_count": cfg.mixed_doubles_team_count,
                "team_count": cfg.team_count,
                "created_at": cfg.created_at,
                "updated_at": cfg.updated_at,
            }
            for cfg in configs
        ]
    }


@router.get("", summary="获取赛事列表")
def list_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    year: int = Query(None),
    season: str = Query(None),
    db: Session = Depends(get_db),
    _auth: dict = Depends(verify_admin_token)
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

    event_ids = [item.id for item in events]
    config_map = {}
    if event_ids:
        configs = db.query(EventConfiguration).filter(EventConfiguration.event_id.in_(event_ids)).all()
        for cfg in configs:
            if cfg.event_id not in config_map:
                config_map[cfg.event_id] = []
            config_map[cfg.event_id].append({
                "id": cfg.id,
                "event_id": cfg.event_id,
                "bow_type": cfg.bow_type,
                "distance": cfg.distance,
                "individual_participant_count": cfg.individual_participant_count,
                "mixed_doubles_team_count": cfg.mixed_doubles_team_count,
                "team_count": cfg.team_count,
                "created_at": cfg.created_at,
                "updated_at": cfg.updated_at,
            })

    return {
        "items": [
            {
                "id": event.id,
                "year": event.year,
                "season": event.season,
                "created_at": event.created_at,
                "updated_at": event.updated_at,
                "configurations": config_map.get(event.id, []),
            }
            for event in events
        ],
        "total": total,
        "page": page,
        "page_size": page_size
    }

