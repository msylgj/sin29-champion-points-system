"""
赛事 API 路由 - 简化版本
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import and_, case, desc, func, tuple_
from app.database import get_db
from app.schemas.event_configuration import CreateEventWithConfigs, EventConfigurationBase
from app.models.event import Event
from app.models.event_configuration import EventConfiguration
from app.models.event_registration import EventRegistration
from app.models.score import Score
from app.services.event_configuration_service import EventConfigurationService
from app.security import verify_admin_token

router = APIRouter(prefix="/api/events", tags=["赛事管理"])


class EventDeletionConfirmation(BaseModel):
    confirmation_name: str = Field(..., strict=True)


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
                gender_group=config.gender_group,
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
                "gender_group": cfg.gender_group,
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


@router.delete("/{event_id}", status_code=204, response_class=Response, summary="删除赛事及关联报名成绩配置")
def delete_event(
    event_id: int,
    confirmation: EventDeletionConfirmation,
    db: Session = Depends(get_db),
    _auth: dict = Depends(verify_admin_token),
):
    """锁定目标后精确确认名称，显式删除关联记录，不依赖数据库的外键级联开关。"""
    try:
        event = db.query(Event).filter(Event.id == event_id).populate_existing().with_for_update().first()
        if event is None:
            raise HTTPException(status_code=404, detail="赛事不存在")
        if confirmation.confirmation_name != f"{event.year}年{event.season}":
            raise HTTPException(status_code=400, detail="确认赛事名称不匹配")

        year, season = event.year, event.season
        db.query(EventRegistration).filter(
            EventRegistration.year == year, EventRegistration.season == season,
        ).delete(synchronize_session="fetch")
        db.query(Score).filter(Score.event_id == event_id).delete(synchronize_session="fetch")
        db.query(EventConfiguration).filter(EventConfiguration.event_id == event_id).delete(synchronize_session="fetch")
        deleted = db.query(Event).filter(
            Event.id == event_id, Event.year == year, Event.season == season,
        ).delete(synchronize_session="fetch")
        if deleted != 1:
            raise HTTPException(status_code=404, detail="赛事不存在")
        db.commit()
        return Response(status_code=204)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="删除赛事失败，请重试") from exc


@router.get("", summary="获取赛事列表")
def list_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    year: int = Query(None),
    season: str = Query(None),
    db: Session = Depends(get_db),
    _auth: dict = Depends(verify_admin_token),
    summary: bool = False,
):
    """获取赛事列表，支持按年度和季度筛选"""
    query = db.query(Event)

    if year is not None:
        query = query.filter(Event.year == year)
    if season:
        query = query.filter(Event.season == season)

    total = query.count()
    skip = (page - 1) * page_size
    if summary:
        season_order = case(
            (Event.season == "春季赛", 1), (Event.season == "夏季赛", 2),
            (Event.season == "秋季赛", 3), (Event.season == "冬季赛", 4),
            else_=0,
        )
        events = query.order_by(desc(Event.year), season_order.desc(), desc(Event.id)).offset(skip).limit(page_size).all()
        registration_counts = {}
        score_counts = {}
        if events:
            scopes = [(event.year, event.season) for event in events]
            # 报名按项目记录计数，不按姓名去重；两个事实表独立聚合，避免JOIN乘积。
            registration_counts = {
                (year, season): count
                for year, season, count in db.query(
                    EventRegistration.year, EventRegistration.season, func.count(EventRegistration.id),
                ).filter(
                    tuple_(EventRegistration.year, EventRegistration.season).in_(scopes),
                ).group_by(EventRegistration.year, EventRegistration.season).all()
            }
            score_counts = dict(db.query(Score.event_id, func.count(Score.id)).filter(
                Score.event_id.in_([event.id for event in events]),
            ).group_by(Score.event_id).all())
        return {
            "items": [
                {
                    "id": event.id, "year": event.year, "season": event.season,
                    "created_at": event.created_at, "updated_at": event.updated_at,
                    "registration_count": registration_counts.get((event.year, event.season), 0),
                    "score_count": score_counts.get(event.id, 0),
                }
                for event in events
            ],
            "total": total, "page": page, "page_size": page_size,
        }

    events = query.order_by(desc(Event.created_at), desc(Event.id)).offset(skip).limit(page_size).all()

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
                "gender_group": cfg.gender_group,
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
