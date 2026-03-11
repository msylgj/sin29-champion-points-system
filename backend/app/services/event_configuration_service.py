"""
赛事配置服务
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.models.event_configuration import EventConfiguration
from app.models.event import Event
from app.schemas.event_configuration import EventConfigurationBase, EventConfigurationUpdate
from typing import Optional


class EventConfigurationService:
    """赛事配置业务服务"""

    @staticmethod
    def create_configuration(db: Session, config: EventConfigurationBase) -> EventConfiguration:
        """创建赛事配置"""
        # 验证赛事是否存在
        event = db.query(Event).filter(Event.id == config.event_id).first()
        if not event:
            raise ValueError(f"赛事 ID {config.event_id} 不存在")
        
        # 检查该配置是否已存在
        existing = db.query(EventConfiguration).filter(
            and_(
                EventConfiguration.event_id == config.event_id,
                EventConfiguration.bow_type == config.bow_type,
                EventConfiguration.distance == config.distance
            )
        ).first()
        if existing:
            raise ValueError("该配置已存在，请删除后重新添加或使用更新操作")

        db_config = EventConfiguration(
            event_id=config.event_id,
            bow_type=config.bow_type,
            distance=config.distance,
            individual_participant_count=config.individual_participant_count,
            mixed_doubles_team_count=config.mixed_doubles_team_count,
            team_count=config.team_count
        )
        db.add(db_config)
        db.commit()
        db.refresh(db_config)
        return db_config

    @staticmethod
    def update_configuration(
        db: Session,
        config_id: int,
        config_update: EventConfigurationUpdate
    ) -> Optional[EventConfiguration]:
        """更新赛事配置"""
        db_config = db.query(EventConfiguration).filter(EventConfiguration.id == config_id).first()
        if not db_config:
            return None
        
        if config_update.individual_participant_count is not None:
            db_config.individual_participant_count = config_update.individual_participant_count
        if config_update.mixed_doubles_team_count is not None:
            db_config.mixed_doubles_team_count = config_update.mixed_doubles_team_count
        if config_update.team_count is not None:
            db_config.team_count = config_update.team_count
        
        db.commit()
        db.refresh(db_config)
        return db_config

    @staticmethod
    def delete_configuration(db: Session, config_id: int) -> bool:
        """删除赛事配置"""
        db_config = db.query(EventConfiguration).filter(EventConfiguration.id == config_id).first()
        if not db_config:
            return False
        db.delete(db_config)
        db.commit()
        return True

