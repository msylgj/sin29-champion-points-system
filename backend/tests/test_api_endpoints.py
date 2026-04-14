import pytest
from fastapi import HTTPException

from app.database import Base, SessionLocal, engine
from app.models.dictionary import CompetitionGroupDict
from app.models.event import Event
from app.models.event_configuration import EventConfiguration
from app.models.score import Score
from app.routers.events import list_event_years
from app.routers.scores import get_annual_ranking, list_scores
from app.security import verify_admin_token


def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def seed_ranking_data():
    db = SessionLocal()
    try:
        db.add(CompetitionGroupDict(group_code='A', bow_type='recurve', distance='30m'))

        event_2024 = Event(year=2024, season='春季赛')
        event_2023 = Event(year=2023, season='秋季赛')
        db.add_all([event_2024, event_2023])
        db.flush()

        db.add(
            EventConfiguration(
                event_id=event_2024.id,
                bow_type='recurve',
                distance='30m',
                individual_participant_count=20,
                mixed_doubles_team_count=0,
                team_count=0,
            )
        )

        db.add_all([
            Score(
                event_id=event_2024.id,
                name='张三',
                club='A俱乐部',
                bow_type='recurve',
                distance='30m',
                format='ranking',
                rank=1,
            ),
            Score(
                event_id=event_2024.id,
                name='李四',
                club='B俱乐部',
                bow_type='recurve',
                distance='30m',
                format='ranking',
                rank=2,
            ),
            Score(
                event_id=event_2023.id,
                name='王五',
                club='C俱乐部',
                bow_type='recurve',
                distance='30m',
                format='ranking',
                rank=1,
            ),
        ])
        db.commit()
    finally:
        db.close()


def test_scores_list_requires_admin_token():
    with pytest.raises(HTTPException) as exc_info:
        verify_admin_token(None)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == '未授权访问'


def test_scores_list_accepts_valid_admin_token():
    reset_database()
    db = SessionLocal()
    try:
        response = list_scores(
            page=1,
            page_size=10,
            event_id=None,
            bow_type=None,
            format=None,
            name=None,
            db=db,
            _auth={"sub": "admin"},
        )
    finally:
        db.close()

    assert response.items == []
    assert response.total == 0


def test_event_years_endpoint_is_public_and_sorted():
    reset_database()
    seed_ranking_data()
    db = SessionLocal()
    try:
        response = list_event_years(db)
    finally:
        db.close()

    assert response['items'] == [2024, 2023]


def test_annual_ranking_filters_year_and_aggregates_points():
    reset_database()
    seed_ranking_data()
    db = SessionLocal()
    try:
        payload = get_annual_ranking(2024, 'recurve', db)
    finally:
        db.close()

    assert payload['year'] == 2024
    assert payload['bow_type'] == 'recurve'
    assert payload['total'] == 2
    assert payload['athletes'][0]['name'] == '张三'
    assert payload['athletes'][0]['total_points'] == 20.0
    assert payload['athletes'][1]['name'] == '李四'
    assert payload['athletes'][1]['total_points'] == 17.6
