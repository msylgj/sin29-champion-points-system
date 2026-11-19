"""赛事摘要清单：独立内存SQLite与真实HTTP，不连接外部数据库。"""
from contextlib import contextmanager
from datetime import datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event as sql_event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models.event import Event
from app.models.event_configuration import EventConfiguration
from app.models.event_registration import EventRegistration
from app.models.score import Score
from app.routers.events import router
from app.security import create_admin_access_token


@pytest.fixture
def engine():
    db_engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(db_engine)
    try:
        yield db_engine
    finally:
        db_engine.dispose()


@pytest.fixture
def db(engine):
    with Session(engine) as session:
        yield session


@pytest.fixture
def client(engine):
    app = FastAPI()
    app.include_router(router)

    def isolated_db():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_db] = isolated_db
    with TestClient(app) as http:
        yield http


@pytest.fixture
def headers():
    return {"Authorization": f"Bearer {create_admin_access_token()}"}


@pytest.fixture
def races(db):
    # ID、创建时间和比赛时间刻意不一致；摘要必须按年度和自然赛季排序。
    rows = [
        (90, 2024, "冬季赛", 28),
        (5, 2025, "春季赛", 27),
        (42, 2025, "秋季赛", 4),
        (9, 2025, "冬季赛", 3),
        (91, 2026, "春季赛", 2),
        (63, 2025, "夏季赛", 26),
        (3, 2024, "春季赛", 1),
    ]
    for identifier, year, season, day in rows:
        db.add(Event(id=identifier, year=year, season=season,
                     created_at=datetime(2030, 1, day, tzinfo=timezone.utc),
                     updated_at=datetime(2030, 1, day, tzinfo=timezone.utc)))
    db.commit()


@pytest.fixture
def facts(db, races):
    # 同名选手在两个项目各有一条报名；计数必须保留两条，而非distinct(name)。
    for name, distance in [("同名", "10m"), ("同名", "18m"), ("另一位", "30m")]:
        db.add(EventRegistration(year=2026, season="春季赛", name=name, club="A", distance=distance,
                                 competition_bow_type="recurve", points_bow_type="recurve", competition_gender_group="men"))
    for index in range(2):
        db.add(EventRegistration(year=2025, season="冬季赛", name=f"仅报名{index}", club="B", distance="30m",
                                 competition_bow_type="compound", points_bow_type="compound", competition_gender_group="women"))
    # 孤立年度/赛季的报名不应被当前分页统计吸入。
    db.add(EventRegistration(year=2027, season="冬季赛", name="无对应赛事", club="C", distance="30m",
                             competition_bow_type="recurve", points_bow_type="recurve", competition_gender_group="mixed"))
    for identifier, count in [(91, 4), (3, 2)]:
        for index in range(count):
            db.add(Score(event_id=identifier, name=f"成绩{index}", bow_type="recurve", distance="30m", format="ranking", rank=1))
    db.add_all([
        EventConfiguration(event_id=91, gender_group="men", bow_type="recurve", distance="30m",
                           individual_participant_count=999, mixed_doubles_team_count=9, team_count=7),
        EventConfiguration(event_id=91, gender_group="women", bow_type="compound", distance="18m",
                           individual_participant_count=888, mixed_doubles_team_count=0, team_count=0),
    ])
    db.commit()


@contextmanager
def recorded_sql(engine):
    statements = []

    def record(_connection, _cursor, sql, parameters, _context, _many):
        statements.append((sql, parameters))

    sql_event.listen(engine, "before_cursor_execute", record)
    try:
        yield statements
    finally:
        sql_event.remove(engine, "before_cursor_execute", record)


def test_summary_uses_calendar_order_not_id_creation_time_or_season_text(client, headers, races):
    response = client.get("/api/events", params={"summary": True, "page_size": 100}, headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert [row["id"] for row in body["items"]] == [91, 9, 42, 63, 5, 90, 3]
    assert body["total"] == 7
    assert body["page"] == 1
    assert body["page_size"] == 100
    for row in body["items"]:
        assert set(row) == {"id", "year", "season", "created_at", "updated_at", "registration_count", "score_count"}
        assert row["registration_count"] == 0
        assert row["score_count"] == 0
        assert isinstance(row["created_at"], str)
        assert isinstance(row["updated_at"], str)


def test_summary_counts_saved_records_without_name_dedup_or_fact_table_product(client, headers, facts):
    body = client.get("/api/events?summary=true&page_size=100", headers=headers).json()
    by_id = {row["id"]: row for row in body["items"]}
    assert (by_id[91]["registration_count"], by_id[91]["score_count"]) == (3, 4)
    assert (by_id[9]["registration_count"], by_id[9]["score_count"]) == (2, 0)
    assert (by_id[3]["registration_count"], by_id[3]["score_count"]) == (0, 2)
    assert (by_id[5]["registration_count"], by_id[5]["score_count"]) == (0, 0)
    assert sum(row["registration_count"] for row in body["items"]) == 5
    assert sum(row["score_count"] for row in body["items"]) == 6


def test_summary_pagination_is_stable_and_total_is_filtered_before_slicing(client, headers, facts):
    ids = []
    for page in (1, 2, 3, 4):
        body = client.get("/api/events", params={"summary": True, "page": page, "page_size": 2}, headers=headers).json()
        assert body["total"] == 7
        assert body["page"] == page
        assert body["page_size"] == 2
        ids.extend(row["id"] for row in body["items"])
    assert ids == [91, 9, 42, 63, 5, 90, 3]
    assert len(ids) == len(set(ids))


@pytest.mark.parametrize("params, expected_ids, total", [
    ({"year": 2025}, [9, 42, 63, 5], 4),
    ({"season": "春季赛"}, [91, 5, 3], 3),
    ({"year": 2025, "season": "冬季赛"}, [9], 1),
    ({"year": 2099}, [], 0),
])
def test_summary_keeps_year_and_season_filters(client, headers, facts, params, expected_ids, total):
    body = client.get("/api/events", params={"summary": True, "page_size": 100, **params}, headers=headers).json()
    assert body["total"] == total
    assert [row["id"] for row in body["items"]] == expected_ids


@pytest.mark.parametrize("page_size", [1, 2, 100])
def test_nonempty_summary_executes_constant_four_selects_and_never_loads_configs(client, headers, engine, facts, page_size):
    with recorded_sql(engine) as statements:
        response = client.get("/api/events", params={"summary": True, "page_size": page_size}, headers=headers)
    assert response.status_code == 200
    assert len(statements) == 4
    queries = [sql.lower() for sql, _parameters in statements]
    assert all(sql.lstrip().startswith("select") for sql in queries)
    assert not any("event_configurations" in sql for sql in queries)
    assert sum("from event_registrations" in sql for sql in queries) == 1
    assert sum("from scores" in sql for sql in queries) == 1
    assert not any(" join " in sql for sql in queries)


def test_aggregates_are_scoped_to_current_page_not_every_event(client, headers, engine, facts):
    with recorded_sql(engine) as statements:
        body = client.get("/api/events?summary=true&page=2&page_size=1", headers=headers).json()
    assert [row["id"] for row in body["items"]] == [9]
    registrations = next((sql, parameters) for sql, parameters in statements if "FROM event_registrations" in sql)
    scores = next((sql, parameters) for sql, parameters in statements if "FROM scores" in sql)
    assert "IN" in registrations[0]
    assert "GROUP BY" in registrations[0]
    assert registrations[1] == (2025, "冬季赛")
    assert "IN" in scores[0]
    assert "GROUP BY" in scores[0]
    assert scores[1] == (9,)


@pytest.mark.parametrize("empty_database, page, expected_total", [(True, 1, 0), (False, 99, 7)])
def test_empty_summary_page_skips_aggregation_queries(client, headers, engine, db, races, empty_database, page, expected_total):
    if empty_database:
        db.query(Event).delete()
        db.commit()
    with recorded_sql(engine) as statements:
        body = client.get("/api/events", params={"summary": True, "page": page}, headers=headers).json()
    assert body == {"items": [], "total": expected_total, "page": page, "page_size": 10}
    assert len(statements) == 2
    assert not any("event_registrations" in sql or "scores" in sql or "event_configurations" in sql for sql, _ in statements)


def test_default_list_preserves_creation_order_config_payload_and_explicit_false(client, headers, engine, facts):
    default = client.get("/api/events?page_size=100", headers=headers)
    explicit = client.get("/api/events?summary=false&page_size=100", headers=headers)
    assert default.status_code == explicit.status_code == 200
    assert default.json() == explicit.json()
    body = default.json()
    assert [row["id"] for row in body["items"]] == [90, 5, 63, 42, 9, 91, 3]
    target = next(row for row in body["items"] if row["id"] == 91)
    assert set(target) == {"id", "year", "season", "created_at", "updated_at", "configurations"}
    assert len(target["configurations"]) == 2
    assert target["configurations"][0]["individual_participant_count"] == 999
    assert not any("registration_count" in row or "score_count" in row for row in body["items"])
    with recorded_sql(engine) as statements:
        client.get("/api/events?page_size=100", headers=headers)
    assert len(statements) == 3
    assert not any("event_registrations" in sql or "FROM scores" in sql for sql, _ in statements)


@pytest.mark.parametrize("params", [{}, {"summary": True}, {"summary": False}])
def test_event_lists_remain_admin_only_and_year_list_remains_public(client, params):
    assert client.get("/api/events", params=params).status_code == 401
    assert client.get("/api/events", params=params, headers={"Authorization": "Bearer invalid"}).status_code == 401
    assert client.get("/api/events/years").status_code == 200


@pytest.mark.parametrize("params", [{"summary": "not-a-bool"}, {"summary": True, "page": 0}, {"summary": True, "page_size": 101}])
def test_summary_keeps_query_validation(client, headers, params):
    assert client.get("/api/events", params=params, headers=headers).status_code == 422
