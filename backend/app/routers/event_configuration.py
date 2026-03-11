"""
赛事配置 API 路由
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.event_configuration import (
    EventConfigurationBase, EventConfigurationUpdate, EventConfigurationRead
)
from app.services.event_configuration_service import EventConfigurationService
from app.security import verify_admin_token

router = APIRouter(prefix="/api/event-configurations", tags=["赛事配置管理"])


@router.post("", response_model=EventConfigurationRead, summary="创建赛事配置")
def create_configuration(config: EventConfigurationBase, db: Session = Depends(get_db), _auth: dict = Depends(verify_admin_token)):
    """创建赛事配置"""
    try:
        return EventConfigurationService.create_configuration(db, config)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建失败：{str(e)}")


@router.put("/{config_id}", response_model=EventConfigurationRead, summary="更新配置")
def update_configuration(
    config_id: int,
    config_update: EventConfigurationUpdate,
    db: Session = Depends(get_db),
    _auth: dict = Depends(verify_admin_token)
):
    """更新赛事配置"""
    config = EventConfigurationService.update_configuration(db, config_id, config_update)
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")
    return config


@router.delete("/{config_id}", summary="删除配置")
def delete_configuration(config_id: int, db: Session = Depends(get_db), _auth: dict = Depends(verify_admin_token)):
    """删除赛事配置"""
    success = EventConfigurationService.delete_configuration(db, config_id)
    if not success:
        raise HTTPException(status_code=404, detail="配置不存在")
    return {"message": "配置已删除"}
