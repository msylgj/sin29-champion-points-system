import pytest
from pydantic import ValidationError

from app.database import Base, SessionLocal, engine
from app.models.event import Event
from app.models.event_configuration import EventConfiguration
from app.schemas.event_configuration import EventConfigurationCreate, EventConfigurationUpdate
from app.schemas.score import ScoreUpdate
from app.services.event_configuration_service import EventConfigurationService


def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


@pytest.mark.parametrize(
    ('field_name', 'value', 'expected_message'),
    [
        ('bow_type', 'invalid-bow', '弓种必须是'),
        ('distance', '999m', '距离必须是'),
        ('format', 'invalid-format', '比赛类型必须是'),
    ],
)
def test_score_update_rejects_invalid_enums(field_name, value, expected_message):
    with pytest.raises(ValidationError) as exc_info:
        ScoreUpdate(**{field_name: value})

    assert expected_message in str(exc_info.value)


def test_event_configuration_update_keeps_unspecified_fields():
    reset_database()
    db = SessionLocal()
    try:
        event = Event(year=2024, season='春季赛')
        db.add(event)
        db.flush()

        config = EventConfiguration(
            event_id=event.id,
            gender_group='men',
            bow_type='recurve',
            distance='30m',
            individual_participant_count=20,
            mixed_doubles_team_count=6,
            team_count=4,
        )
        db.add(config)
        db.commit()

        updated = EventConfigurationService.update_configuration(
            db,
            config.id,
            EventConfigurationUpdate(individual_participant_count=24),
        )

        assert updated.individual_participant_count == 24
        assert updated.gender_group == 'men'
        assert updated.mixed_doubles_team_count == 6
        assert updated.team_count == 4
    finally:
        db.close()


@pytest.mark.parametrize(
    ('field_name', 'value', 'expected_message'),
    [
        ('gender_group', 'open', '比赛性别分组必须是'),
        ('bow_type', 'invalid-bow', '弓种必须是'),
        ('distance', '999m', '距离必须是'),
    ],
)
def test_event_configuration_create_rejects_invalid_enums(field_name, value, expected_message):
    with pytest.raises(ValidationError) as exc_info:
        payload = {
            'gender_group': 'men',
            'bow_type': 'recurve',
            'distance': '30m',
        }
        payload[field_name] = value
        EventConfigurationCreate(**payload)

    assert expected_message in str(exc_info.value)
