"""赛事删除只在隔离内存SQLite中验证，分别启用/禁用外键级联。"""
from copy import deepcopy

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event as sql_event
from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Query, Session
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models.event import Event
from app.models.event_configuration import EventConfiguration
from app.models.event_registration import EventRegistration
from app.models.score import Score
from app.models.scoring_rule import ScoringRule
from app.routers.events import EventDeletionConfirmation, delete_event, router
from app.security import create_admin_access_token


MODELS = (Event, EventRegistration, Score, EventConfiguration, ScoringRule)
TARGET = 41
CONFIRMATION = "2026年春季赛"


@pytest.fixture(params=[False, True], ids=["foreign_keys_off", "foreign_keys_on"])
def engine(request):
    db_engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    with db_engine.connect() as connection:
        connection.exec_driver_sql(f"PRAGMA foreign_keys={int(request.param)}")
        connection.commit()
        assert bool(connection.exec_driver_sql("PRAGMA foreign_keys").scalar()) is request.param
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
def populated(db):
    for identifier, year, season in [(41, 2026, "春季赛"), (42, 2026, "夏季赛"), (43, 2025, "春季赛"), (44, 2027, "春季赛")]:
        db.add(Event(id=identifier, year=year, season=season))
        db.flush()
        for index, distance in enumerate(("18m", "30m")):
            db.add_all([
                EventRegistration(year=year, season=season, name="同名选手", club=f"俱乐部{identifier}", distance=distance,
                                  competition_bow_type="recurve", points_bow_type="recurve", competition_gender_group="men"),
                Score(event_id=identifier, name="同名选手", bow_type="recurve", distance=distance, format="ranking", gender_group="men", rank=index + 1),
                EventConfiguration(event_id=identifier, gender_group="men", bow_type="recurve", distance=distance,
                                   individual_participant_count=index + 10, mixed_doubles_team_count=index, team_count=index + 1),
            ])
    # 规则截止时间与目标赛事一致，但快照仅引用时间轴，不应随赛事删除。
    first = ScoringRule(name="初始规则", start_key=0, end_key=2026 * 4 + 1, config={"snapshot": [25, 22, 19]})
    db.add(first)
    db.flush()
    db.add(ScoringRule(name="后继规则", source_rule_id=first.id, start_key=2026 * 4 + 2, config={"snapshot": [50, 44, 38]}))
    db.commit()


def snapshot(db):
    db.expire_all()
    return {
        model.__tablename__: [
            {column.name: deepcopy(getattr(row, column.name)) for column in model.__table__.columns}
            for row in db.query(model).order_by(model.id).all()
        ]
        for model in MODELS
    }


def request_delete(client, headers, identifier=TARGET, confirmation=CONFIRMATION):
    return client.request("DELETE", f"/api/events/{identifier}", headers=headers, json={"confirmation_name": confirmation})


def test_delete_cascades_explicitly_and_isolates_same_year_other_season_and_other_years(client, headers, db, populated):
    before = snapshot(db)
    response = request_delete(client, headers)
    assert response.status_code == 204
    assert response.content == b""
    assert "content-type" not in response.headers
    after = snapshot(db)
    assert after["events"] == [row for row in before["events"] if row["id"] != TARGET]
    assert after["event_registrations"] == [row for row in before["event_registrations"] if (row["year"], row["season"]) != (2026, "春季赛")]
    for table in ("scores", "event_configurations"):
        assert after[table] == [row for row in before[table] if row["event_id"] != TARGET]
    assert after["scoring_rules"] == before["scoring_rules"]
    assert client.get(f"/api/events/{TARGET}", headers=headers).status_code == 404
    assert request_delete(client, headers).status_code == 404
    assert snapshot(db) == after


def test_empty_event_can_be_deleted_without_touching_other_facts(client, headers, db, populated):
    db.add(Event(id=99, year=2030, season="冬季赛"))
    db.commit()
    before = snapshot(db)
    response = request_delete(client, headers, 99, "2030年冬季赛")
    assert response.status_code == 204
    after = snapshot(db)
    assert after["events"] == [row for row in before["events"] if row["id"] != 99]
    for table in ("event_registrations", "scores", "event_configurations", "scoring_rules"):
        assert after[table] == before[table]


@pytest.mark.parametrize("wrong", ["", " ", "2026春季赛", "2026年春季赛 ", " 2026年春季赛", "2026年夏季赛", "2025年春季赛"])
def test_confirmation_must_match_exact_current_event_name(client, headers, db, populated, wrong):
    before = snapshot(db)
    response = request_delete(client, headers, confirmation=wrong)
    assert response.status_code == 400
    assert response.json() == {"detail": "确认赛事名称不匹配"}
    assert snapshot(db) == before


@pytest.mark.parametrize("payload", [{}, {"confirmation_name": None}, {"confirmation_name": 2026}, {"confirmation_name": True}, {"confirmation_name": []}])
def test_missing_or_nonstring_confirmation_is_validation_error(client, headers, db, populated, payload):
    before = snapshot(db)
    response = client.request("DELETE", f"/api/events/{TARGET}", headers=headers, json=payload)
    assert response.status_code == 422
    assert snapshot(db) == before


def test_missing_json_body_is_validation_error(client, headers, db, populated):
    before = snapshot(db)
    assert client.request("DELETE", f"/api/events/{TARGET}", headers=headers).status_code == 422
    assert snapshot(db) == before


def test_nonexistent_target_returns_404_without_deleting_matching_year_season_records(client, headers, db, populated):
    before = snapshot(db)
    response = request_delete(client, headers, 99999)
    assert response.status_code == 404
    assert response.json() == {"detail": "赛事不存在"}
    assert snapshot(db) == before


@pytest.mark.parametrize("authorization", [None, "Bearer invalid", "Basic invalid"])
def test_deletion_requires_admin_authentication(client, db, populated, authorization):
    before = snapshot(db)
    headers = {} if authorization is None else {"Authorization": authorization}
    assert request_delete(client, headers).status_code == 401
    assert snapshot(db) == before


@pytest.mark.parametrize("stage", ["registrations", "scores", "configurations", "event", "commit", "integrity", "event_cas"])
def test_any_deletion_or_commit_failure_rolls_back_every_related_table(db, populated, monkeypatch, stage):
    before = snapshot(db)
    original_delete, original_commit = Query.delete, db.commit
    stages = {EventRegistration: "registrations", Score: "scores", EventConfiguration: "configurations", Event: "event"}

    def fail_delete(query, *args, **kwargs):
        model = query.column_descriptions[0]["entity"]
        if stages.get(model) == stage:
            raise RuntimeError("simulated storage failure")
        if stage == "integrity" and model is Event:
            raise IntegrityError("DELETE", {}, RuntimeError("simulated foreign key conflict"))
        if stage == "event_cas" and model is Event:
            return 0
        return original_delete(query, *args, **kwargs)

    def fail_commit():
        if stage == "commit":
            raise RuntimeError("simulated commit failure")
        return original_commit()

    monkeypatch.setattr(Query, "delete", fail_delete)
    monkeypatch.setattr(db, "commit", fail_commit)
    with pytest.raises(HTTPException) as exc_info:
        delete_event(TARGET, EventDeletionConfirmation(confirmation_name=CONFIRMATION), db, {"sub": "admin"})
    assert exc_info.value.status_code == (404 if stage == "event_cas" else 500)
    assert "simulated" not in exc_info.value.detail
    monkeypatch.setattr(Query, "delete", original_delete)
    monkeypatch.setattr(db, "commit", original_commit)
    assert snapshot(db) == before
    assert db.is_active


def test_locks_current_event_before_scoped_deletes_and_commits_once(db, engine, populated, monkeypatch):
    locked = []
    executed = []
    original_first, original_commit = Query.first, db.commit
    commits = []

    def record_first(query):
        if query._for_update_arg is not None:
            locked.append(str(query.statement.compile(dialect=postgresql.dialect())))
        return original_first(query)

    def record_sql(_connection, _cursor, statement, parameters, _context, _many):
        executed.append((statement, parameters))

    def record_commit():
        commits.append(True)
        return original_commit()

    monkeypatch.setattr(Query, "first", record_first)
    monkeypatch.setattr(db, "commit", record_commit)
    sql_event.listen(engine, "before_cursor_execute", record_sql)
    try:
        response = delete_event(TARGET, EventDeletionConfirmation(confirmation_name=CONFIRMATION), db, {"sub": "admin"})
    finally:
        sql_event.remove(engine, "before_cursor_execute", record_sql)
    assert response.status_code == 204
    assert len(locked) == 1
    assert "FOR UPDATE" in locked[0]
    assert "events.id =" in locked[0]
    assert commits == [True]
    assert [statement.split()[2] for statement, _params in executed if statement.startswith("DELETE")] == ["event_registrations", "scores", "event_configurations", "events"]
    assert next(parameters for statement, parameters in executed if statement.startswith("DELETE FROM event_registrations")) == (2026, "春季赛")
    assert next(parameters for statement, parameters in executed if statement.startswith("DELETE FROM scores")) == (TARGET,)
    assert next(parameters for statement, parameters in executed if statement.startswith("DELETE FROM event_configurations")) == (TARGET,)
    assert next(parameters for statement, parameters in executed if statement.startswith("DELETE FROM events")) == (TARGET, 2026, "春季赛")
    assert not any("scoring_rules" in statement for statement, _params in executed)


def test_stale_session_cannot_delete_an_already_deleted_event_twice(db, engine, populated):
    with Session(engine) as stale:
        cached = stale.get(Event, TARGET)
        assert cached.year == 2026
        delete_event(TARGET, EventDeletionConfirmation(confirmation_name=CONFIRMATION), db, {"sub": "admin"})
        with pytest.raises(HTTPException) as exc_info:
            delete_event(TARGET, EventDeletionConfirmation(confirmation_name=CONFIRMATION), stale, {"sub": "admin"})
        assert exc_info.value.status_code == 404
    assert db.query(Event).count() == 3
    assert db.query(Score).count() == 6
    assert db.query(EventRegistration).count() == 6
    assert db.query(EventConfiguration).count() == 6


def test_lock_refreshes_cached_event_identity_before_confirmation(db, engine, populated):
    cached = db.get(Event, TARGET)
    assert cached.season == "春季赛"
    with Session(engine) as writer:
        writer.query(Event).filter(Event.id == TARGET).update({Event.season: "秋季赛"}, synchronize_session=False)
        writer.commit()
    with pytest.raises(HTTPException) as exc_info:
        delete_event(TARGET, EventDeletionConfirmation(confirmation_name=CONFIRMATION), db, {"sub": "admin"})
    assert exc_info.value.status_code == 400
    assert db.get(Event, TARGET).season == "秋季赛"
    assert db.query(Score).count() == 8
    assert db.query(EventRegistration).count() == 8
    assert db.query(EventConfiguration).count() == 8


def test_lock_wait_losing_target_returns_404_without_beginning_child_deletes(db, populated, monkeypatch):
    before = snapshot(db)
    original_first = Query.first
    deleted = []

    def lose_locked_row(query):
        if query._for_update_arg is not None:
            return None
        return original_first(query)

    def no_delete(*args, **kwargs):
        deleted.append(True)
        raise AssertionError("must not delete after target vanished")

    monkeypatch.setattr(Query, "first", lose_locked_row)
    monkeypatch.setattr(Query, "delete", no_delete)
    with pytest.raises(HTTPException) as exc_info:
        delete_event(TARGET, EventDeletionConfirmation(confirmation_name=CONFIRMATION), db, {"sub": "admin"})
    assert exc_info.value.status_code == 404
    assert deleted == []
    assert snapshot(db) == before
