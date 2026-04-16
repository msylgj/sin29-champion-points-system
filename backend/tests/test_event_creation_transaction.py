from fastapi import HTTPException

from app.database import Base, SessionLocal, engine
from app.models.event import Event
from app.models.event_configuration import EventConfiguration
from app.routers.events import create_event_with_configs
from app.schemas.event_configuration import CreateEventWithConfigs, EventConfigurationCreate


def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def test_create_event_with_configs_returns_400_for_existing_event():
    reset_database()
    db = SessionLocal()
    try:
        db.add(Event(year=2024, season='春季赛'))
        db.commit()

        payload = CreateEventWithConfigs(
            year=2024,
            season='春季赛',
            configurations=[
                EventConfigurationCreate(
                    gender_group='men',
                    bow_type='recurve',
                    distance='30m',
                    individual_participant_count=10,
                    mixed_doubles_team_count=0,
                    team_count=0,
                )
            ],
        )

        try:
            create_event_with_configs(payload, db, {'sub': 'admin'})
            raise AssertionError('expected HTTPException')
        except HTTPException as exc:
            assert exc.status_code == 400
            assert exc.detail == '该年度季度的赛事已存在'

        assert db.query(Event).count() == 1
        assert db.query(EventConfiguration).count() == 0
    finally:
        db.close()


def test_create_event_with_configs_rolls_back_partial_records_on_failure():
    reset_database()
    db = SessionLocal()
    try:
        payload = CreateEventWithConfigs(
            year=2024,
            season='春季赛',
            configurations=[
                EventConfigurationCreate(
                    gender_group='men',
                    bow_type='recurve',
                    distance='30m',
                    individual_participant_count=10,
                    mixed_doubles_team_count=0,
                    team_count=0,
                ),
                EventConfigurationCreate(
                    gender_group='men',
                    bow_type='recurve',
                    distance='30m',
                    individual_participant_count=12,
                    mixed_doubles_team_count=0,
                    team_count=0,
                ),
            ],
        )

        try:
            create_event_with_configs(payload, db, {'sub': 'admin'})
            raise AssertionError('expected HTTPException')
        except HTTPException as exc:
            assert exc.status_code == 400
            assert exc.detail == '该配置已存在，请删除后重新添加或使用更新操作'

        assert db.query(Event).count() == 0
        assert db.query(EventConfiguration).count() == 0
    finally:
        db.close()


def test_create_event_with_configs_allows_same_bow_distance_in_different_gender_groups():
    reset_database()
    db = SessionLocal()
    try:
        payload = CreateEventWithConfigs(
            year=2024,
            season='春季赛',
            configurations=[
                EventConfigurationCreate(
                    gender_group='men',
                    bow_type='recurve',
                    distance='30m',
                    individual_participant_count=10,
                    mixed_doubles_team_count=2,
                    team_count=1,
                ),
                EventConfigurationCreate(
                    gender_group='women',
                    bow_type='recurve',
                    distance='30m',
                    individual_participant_count=12,
                    mixed_doubles_team_count=2,
                    team_count=1,
                ),
            ],
        )

        response = create_event_with_configs(payload, db, {'sub': 'admin'})

        assert response['year'] == 2024
        assert db.query(Event).count() == 1
        assert db.query(EventConfiguration).count() == 2
    finally:
        db.close()
