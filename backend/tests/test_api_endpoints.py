import pytest
from fastapi import HTTPException

from app.database import Base, SessionLocal, engine
from app.models.dictionary import BowTypeDict, CompetitionGenderGroupDict, CompetitionGroupDict
from app.models.event import Event
from app.models.event_configuration import EventConfiguration
from app.models.event_registration import EventRegistration
from app.models.score import Score
from app.schemas.score import ScoreCreate
from app.routers.dictionary import get_all_dictionaries
from app.routers.events import list_event_years
from app.routers.scores import get_annual_ranking, list_scores
from app.security import verify_admin_token
from app.services.score_service import ScoreService


def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def seed_ranking_data():
    db = SessionLocal()
    try:
        db.add_all([
            CompetitionGroupDict(group_code='A', bow_type='recurve', distance='30m'),
            CompetitionGroupDict(group_code='B', bow_type='sightless', distance='18m'),
        ])

        event_2024 = Event(year=2024, season='春季赛')
        event_2023 = Event(year=2023, season='秋季赛')
        db.add_all([event_2024, event_2023])
        db.flush()

        db.add_all([
            EventConfiguration(
                event_id=event_2024.id,
                gender_group='men',
                bow_type='recurve',
                distance='30m',
                individual_participant_count=20,
                mixed_doubles_team_count=0,
                team_count=0,
            ),
            EventConfiguration(
                event_id=event_2024.id,
                gender_group='women',
                bow_type='recurve',
                distance='30m',
                individual_participant_count=20,
                mixed_doubles_team_count=0,
                team_count=0,
            ),
            EventConfiguration(
                event_id=event_2024.id,
                gender_group='mixed',
                bow_type='sightless',
                distance='18m',
                individual_participant_count=0,
                mixed_doubles_team_count=0,
                team_count=0,
            ),
        ])

        db.add_all([
            EventRegistration(
                year=2024,
                season='春季赛',
                name='张三',
                club='A俱乐部',
                distance='30m',
                competition_bow_type='recurve',
                points_bow_type='recurve',
                competition_gender_group='men',
            ),
            EventRegistration(
                year=2024,
                season='夏季赛',
                name='张三',
                club='Z俱乐部',
                distance='18m',
                competition_bow_type='recurve',
                points_bow_type='recurve',
                competition_gender_group='men',
            ),
            EventRegistration(
                year=2024,
                season='春季赛',
                name='李四',
                club='B俱乐部',
                distance='30m',
                competition_bow_type='recurve',
                points_bow_type='recurve',
                competition_gender_group='women',
            ),
            EventRegistration(
                year=2024,
                season='春季赛',
                name='王五',
                club='C俱乐部',
                distance='18m',
                competition_bow_type='sightless',
                points_bow_type='barebow',
                competition_gender_group='mixed',
            ),
        ])

        db.add_all([
            Score(
                event_id=event_2024.id,
                name='张三',
                bow_type='recurve',
                distance='30m',
                format='ranking',
                rank=1,
            ),
            Score(
                event_id=event_2024.id,
                name='李四',
                bow_type='recurve',
                distance='30m',
                format='ranking',
                rank=2,
            ),
            Score(
                event_id=event_2024.id,
                name='王五',
                bow_type='sightless',
                distance='18m',
                format='ranking',
                rank=1,
            ),
            Score(
                event_id=event_2023.id,
                name='王五',
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
    assert payload['athletes'][0]['club'] == 'A俱乐部'
    assert payload['athletes'][0]['total_points'] == 20.0
    assert payload['athletes'][1]['name'] == '李四'
    assert payload['athletes'][1]['total_points'] == 17.6


def test_annual_ranking_uses_registration_points_bow_type_and_sightless_scores():
    reset_database()
    seed_ranking_data()
    db = SessionLocal()
    try:
        payload = get_annual_ranking(2024, 'barebow', db)
    finally:
        db.close()

    assert payload['year'] == 2024
    assert payload['bow_type'] == 'barebow'
    assert payload['total'] == 1
    assert payload['athletes'][0]['name'] == '王五'
    assert payload['athletes'][0]['club'] == 'C俱乐部'
    assert payload['athletes'][0]['total_points'] == 7.5


def test_annual_ranking_excludes_scores_without_matching_registration_context():
    reset_database()
    db = SessionLocal()
    try:
        event = Event(year=2024, season='春季赛')
        db.add(event)
        db.flush()

        db.add_all([
            CompetitionGroupDict(group_code='A', bow_type='recurve', distance='30m'),
            CompetitionGroupDict(group_code='A', bow_type='compound', distance='30m'),
            EventConfiguration(
                event_id=event.id,
                gender_group='men',
                bow_type='recurve',
                distance='30m',
                individual_participant_count=20,
                mixed_doubles_team_count=0,
                team_count=0,
            ),
        ])
        db.add(
            EventRegistration(
                year=2024,
                season='春季赛',
                name='张三',
                club='A俱乐部',
                distance='30m',
                competition_bow_type='recurve',
                points_bow_type='recurve',
                competition_gender_group='men',
            )
        )
        db.add_all([
            Score(
                event_id=event.id,
                name='张三',
                bow_type='recurve',
                distance='30m',
                format='ranking',
                rank=1,
            ),
            Score(
                event_id=event.id,
                name='张三',
                bow_type='compound',
                distance='30m',
                format='ranking',
                rank=1,
            ),
        ])
        db.commit()

        payload = get_annual_ranking(2024, 'recurve', db)
    finally:
        db.close()

    assert payload['total'] == 1
    assert payload['athletes'][0]['name'] == '张三'
    assert payload['athletes'][0]['total_points'] == 20.0
    assert len(payload['athletes'][0]['scores']) == 1
    assert payload['athletes'][0]['scores'][0]['distance'] == '30m'


def test_annual_ranking_team_scores_prefer_women_then_mixed_for_star_name():
    reset_database()
    db = SessionLocal()
    try:
        event = Event(year=2024, season='春季赛')
        db.add(event)
        db.flush()
        db.add(CompetitionGroupDict(group_code='A', bow_type='recurve', distance='30m'))

        db.add_all([
            EventConfiguration(
                event_id=event.id,
                gender_group='women',
                bow_type='recurve',
                distance='30m',
                individual_participant_count=0,
                mixed_doubles_team_count=0,
                team_count=8,
            ),
            EventConfiguration(
                event_id=event.id,
                gender_group='mixed',
                bow_type='recurve',
                distance='30m',
                individual_participant_count=0,
                mixed_doubles_team_count=0,
                team_count=5,
            ),
        ])
        db.add(
            EventRegistration(
                year=2024,
                season='春季赛',
                name='赵六*',
                club='D俱乐部',
                distance='30m',
                competition_bow_type='recurve',
                points_bow_type='recurve',
                competition_gender_group='women',
            )
        )
        db.add(
            Score(
                event_id=event.id,
                name='赵六*',
                bow_type='recurve',
                distance='30m',
                format='team',
                rank=1,
            )
        )
        db.commit()

        payload = get_annual_ranking(2024, 'recurve', db)
    finally:
        db.close()

    assert payload['total'] == 1
    assert payload['athletes'][0]['name'] == '赵六*'
    assert payload['athletes'][0]['club'] == 'D俱乐部'
    assert payload['athletes'][0]['total_points'] == 20.0


def test_dictionaries_include_sightless_bow_type_and_gender_groups():
    reset_database()
    db = SessionLocal()
    try:
        db.add_all([
            BowTypeDict(code='barebow', name='光弓'),
            BowTypeDict(code='longbow', name='美猎弓'),
            BowTypeDict(code='traditional', name='传统弓'),
            BowTypeDict(code='sightless', name='无瞄弓'),
            BowTypeDict(code='recurve', name='反曲弓'),
            BowTypeDict(code='compound', name='复合弓'),
            CompetitionGenderGroupDict(code='mixed', name='混合组'),
            CompetitionGenderGroupDict(code='women', name='女子组'),
            CompetitionGenderGroupDict(code='men', name='男子组'),
        ])
        db.commit()

        payload = get_all_dictionaries(db)
    finally:
        db.close()

    assert payload['success'] is True
    assert payload['data']['bowTypes'] == [
        {'code': 'barebow', 'name': '光弓'},
        {'code': 'longbow', 'name': '美猎弓'},
        {'code': 'traditional', 'name': '传统弓'},
        {'code': 'sightless', 'name': '无瞄弓'},
        {'code': 'recurve', 'name': '反曲弓'},
        {'code': 'compound', 'name': '复合弓'},
    ]
    assert payload['data']['competitionGenderGroups'] == [
        {'code': 'men', 'name': '男子组'},
        {'code': 'women', 'name': '女子组'},
        {'code': 'mixed', 'name': '混合组'},
    ]


def test_batch_create_scores_overwrites_duplicate_without_club_dimension():
    reset_database()
    db = SessionLocal()
    try:
        event = Event(year=2024, season='春季赛')
        db.add(event)
        db.flush()

        first = Score(
            event_id=event.id,
            name='张三',
            bow_type='recurve',
            distance='30m',
            format='ranking',
            rank=1,
        )
        db.add(first)
        db.commit()

        created = ScoreService.batch_create_scores(db, [
            ScoreCreate(
                event_id=event.id,
                name='张三',
                bow_type='recurve',
                distance='30m',
                format='ranking',
                rank=2,
            )
        ])

        all_scores = db.query(Score).all()
        assert len(all_scores) == 1
        assert all_scores[0].rank == 2
        assert created[0].id == all_scores[0].id
    finally:
        db.close()
