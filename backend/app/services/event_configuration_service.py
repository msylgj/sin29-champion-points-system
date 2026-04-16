"""
赛事配置服务
"""
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import and_, text
from app.models.event_configuration import EventConfiguration
from app.models.event import Event
from app.schemas.event_configuration import EventConfigurationBase, EventConfigurationUpdate
from typing import Optional


class EventConfigurationService:
    """赛事配置业务服务"""

    @staticmethod
    def _sync_postgres_pk_sequence(db: Session, model) -> None:
        """修正 PostgreSQL 自增序列，避免手工补建后序列落后导致主键冲突。"""
        bind = db.get_bind()
        if bind is None or bind.dialect.name != "postgresql":
            return

        table_name = model.__tablename__
        db.execute(
            text(
                f"""
                SELECT setval(
                    pg_get_serial_sequence('{table_name}', 'id'),
                    COALESCE((SELECT MAX(id) FROM {table_name}), 1),
                    (SELECT MAX(id) IS NOT NULL FROM {table_name})
                )
                """
            )
        )

    @staticmethod
    def ensure_event_exists(
        db: Session,
        year: int,
        season: str,
        *,
        commit: bool = True
    ) -> Event:
        """确保赛事存在，不存在则创建。"""
        event = db.query(Event).filter(
            and_(Event.year == year, Event.season == season)
        ).first()
        if event:
            return event

        EventConfigurationService._sync_postgres_pk_sequence(db, Event)
        event = Event(year=year, season=season)
        db.add(event)
        db.flush()
        if commit:
            db.commit()
            db.refresh(event)
        return event

    @staticmethod
    def sync_individual_counts_from_registrations(
        db: Session,
        year: int,
        season: str,
        *,
        commit: bool = True
    ) -> None:
        """根据赛事报名同步个人人数；混双/团体队伍数保持原值。"""
        from app.models.event_registration import EventRegistration

        event = EventConfigurationService.ensure_event_exists(db, year, season, commit=False)

        registration_rows = db.query(EventRegistration).filter(
            and_(
                EventRegistration.year == year,
                EventRegistration.season == season,
            )
        ).all()

        registration_count_map = defaultdict(int)
        for row in registration_rows:
            registration_count_map[
                (row.competition_gender_group, row.competition_bow_type, row.distance)
            ] += 1

        config_rows = db.query(EventConfiguration).filter(
            EventConfiguration.event_id == event.id
        ).all()
        config_map = {
            (row.gender_group, row.bow_type, row.distance): row
            for row in config_rows
        }

        processed_keys = set()
        needs_insert = False

        for key, count in registration_count_map.items():
            processed_keys.add(key)
            gender_group, bow_type, distance = key
            config = config_map.get(key)
            if config:
                config.individual_participant_count = count
                continue

            if not needs_insert:
                EventConfigurationService._sync_postgres_pk_sequence(db, EventConfiguration)
                needs_insert = True
            db.add(
                EventConfiguration(
                    event_id=event.id,
                    gender_group=gender_group,
                    bow_type=bow_type,
                    distance=distance,
                    individual_participant_count=count,
                    mixed_doubles_team_count=0,
                    team_count=0,
                )
            )

        for key, config in config_map.items():
            if key in processed_keys:
                continue
            config.individual_participant_count = 0

        if commit:
            db.commit()
        else:
            db.flush()

    @staticmethod
    def create_configuration(
        db: Session,
        config: EventConfigurationBase,
        *,
        commit: bool = True
    ) -> EventConfiguration:
        """创建赛事配置"""
        # 验证赛事是否存在
        event = db.query(Event).filter(Event.id == config.event_id).first()
        if not event:
            raise ValueError(f"赛事 ID {config.event_id} 不存在")
        
        # 检查该配置是否已存在
        existing = db.query(EventConfiguration).filter(
            and_(
                EventConfiguration.event_id == config.event_id,
                EventConfiguration.gender_group == config.gender_group,
                EventConfiguration.bow_type == config.bow_type,
                EventConfiguration.distance == config.distance
            )
        ).first()
        if existing:
            raise ValueError("该配置已存在，请删除后重新添加或使用更新操作")

        EventConfigurationService._sync_postgres_pk_sequence(db, EventConfiguration)
        db_config = EventConfiguration(
            event_id=config.event_id,
            gender_group=config.gender_group,
            bow_type=config.bow_type,
            distance=config.distance,
            individual_participant_count=config.individual_participant_count,
            mixed_doubles_team_count=config.mixed_doubles_team_count,
            team_count=config.team_count
        )
        db.add(db_config)
        db.flush()
        if commit:
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
