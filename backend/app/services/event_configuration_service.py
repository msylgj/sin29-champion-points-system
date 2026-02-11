"""
赛事配置服务
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
from app.models.event_configuration import EventConfiguration
from app.models.event import Event
from app.schemas.event_configuration import EventConfigurationCreate, EventConfigurationUpdate
from typing import Optional, List, Tuple


class EventConfigurationService:
    """赛事配置业务服务"""

    @staticmethod
    def create_configuration(db: Session, config: EventConfigurationCreate) -> EventConfiguration:
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
                EventConfiguration.distance == config.distance,
                EventConfiguration.format == config.format
            )
        ).first()
        if existing:
            raise ValueError("该配置已存在，请删除后重新添加或使用更新操作")

        db_config = EventConfiguration(
            event_id=config.event_id,
            bow_type=config.bow_type,
            distance=config.distance,
            format=config.format,
            participant_count=config.participant_count
        )
        db.add(db_config)
        db.commit()
        db.refresh(db_config)
        return db_config

    @staticmethod
    def get_configuration_by_id(db: Session, config_id: int) -> Optional[EventConfiguration]:
        """根据ID获取赛事配置"""
        return db.query(EventConfiguration).filter(EventConfiguration.id == config_id).first()

    @staticmethod
    def get_configuration_by_key(
        db: Session,
        event_id: int,
        bow_type: str,
        distance: str,
        format: str
    ) -> Optional[EventConfiguration]:
        """根据赛事+弓种+距离+格式获取配置"""
        return db.query(EventConfiguration).filter(
            and_(
                EventConfiguration.event_id == event_id,
                EventConfiguration.bow_type == bow_type,
                EventConfiguration.distance == distance,
                EventConfiguration.format == format
            )
        ).first()

    @staticmethod
    def list_configurations_by_event(
        db: Session,
        event_id: int
    ) -> List[EventConfiguration]:
        """获取某赛事的所有配置"""
        return db.query(EventConfiguration).filter(
            EventConfiguration.event_id == event_id
        ).all()

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
        
        if config_update.participant_count is not None:
            db_config.participant_count = config_update.participant_count
        
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

    @staticmethod
    def batch_create_configurations(
        db: Session,
        configs: List[EventConfigurationCreate]
    ) -> List[EventConfiguration]:
        """批量创建赛事配置"""
        result = []
        for config in configs:
            created = EventConfigurationService.create_configuration(db, config)
            result.append(created)
        return result
