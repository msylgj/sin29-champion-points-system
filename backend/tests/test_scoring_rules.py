"""规则版本完整契约回归；使用隔离的内存SQLite，绝不连接真实PG。"""
import asyncio
from copy import deepcopy
from datetime import datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine, event as sql_event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Query, Session
from sqlalchemy.pool import StaticPool

from app.bootstrap import initialize_database
from app.database import Base, get_db
from app.models.dictionary import CompetitionGroupDict
from app.models.event import Event
from app.models.event_configuration import EventConfiguration
from app.models.event_registration import EventRegistration
from app.models.score import Score
from app.models.scoring_rule import ScoringRule
from app.routers import scoring_rules
from app.routers.events import list_events
from app.schemas.scoring_rule import ScoringRuleConfig, ScoringRuleCreate
from app.security import create_admin_access_token
from app.services.score_service import ScoreService
from app.services.scoring_calculator import ScoringCalculator
from app.services.scoring_rule_service import (
    RuleConflictError, RuleEventNotFoundError, ScoringRuleService, key_period, period_key,
)


@pytest.fixture
def memory_engine():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    try:
        yield engine
    finally:
        engine.dispose()


@pytest.fixture
def db(memory_engine):
    with Session(memory_engine) as session:
        session.add(CompetitionGroupDict(group_code="A", bow_type="recurve", distance="30m"))
        session.commit()
        yield session


@pytest.fixture
def config(db):
    return ScoringRuleService.default_config(db).model_dump(mode="json")


def add_event(db, year=2026, season="秋季赛"):
    row = Event(year=year, season=season)
    db.add(row)
    db.commit()
    return row


def initial(db):
    row = ScoringRuleService.ensure_initial_rule(db)
    db.commit()
    return row


def publish(db, base, ending_event, config=None, name="新规则"):
    return ScoringRuleService.create_rule(db, ScoringRuleCreate(
        name=name, base_rule_id=base.id, previous_end_event_id=ending_event.id, config=config,
    ))


def test_bootstrap_is_idempotent_and_never_resnapshots_dictionary(db, memory_engine):
    initialize_database(memory_engine)
    first = db.query(ScoringRule).one()
    snapshot = deepcopy(first.config)
    db.query(CompetitionGroupDict).update({"group_code": "C"})
    db.commit()
    initialize_database(memory_engine)
    db.expire_all()
    assert db.query(ScoringRule).count() == 1
    assert db.query(ScoringRule).one().config == snapshot
    assert ScoringRuleService.serialize(first)["start"] is None
    assert ScoringRuleService.serialize(first)["end"] is None
    assert snapshot["elimination_points"][12:] == [10, 10, 10, 10]
    assert snapshot["individual_coefficients"][-1]["max_count"] is None


def test_bootstrap_rejects_ambiguous_dictionary(db):
    db.add(CompetitionGroupDict(group_code="B", bow_type="recurve", distance="30m"))
    db.commit()
    with pytest.raises(ValueError, match="组别映射冲突"):
        ScoringRuleService.ensure_initial_rule(db)
    assert db.query(ScoringRule).count() == 0


def test_bootstrap_empty_groups_remain_zero_and_warn(memory_engine, caplog):
    initialize_database(memory_engine)
    with Session(memory_engine) as session:
        rule = session.query(ScoringRule).one()
        assert rule.config["competition_groups"] == []
        assert ScoringCalculator.calculate_points(
            1, "ranking", bow_type="recurve", distance="30m", participant_count=20, config=rule.config,
        ) == 0
    assert "组别快照为空" in caplog.text


def test_initial_seed_unique_race_uses_savepoint_and_requeries(db, monkeypatch):
    original = ScoringRuleService.default_config
    winners = []

    def concurrent_winner(session):
        snapshot = original(session)
        # 模拟初次SELECT与INSERT之间另一个启动者已经插入；失败的INSERT只回滚保存点。
        winner = ScoringRule(name="竞争者初始快照", start_key=0, config=snapshot.model_dump(mode="json"))
        session.add(winner)
        session.flush()
        winners.append(winner.id)
        return snapshot

    monkeypatch.setattr(ScoringRuleService, "default_config", staticmethod(concurrent_winner))
    rule = ScoringRuleService.ensure_initial_rule(db)
    assert rule.id == winners[0]
    assert db.query(ScoringRule).count() == 1
    assert db.query(CompetitionGroupDict).count() == 1
    db.commit()  # session未处于PendingRollback状态。


@pytest.mark.parametrize("bad", [-0.1, True, "25", float("inf"), float("nan"), 1e30, 1e308])
def test_rule_numbers_reject_unsafe_values(config, bad):
    config["ranking_points"][0] = bad
    with pytest.raises(ValidationError):
        ScoringRuleConfig.model_validate(config)


@pytest.mark.parametrize("field", ["fallback_base_points", "coefficient", "multiplier"])
def test_every_numeric_kind_has_safe_upper_bound(config, field):
    if field == "coefficient":
        config["team_coefficients"][0]["coefficient"] = 10001
    elif field == "multiplier":
        config["group_multipliers"]["A"] = 10001
    else:
        config[field] = 10001
    with pytest.raises(ValidationError):
        ScoringRuleConfig.model_validate(config)


@pytest.mark.parametrize("change", ["gap", "overlap", "finite_last", "early_infinity", "start_one", "reversed", "zero_cutoff", "fractional_count"])
def test_rule_coefficient_ranges_are_continuous_and_valid(config, change):
    rows = config["individual_coefficients"]
    if change == "gap":
        rows[1]["min_count"] = 5
    elif change == "overlap":
        rows[1]["min_count"] = 3
    elif change == "finite_last":
        rows[-1]["max_count"] = 300
    elif change == "early_infinity":
        rows[0]["max_count"] = None
    elif change == "start_one":
        rows[0]["min_count"] = 1
    elif change == "reversed":
        rows[0]["max_count"] = 2
        rows[0]["min_count"] = 3
    elif change == "zero_cutoff":
        rows[0]["cutoff"] = 0
    else:
        rows[0]["min_count"] = 2.5
    with pytest.raises(ValidationError):
        ScoringRuleConfig.model_validate(config)


@pytest.mark.parametrize("change", ["empty_points", "duplicate_group", "unknown_bow", "unknown_group", "unknown_distance", "precision", "rounding", "unknown_field", "default_count"])
def test_rule_config_rejects_invalid_contract_values(config, change):
    if change == "empty_points":
        config["team_points"] = []
    elif change == "duplicate_group":
        config["competition_groups"].append(deepcopy(config["competition_groups"][0]))
    elif change == "unknown_bow":
        config["competition_groups"][0]["bow_type"] = "invalid"
    elif change == "unknown_group":
        config["competition_groups"][0]["group_code"] = "D"
    elif change == "unknown_distance":
        config["competition_groups"][0]["distance"] = "999m"
    elif change == "precision":
        config["precision"] = True
    elif change == "rounding":
        config["rounding"] = "down"
    elif change == "default_count":
        config["default_participant_count"] = 1
    else:
        config["hidden_setting"] = 1
    with pytest.raises(ValidationError):
        ScoringRuleConfig.model_validate(config)


@pytest.mark.parametrize("name", ["", "   ", "x" * 101])
def test_rule_name_required_and_trimmed(name):
    with pytest.raises(ValidationError):
        ScoringRuleCreate(name=name, base_rule_id=1, previous_end_event_id=1)
    assert ScoringRuleCreate(name="  新规则  ", base_rule_id=1, previous_end_event_id=1).name == "新规则"


def test_new_rule_closes_prior_version_inclusive_and_inherits_independent_config(db):
    first = initial(db)
    snapshot = deepcopy(first.config)
    cutoff = add_event(db)
    successor = publish(db, first, cutoff)
    db.refresh(first)
    assert first.config == snapshot
    assert successor.config == snapshot
    assert successor.source_rule_id == first.id
    assert ScoringRuleService.serialize(first)["end"] == {"year": 2026, "season": "秋季赛"}
    assert ScoringRuleService.serialize(successor)["start"] == {"year": 2026, "season": "冬季赛"}
    assert ScoringRuleService.serialize(successor)["end"] is None
    assert [row.id for row in ScoringRuleService.list_rules(db)] == [successor.id, first.id]
    successor.config["ranking_points"][0] = 99
    assert first.config["ranking_points"][0] == 25  # JSON深拷贝，草稿不污染旧版。
    db.rollback()


def test_winter_boundary_rolls_to_next_year_and_rejects_reverse_cutoff(db):
    first = initial(db)
    winter = add_event(db, 2026, "冬季赛")
    successor = publish(db, first, winter)
    assert key_period(successor.start_key) == {"year": 2027, "season": "春季赛"}
    with pytest.raises(ValueError, match="不得早于"):
        publish(db, successor, winter)
    db.refresh(successor)
    assert successor.end_key is None
    assert db.query(ScoringRule).count() == 2


def test_missing_cutoff_and_stale_draft_never_change_timeline(db):
    first = initial(db)
    cutoff = add_event(db)
    with pytest.raises(RuleEventNotFoundError):
        ScoringRuleService.create_rule(db, ScoringRuleCreate(name="不存在", base_rule_id=first.id, previous_end_event_id=9999))
    second = publish(db, first, cutoff)
    with pytest.raises(RuleConflictError):
        publish(db, first, cutoff)
    db.refresh(second)
    assert second.end_key is None
    assert db.query(ScoringRule).count() == 2


@pytest.mark.parametrize("failure", ["runtime", "integrity"])
def test_publish_rolls_back_prior_close_when_successor_insert_fails(db, monkeypatch, failure):
    first = initial(db)
    ending = add_event(db)
    original_flush = db.flush

    def fail_flush(*args, **kwargs):
        if any(isinstance(row, ScoringRule) and row.source_rule_id == first.id for row in db.new):
            if failure == "integrity":
                raise IntegrityError("INSERT", {}, RuntimeError("simulated unique race"))
            raise RuntimeError("simulated storage failure")
        return original_flush(*args, **kwargs)

    monkeypatch.setattr(db, "flush", fail_flush)
    with pytest.raises(RuleConflictError if failure == "integrity" else RuntimeError):
        publish(db, first, ending)
    monkeypatch.setattr(db, "flush", original_flush)
    db.expire_all()
    assert db.query(ScoringRule).count() == 1
    assert db.query(ScoringRule).one().end_key is None


def test_compare_and_set_conflict_rolls_back_without_successor(db, monkeypatch):
    first = initial(db)
    ending = add_event(db)
    original_update = Query.update

    def lose_cas(query, *args, **kwargs):
        if query.column_descriptions[0]["entity"] is ScoringRule:
            return 0
        return original_update(query, *args, **kwargs)

    monkeypatch.setattr(Query, "update", lose_cas)
    with pytest.raises(RuleConflictError):
        publish(db, first, ending)
    db.refresh(first)
    assert first.end_key is None
    assert db.query(ScoringRule).count() == 1


def test_two_sessions_with_same_base_cannot_fork_rule_chain(db, memory_engine):
    first = initial(db)
    ending = add_event(db)
    base_id, ending_id = first.id, ending.id
    with Session(memory_engine) as rival:
        cached = rival.get(ScoringRule, base_id)  # 模拟另一管理员已打开旧草稿。
        publish(db, first, ending)
        with pytest.raises(RuleConflictError):
            ScoringRuleService.create_rule(rival, ScoringRuleCreate(
                name="并发草稿", base_rule_id=cached.id, previous_end_event_id=ending_id,
            ))
    assert db.query(ScoringRule).count() == 2
    assert db.query(ScoringRule).filter(ScoringRule.end_key.is_(None)).count() == 1


@pytest.mark.parametrize("competition_format", ["ranking", "elimination", "team", "mixed_doubles"])
def test_configured_calculator_uses_snapshot_values_and_half_up(config, competition_format):
    for field in ("ranking_points", "elimination_points", "team_points"):
        config[field] = [1.25]
    config["team_coefficients"][0]["coefficient"] = 0.2
    rule = ScoringRuleConfig.model_validate(config)
    assert ScoringCalculator.calculate_points(
        rank=1, competition_format=competition_format, bow_type="recurve", distance="30m", participant_count=2,
        competition_groups={("recurve", "30m"): "C"}, config=rule,
    ) == 0.3  # 1.25×0.2×1=0.25，仅用配置快照的组别，忽略外部字典。


@pytest.mark.parametrize("participant_count, expected", [(None, 20), (0, 20), (1, 25), (-1, 25)])
def test_config_default_count_and_legacy_low_count(config, participant_count, expected):
    config["default_participant_count"] = 20
    assert ScoringCalculator.calculate_points(
        1, "ranking", bow_type="recurve", distance="30m", participant_count=participant_count, config=config,
    ) == expected


def test_config_retains_full_precision_until_final_item_and_safe_maximum(config):
    config["ranking_points"] = [25.82]
    config["group_multipliers"]["A"] = 0.3
    assert ScoringCalculator.calculate_points(
        1, "ranking", bow_type="recurve", distance="30m", participant_count=2, config=config,
    ) == 1.5  # 25.82×0.2×0.3=1.5492；不能先舍入5.164为5.2。
    for field in ("ranking_points", "elimination_points", "team_points"):
        config[field] = [10000]
    for field in ("individual_coefficients", "team_coefficients"):
        for row in config[field]:
            row["coefficient"] = 10000
    config["group_multipliers"]["A"] = 10000
    assert ScoringCalculator.calculate_points(
        1, "ranking", bow_type="recurve", distance="30m", participant_count=2, config=config,
    ) == 1e12


def test_rule_time_selection_ignores_event_ids_and_supports_late_backfill(db):
    first = initial(db)
    # 非时序id：先创建冬季、再创建春季、最后创建秋季。
    winter = add_event(db, 2026, "冬季赛")
    spring = add_event(db, 2026, "春季赛")
    autumn = add_event(db, 2026, "秋季赛")
    changed = deepcopy(first.config)
    changed["ranking_points"][0] = 50
    second = publish(db, first, autumn, changed)
    late_summer = add_event(db, 2026, "夏季赛")
    for race in (spring, late_summer, autumn, winter):
        db.add_all([
            EventConfiguration(event_id=race.id, gender_group="men", bow_type="recurve", distance="30m",
                               individual_participant_count=20, mixed_doubles_team_count=0, team_count=0),
            EventRegistration(year=race.year, season=race.season, name="张三", club="A", distance="30m",
                              competition_bow_type="recurve", points_bow_type="recurve", competition_gender_group="men"),
            Score(event_id=race.id, name="张三", bow_type="recurve", distance="30m", format="ranking", gender_group="men", rank=1),
        ])
    db.query(CompetitionGroupDict).update({"group_code": "C"})
    db.commit()
    athlete = ScoreService.get_yearly_bow_type_ranking(db, 2026, "recurve")[0]
    assert [row["points"] for row in athlete["scores"]] == [20, 20, 20, 40]
    assert [row["scoring_rule_id"] for row in athlete["scores"]] == [first.id, first.id, first.id, second.id]
    assert [row["scoring_rule_name"] for row in athlete["scores"]] == ["初始规则"] * 3 + ["新规则"]
    assert athlete["total_points"] == 100


def test_yearly_query_loads_rule_table_once_not_per_score(db, monkeypatch):
    first = initial(db)
    race = add_event(db)
    db.add(EventRegistration(year=2026, season=race.season, name="张三", club="A", distance="30m",
                             competition_bow_type="recurve", points_bow_type="recurve", competition_gender_group="men"))
    for competition_format in ("ranking", "elimination", "team", "mixed_doubles"):
        db.add(Score(event_id=race.id, name="张三", bow_type="recurve", distance="30m", format=competition_format, gender_group="men", rank=1))
    db.commit()
    statements = []

    def record(_conn, _cursor, statement, _parameters, _context, _many):
        statements.append(statement)

    sql_event.listen(db.bind, "before_cursor_execute", record)
    try:
        result = ScoreService.get_yearly_bow_type_ranking(db, 2026, "recurve")
    finally:
        sql_event.remove(db.bind, "before_cursor_execute", record)
    assert len(result[0]["scores"]) == 4
    assert sum("FROM scoring_rules" in sql for sql in statements) == 2  # 幂等存在性检查+全版本预载。
    assert not any("FROM competition_groups" in sql for sql in statements)
    assert all(detail["scoring_rule_id"] == first.id for detail in result[0]["scores"])


def test_events_pagination_is_stable_for_equal_created_at(db):
    created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    races = [Event(year=2026, season=season, created_at=created_at) for season in ("春季赛", "夏季赛", "秋季赛", "冬季赛")]
    db.add_all(races)
    db.commit()
    seen = []
    for page in (1, 2):
        response = list_events(page=page, page_size=2, year=None, season=None, db=db, _auth={"sub": "admin"})
        seen.extend(row["id"] for row in response["items"])
    assert seen == sorted((row.id for row in races), reverse=True)


def test_lifespan_does_not_start_on_snapshot_failure(monkeypatch):
    from app import main

    def fail(_engine):
        raise RuntimeError("快照失败")

    monkeypatch.setattr(main, "initialize_database", fail)

    async def start():
        async with main.lifespan(main.app):
            pytest.fail("初始化失败后不应启动服务")

    with pytest.raises(RuntimeError, match="快照失败"):
        asyncio.run(start())


@pytest.fixture
def client(memory_engine, db):
    app = FastAPI()
    app.include_router(scoring_rules.router)

    def isolated_db():
        with Session(memory_engine) as session:
            yield session

    app.dependency_overrides[get_db] = isolated_db
    with TestClient(app) as http:
        yield http


@pytest.fixture
def auth_header():
    return {"Authorization": f"Bearer {create_admin_access_token()}"}


def test_rules_api_authentication_and_no_update(client, auth_header):
    assert client.get("/api/scoring-rules").status_code == 401
    assert client.post("/api/scoring-rules", json={}).status_code == 401
    assert client.get("/api/scoring-rules", headers={"Authorization": "Bearer invalid"}).status_code == 401
    response = client.get("/api/scoring-rules", headers=auth_header)
    assert response.status_code == 200
    first = response.json()["items"][0]
    assert set(first) == {"id", "name", "source_rule_id", "start", "end", "created_at", "config"}
    for method in (client.put, client.patch):
        assert method(f"/api/scoring-rules/{first['id']}", headers=auth_header).status_code == 405


def test_rules_api_create_inherit_validate_and_conflict(client, db, auth_header):
    first = client.get("/api/scoring-rules", headers=auth_header).json()["items"][0]
    ending = add_event(db)
    payload = {"name": "版本二", "base_rule_id": first["id"], "previous_end_event_id": ending.id}
    response = client.post("/api/scoring-rules", headers=auth_header, json=payload)
    assert response.status_code == 201
    second = response.json()
    assert second["config"] == first["config"]
    assert second["start"] == {"year": 2026, "season": "冬季赛"}
    assert second["source_rule_id"] == first["id"]
    assert client.post("/api/scoring-rules", headers=auth_header, json=payload).status_code == 409
    assert client.post("/api/scoring-rules", headers=auth_header, json={"name": "缺字段"}).status_code == 422
    missing = dict(payload, base_rule_id=second["id"], previous_end_event_id=99999)
    assert client.post("/api/scoring-rules", headers=auth_header, json=missing).status_code == 404
    backwards = dict(payload, base_rule_id=second["id"])
    assert client.post("/api/scoring-rules", headers=auth_header, json=backwards).status_code == 400
    assert client.get("/api/scoring-rules", headers=auth_header).json()["items"][0]["end"] is None


@pytest.mark.parametrize("unsafe", [1e30, 1e308, -1, True])
def test_rules_api_rejects_unsafe_config_before_publish(client, db, auth_header, unsafe):
    first = client.get("/api/scoring-rules", headers=auth_header).json()["items"][0]
    ending = add_event(db)
    config = deepcopy(first["config"])
    config["ranking_points"][0] = unsafe
    payload = {"name": "坏配置", "base_rule_id": first["id"], "previous_end_event_id": ending.id, "config": config}
    assert client.post("/api/scoring-rules", headers=auth_header, json=payload).status_code == 422
    assert db.query(ScoringRule).count() == 1
    assert db.query(ScoringRule).one().end_key is None


def test_rules_get_returns_one_snapshot_when_new_version_commits_during_read(db, memory_engine, monkeypatch):
    first = initial(db)
    ending = add_event(db)
    base_id, ending_id = first.id, ending.id
    original_commit = db.commit

    def concurrent_publish_after_read():
        original_commit()
        with Session(memory_engine) as writer:
            ScoringRuleService.create_rule(writer, ScoringRuleCreate(
                name="并发发布", base_rule_id=base_id, previous_end_event_id=ending_id,
            ))

    monkeypatch.setattr(db, "commit", concurrent_publish_after_read)
    payload = scoring_rules.list_scoring_rules(db, {"sub": "admin"})
    # 返回读到的完整旧快照，而非“旧列表但旧版end已关闭”的混合状态。
    assert len(payload["items"]) == 1
    assert payload["items"][0]["end"] is None
    monkeypatch.setattr(db, "commit", original_commit)
    assert len(scoring_rules.list_scoring_rules(db, {"sub": "admin"})["items"]) == 2


def test_rules_get_does_not_reload_expired_rows_after_commit(db):
    initial(db)
    statements = []

    def record(_conn, _cursor, statement, _parameters, _context, _many):
        statements.append(statement)

    sql_event.listen(db.bind, "before_cursor_execute", record)
    try:
        scoring_rules.list_scoring_rules(db, {"sub": "admin"})
    finally:
        sql_event.remove(db.bind, "before_cursor_execute", record)
    assert sum("FROM scoring_rules" in sql for sql in statements) == 2


def test_postgresql_ddl_compiles_without_connecting_database():
    from sqlalchemy.dialects import postgresql
    from sqlalchemy.schema import CreateTable

    ddl = str(CreateTable(ScoringRule.__table__).compile(dialect=postgresql.dialect()))
    assert "config JSON NOT NULL" in ddl
    assert "UNIQUE (start_key)" in ddl
    assert "UNIQUE (source_rule_id)" in ddl
    assert "ck_scoring_rule_range" in ddl


def test_postgresql_bootstrap_locks_before_ddl_and_seed(monkeypatch):
    from unittest.mock import MagicMock
    from app import bootstrap

    order = []
    engine = MagicMock()
    connection = engine.begin.return_value.__enter__.return_value
    connection.dialect.name = "postgresql"
    connection.execute.side_effect = lambda statement: order.append(("lock", str(statement)))
    monkeypatch.setattr(Base.metadata, "create_all", lambda bind: order.append(("ddl", bind)))
    session_context = MagicMock()
    session = session_context.__enter__.return_value
    session.commit.side_effect = lambda: order.append(("commit", None))

    def session_factory(**kwargs):
        assert kwargs == {"bind": connection, "join_transaction_mode": "create_savepoint"}
        return session_context

    def seed(db):
        assert db is session
        order.append(("seed", db))
        rule = MagicMock()
        rule.config = {"competition_groups": [{"bow_type": "recurve"}]}
        return rule

    monkeypatch.setattr(bootstrap, "Session", session_factory)
    monkeypatch.setattr(ScoringRuleService, "ensure_initial_rule", staticmethod(seed))
    bootstrap.initialize_database(engine)
    assert [item[0] for item in order] == ["lock", "ddl", "seed", "commit"]
    assert "pg_advisory_xact_lock" in order[0][1]
    assert order[1][1] is connection


def test_startup_snapshot_failure_rolls_back_seed_transaction(memory_engine, monkeypatch):
    def seed_then_fail(db):
        db.add(ScoringRule(name="半成品", start_key=0, config={}))
        db.flush()
        raise RuntimeError("启动快照中断")

    monkeypatch.setattr(ScoringRuleService, "ensure_initial_rule", staticmethod(seed_then_fail))
    with pytest.raises(RuntimeError, match="启动快照中断"):
        initialize_database(memory_engine)
    with Session(memory_engine) as db:
        assert db.query(ScoringRule).count() == 0


def test_rule_list_refreshes_initial_identity_map_after_concurrent_publish(db, memory_engine, monkeypatch):
    first = initial(db)
    ending = add_event(db)
    base_id, ending_id = first.id, ending.id
    original = ScoringRuleService.ensure_initial_rule
    injected = False

    def ensure_then_other_writer(session):
        nonlocal injected
        result = original(session)
        if session is db and not injected:
            injected = True
            with Session(memory_engine) as writer:
                ScoringRuleService.create_rule(writer, ScoringRuleCreate(
                    name="存在性查询后并发发布", base_rule_id=base_id, previous_end_event_id=ending_id,
                ))
        return result

    monkeypatch.setattr(ScoringRuleService, "ensure_initial_rule", staticmethod(ensure_then_other_writer))
    rules = ScoringRuleService.list_rules(db)
    assert len(rules) == 2
    assert rules[0].end_key is None
    assert rules[1].end_key == period_key(2026, "秋季赛")


def two_rule_chain(db):
    first = initial(db)
    ending = add_event(db, 2026, "秋季赛")
    second = publish(db, first, ending, name="待删除版本")
    return first, second, ending


def assert_two_rule_chain_intact(db, first_id, second_id):
    db.expire_all()
    rows = ScoringRuleService.list_rules(db)
    assert [row.id for row in rows] == [second_id, first_id]
    assert rows[0].end_key is None
    assert rows[1].end_key == rows[0].start_key - 1


def test_delete_latest_restores_predecessor_and_preserves_all_config(db):
    first, second, _ending = two_rule_chain(db)
    first_id, second_id = first.id, second.id
    first_before = ScoringRuleService.serialize(first)
    response = ScoringRuleService.delete_rule(db, second_id)
    assert response == {"deleted_rule_id": second_id, "restored_rule": dict(first_before, end=None)}
    assert db.query(ScoringRule).count() == 1
    assert db.get(ScoringRule, first_id).end_key is None
    assert db.query(ScoringRule).filter(ScoringRule.id == second_id).first() is None
    assert db.query(Event).count() == 1
    assert db.query(CompetitionGroupDict).count() == 1


def test_delete_only_latest_of_multiple_successors_and_then_delete_again(db):
    first, second, _ending = two_rule_chain(db)
    winter = add_event(db, 2026, "冬季赛")
    third = publish(db, second, winter, name="第三版")
    first_id, second_id, third_id = first.id, second.id, third.id
    first_config, second_config = deepcopy(first.config), deepcopy(second.config)
    with pytest.raises(RuleConflictError):
        ScoringRuleService.delete_rule(db, second_id)
    response = ScoringRuleService.delete_rule(db, third_id)
    assert response["restored_rule"]["id"] == second_id
    assert response["restored_rule"]["end"] is None
    db.expire_all()
    assert db.get(ScoringRule, first_id).end_key == period_key(2026, "秋季赛")
    assert db.get(ScoringRule, first_id).config == first_config
    assert db.get(ScoringRule, second_id).config == second_config
    response = ScoringRuleService.delete_rule(db, second_id)
    assert response["restored_rule"]["id"] == first_id
    assert response["restored_rule"]["end"] is None
    assert db.query(ScoringRule).count() == 1


def test_deleted_sqlite_ids_are_never_reused_and_stale_drafts_cannot_match(db):
    first, second, ending = two_rule_chain(db)
    first_id, second_id, ending_id = first.id, second.id, ending.id
    ScoringRuleService.delete_rule(db, second_id)
    replacement = publish(db, db.get(ScoringRule, first_id), ending, name="替代版本")
    assert replacement.id > second_id
    with pytest.raises(RuleConflictError):
        ScoringRuleService.create_rule(db, ScoringRuleCreate(
            name="已删除版本的陈旧草稿", base_rule_id=second_id, previous_end_event_id=ending_id,
        ))
    from app.services.scoring_rule_service import RuleNotFoundError
    with pytest.raises(RuleNotFoundError):
        ScoringRuleService.delete_rule(db, second_id)
    assert db.query(ScoringRule).filter(ScoringRule.id == replacement.id).one().end_key is None


def test_delete_checks_initial_missing_and_closed_rules(db):
    from app.services.scoring_rule_service import RuleNotFoundError

    first, second, _ending = two_rule_chain(db)
    first_id, second_id = first.id, second.id
    with pytest.raises(ValueError, match="初始规则不可删除"):
        ScoringRuleService.delete_rule(db, first_id)
    with pytest.raises(RuleNotFoundError):
        ScoringRuleService.delete_rule(db, 99999)
    second = db.get(ScoringRule, second_id)
    second.end_key = second.start_key
    db.commit()
    with pytest.raises(RuleConflictError):
        ScoringRuleService.delete_rule(db, second_id)
    assert db.query(ScoringRule).count() == 2


@pytest.mark.parametrize("stage", ["delete_cas", "restore_cas", "restore_runtime", "restore_integrity", "commit_runtime"])
def test_delete_rolls_back_both_changes_on_any_failure(db, monkeypatch, stage):
    first, second, _ending = two_rule_chain(db)
    first_id, second_id = first.id, second.id
    original_update, original_delete, original_commit = Query.update, Query.delete, db.commit

    def fail_delete(query, *args, **kwargs):
        if stage == "delete_cas":
            return 0
        return original_delete(query, *args, **kwargs)

    def fail_restore(query, *args, **kwargs):
        if stage == "restore_cas":
            return 0
        if stage == "restore_runtime":
            raise RuntimeError("恢复写入失败")
        if stage == "restore_integrity":
            raise IntegrityError("UPDATE", {}, RuntimeError("并发恢复失败"))
        return original_update(query, *args, **kwargs)

    def fail_commit():
        if stage == "commit_runtime":
            raise RuntimeError("事务提交失败")
        return original_commit()

    monkeypatch.setattr(Query, "delete", fail_delete)
    monkeypatch.setattr(Query, "update", fail_restore)
    monkeypatch.setattr(db, "commit", fail_commit)
    expected = RuntimeError if stage.endswith("runtime") else RuleConflictError
    with pytest.raises(expected):
        ScoringRuleService.delete_rule(db, second_id)
    monkeypatch.setattr(Query, "delete", original_delete)
    monkeypatch.setattr(Query, "update", original_update)
    monkeypatch.setattr(db, "commit", original_commit)
    assert_two_rule_chain_intact(db, first_id, second_id)


@pytest.mark.parametrize("operation", ["create", "delete"])
def test_lock_wait_returning_no_latest_is_conflict_not_500(db, monkeypatch, operation):
    first, second, ending = two_rule_chain(db)
    second_id, ending_id = second.id, ending.id
    monkeypatch.setattr(ScoringRuleService, "_lock_latest", staticmethod(lambda _db: None))
    with pytest.raises(RuleConflictError):
        if operation == "delete":
            ScoringRuleService.delete_rule(db, second_id)
        else:
            ScoringRuleService.create_rule(db, ScoringRuleCreate(
                name="等待期间被删除", base_rule_id=second_id, previous_end_event_id=ending_id,
            ))
    assert db.query(ScoringRule).count() == 2


def test_create_waiting_on_already_closed_latest_is_conflict(db, monkeypatch):
    _first, second, ending = two_rule_chain(db)
    second_id, ending_id = second.id, ending.id
    second.end_key = second.start_key
    db.commit()
    with pytest.raises(RuleConflictError):
        ScoringRuleService.create_rule(db, ScoringRuleCreate(
            name="等待期间被关闭", base_rule_id=second_id, previous_end_event_id=ending_id,
        ))


@pytest.mark.parametrize("invalid_previous", ["missing", "wrong_source", "wrong_boundary"])
def test_delete_refuses_invalid_predecessor_chain(db, monkeypatch, invalid_previous):
    first, second, _ending = two_rule_chain(db)
    first_id, second_id = first.id, second.id
    if invalid_previous == "wrong_boundary":
        first.end_key -= 1
        db.commit()
    else:
        original_first = Query.first

        def invalid_locked_previous(query):
            row = original_first(query)
            if query._for_update_arg is not None and row is not None and row.id == first_id:
                if invalid_previous == "missing":
                    return None
                # 在内存返回对象中模拟不一致source，而不提交篡改事实或配置。
                row.id = first_id + 1000
            return row

        monkeypatch.setattr(Query, "first", invalid_locked_previous)
    with pytest.raises(RuleConflictError):
        ScoringRuleService.delete_rule(db, second_id)
    assert db.query(ScoringRule).count() == 2
    assert db.query(ScoringRule).filter(ScoringRule.id == second_id).one().end_key is None


@pytest.mark.parametrize("race", ["new_successor", "target_closed"])
def test_delete_cas_rechecks_no_child_and_open_boundary(db, monkeypatch, race):
    first, second, _ending = two_rule_chain(db)
    first_id, second_id, second_start = first.id, second.id, second.start_key
    original_delete = Query.delete

    def mutate_before_cas(query, *args, **kwargs):
        if race == "new_successor":
            db.add(ScoringRule(name="插入竞争后继", source_rule_id=second_id,
                               start_key=second_start + 1, config=deepcopy(second.config)))
            db.flush()
        else:
            db.query(ScoringRule).filter(ScoringRule.id == second_id).update(
                {ScoringRule.end_key: second_start}, synchronize_session=False,
            )
        return original_delete(query, *args, **kwargs)

    monkeypatch.setattr(Query, "delete", mutate_before_cas)
    with pytest.raises(RuleConflictError):
        ScoringRuleService.delete_rule(db, second_id)
    assert_two_rule_chain_intact(db, first_id, second_id)


def test_delete_and_create_use_latest_then_predecessor_lock_order(db, monkeypatch):
    first, second, _ending = two_rule_chain(db)
    first_id, second_id = first.id, second.id
    original_first = Query.first
    locked_ids = []

    def record_locks(query):
        row = original_first(query)
        if query._for_update_arg is not None and row is not None:
            locked_ids.append(row.id)
        return row

    monkeypatch.setattr(Query, "first", record_locks)
    ScoringRuleService.delete_rule(db, second_id)
    assert locked_ids == [second_id, first_id]


def test_two_sessions_cannot_delete_historical_rule_after_new_publish(db, memory_engine):
    first, second, _ending = two_rule_chain(db)
    second_id = second.id
    winter = add_event(db, 2026, "冬季赛")
    with Session(memory_engine) as stale:
        cached = stale.get(ScoringRule, second_id)
        assert cached.end_key is None
        third = publish(db, second, winter)
        third_id = third.id
        with pytest.raises(RuleConflictError):
            ScoringRuleService.delete_rule(stale, second_id)
    assert db.query(ScoringRule).filter(ScoringRule.id == third_id).one().end_key is None
    assert db.query(ScoringRule).count() == 3


def test_two_sessions_stale_create_after_delete_cannot_recreate_deleted_base(db, memory_engine):
    first, second, ending = two_rule_chain(db)
    second_id, ending_id = second.id, ending.id
    with Session(memory_engine) as stale:
        cached = stale.get(ScoringRule, second_id)
        assert cached.end_key is None
        ScoringRuleService.delete_rule(db, second_id)
        with pytest.raises(RuleConflictError):
            ScoringRuleService.create_rule(stale, ScoringRuleCreate(
                name="旧版本草稿", base_rule_id=second_id, previous_end_event_id=ending_id,
            ))
    assert db.query(ScoringRule).count() == 1


def test_delete_payload_is_snapshot_before_commit_not_republished_state(db, memory_engine, monkeypatch):
    first, second, ending = two_rule_chain(db)
    first_id, second_id, ending_id = first.id, second.id, ending.id
    original_commit = db.commit

    def concurrent_republish():
        original_commit()
        with Session(memory_engine) as writer:
            ScoringRuleService.create_rule(writer, ScoringRuleCreate(
                name="删除后立即再发布", base_rule_id=first_id, previous_end_event_id=ending_id,
            ))

    monkeypatch.setattr(db, "commit", concurrent_republish)
    payload = ScoringRuleService.delete_rule(db, second_id)
    assert payload["restored_rule"]["id"] == first_id
    assert payload["restored_rule"]["end"] is None
    monkeypatch.setattr(db, "commit", original_commit)
    rows = ScoringRuleService.list_rules(db)
    assert len(rows) == 2
    assert rows[0].id > second_id
    assert rows[1].end_key == period_key(2026, "秋季赛")


def test_create_payload_survives_immediate_delete_after_commit(db, memory_engine, monkeypatch):
    first = initial(db)
    ending = add_event(db)
    first_id, ending_id = first.id, ending.id
    original_commit = db.commit
    deleted_ids = []

    def concurrent_delete():
        original_commit()
        with Session(memory_engine) as writer:
            newest = ScoringRuleService.list_rules(writer)[0]
            deleted_ids.append(newest.id)
            ScoringRuleService.delete_rule(writer, newest.id)

    monkeypatch.setattr(db, "commit", concurrent_delete)
    payload = scoring_rules.create_scoring_rule(ScoringRuleCreate(
        name="创建即被删", base_rule_id=first_id, previous_end_event_id=ending_id,
    ), db, {"sub": "admin"})
    assert payload["id"] == deleted_ids[0]
    assert payload["name"] == "创建即被删"
    assert payload["end"] is None
    assert payload["config"]["ranking_points"][0] == 25
    assert db.expire_on_commit is True  # finally恢复调用者原设置。
    monkeypatch.setattr(db, "commit", original_commit)
    assert db.query(ScoringRule).count() == 1


def test_delete_recalculates_annual_points_without_modifying_facts(db):
    first = initial(db)
    autumn = add_event(db, 2026, "秋季赛")
    winter = add_event(db, 2026, "冬季赛")
    changed = deepcopy(first.config)
    changed["ranking_points"][0] = 50
    second = publish(db, first, autumn, changed)
    second_id, first_id = second.id, first.id
    for race in (autumn, winter):
        db.add_all([
            EventConfiguration(event_id=race.id, gender_group="men", bow_type="recurve", distance="30m",
                               individual_participant_count=20, mixed_doubles_team_count=0, team_count=0),
            EventRegistration(year=race.year, season=race.season, name="张三", club="A", distance="30m",
                              competition_bow_type="recurve", points_bow_type="recurve", competition_gender_group="men"),
            Score(event_id=race.id, name="张三", bow_type="recurve", distance="30m", format="ranking", gender_group="men", rank=1),
        ])
    db.commit()
    before_facts = [(row.id, row.event_id, row.name, row.rank) for row in db.query(Score).order_by(Score.id)]
    assert ScoreService.get_yearly_bow_type_ranking(db, 2026, "recurve")[0]["total_points"] == 60
    ScoringRuleService.delete_rule(db, second_id)
    athlete = ScoreService.get_yearly_bow_type_ranking(db, 2026, "recurve")[0]
    assert athlete["total_points"] == 40
    assert [row["scoring_rule_id"] for row in athlete["scores"]] == [first_id, first_id]
    assert before_facts == [(row.id, row.event_id, row.name, row.rank) for row in db.query(Score).order_by(Score.id)]
    assert db.query(EventRegistration).count() == 2
    assert db.query(EventConfiguration).count() == 2
    assert db.query(Event).count() == 2


def test_delete_api_auth_contract_and_error_statuses(client, db, auth_header):
    first = client.get("/api/scoring-rules", headers=auth_header).json()["items"][0]
    ending = add_event(db)
    second = client.post("/api/scoring-rules", headers=auth_header, json={
        "name": "第二版", "base_rule_id": first["id"], "previous_end_event_id": ending.id,
    }).json()
    winter = add_event(db, 2026, "冬季赛")
    third = client.post("/api/scoring-rules", headers=auth_header, json={
        "name": "第三版", "base_rule_id": second["id"], "previous_end_event_id": winter.id,
    }).json()
    endpoint = f"/api/scoring-rules/{third['id']}"
    assert client.delete(endpoint).status_code == 401
    assert client.delete(endpoint, headers={"Authorization": "Bearer invalid"}).status_code == 401
    assert client.delete(f"/api/scoring-rules/{first['id']}", headers=auth_header).status_code == 400
    assert client.delete(f"/api/scoring-rules/{second['id']}", headers=auth_header).status_code == 409
    assert client.delete("/api/scoring-rules/99999", headers=auth_header).status_code == 404
    response = client.delete(endpoint, headers=auth_header)
    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == {"deleted_rule_id", "restored_rule"}
    assert payload["deleted_rule_id"] == third["id"]
    assert payload["restored_rule"] == dict(second, end=None)
    assert client.delete(endpoint, headers=auth_header).status_code == 404
    assert client.delete("/api/scoring-rules/0", headers=auth_header).status_code == 422


def test_delete_and_republish_work_with_foreign_keys_enabled(db, memory_engine):
    with memory_engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=ON")
        connection.commit()
        assert connection.exec_driver_sql("PRAGMA foreign_keys").scalar() == 1
    first, second, ending = two_rule_chain(db)
    second_id, first_id = second.id, first.id
    ScoringRuleService.delete_rule(db, second_id)
    replacement = publish(db, db.get(ScoringRule, first_id), ending)
    assert replacement.id > second_id
    assert replacement.source_rule_id == first_id


def test_delete_response_does_not_query_after_commit(db, monkeypatch):
    _first, second, _ending = two_rule_chain(db)
    second_id = second.id
    original_commit = db.commit
    committed = False
    late_queries = []

    def commit():
        nonlocal committed
        original_commit()
        committed = True

    def record(_conn, _cursor, statement, _parameters, _context, _many):
        if committed:
            late_queries.append(statement)

    monkeypatch.setattr(db, "commit", commit)
    sql_event.listen(db.bind, "before_cursor_execute", record)
    try:
        response = scoring_rules.delete_scoring_rule(second_id, db, {"sub": "admin"})
        assert response["restored_rule"]["end"] is None
    finally:
        sql_event.remove(db.bind, "before_cursor_execute", record)
    assert late_queries == []


def test_delete_clears_identity_map_when_caller_disables_expiration(db):
    first, second, _ending = two_rule_chain(db)
    second_id = second.id
    db.expire_on_commit = False
    ScoringRuleService.delete_rule(db, second_id)
    assert db.get(ScoringRule, second_id) is None
    assert first.end_key is None
    assert db.expire_on_commit is False


@pytest.mark.parametrize("expire", [True, False])
def test_create_commit_failure_restores_session_setting_and_rolls_back(db, monkeypatch, expire):
    first = initial(db)
    ending = add_event(db)
    first_id, ending_id = first.id, ending.id
    db.expire_on_commit = expire
    original_commit = db.commit

    def fail():
        raise RuntimeError("创建提交失败")

    monkeypatch.setattr(db, "commit", fail)
    with pytest.raises(RuntimeError, match="创建提交失败"):
        ScoringRuleService.create_rule(db, ScoringRuleCreate(
            name="提交回滚", base_rule_id=first_id, previous_end_event_id=ending_id,
        ))
    assert db.expire_on_commit is expire
    monkeypatch.setattr(db, "commit", original_commit)
    db.expire_all()
    assert db.query(ScoringRule).count() == 1
    assert db.get(ScoringRule, first_id).end_key is None
