"""保守收敛回归：旧校验入口/错误字符串/非空更新与事务边界保持不变。"""
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from pydantic import ValidationError

from app.schemas import event_configuration, event_registration, score
from app.schemas._validation import validate_choice
from app.services._updates import apply_non_null_updates
from app.services.event_configuration_service import EventConfigurationService
from app.services.event_registration_service import EventRegistrationService
from app.services.score_service import ScoreService


VALIDATORS = [
    (score, "_validate_bow_type", "VALID_BOW_TYPES", "弓种"),
    (score, "_validate_distance", "VALID_DISTANCES", "距离"),
    (score, "_validate_format", "VALID_FORMATS", "比赛类型"),
    (score, "_validate_gender_group", "VALID_GENDER_GROUPS", "分组"),
    (event_configuration, "_validate_bow_type", "VALID_BOW_TYPES", "弓种"),
    (event_configuration, "_validate_distance", "VALID_DISTANCES", "距离"),
    (event_configuration, "_validate_gender_group", "VALID_GENDER_GROUPS", "比赛性别分组"),
    (event_registration, "_validate_season", "VALID_SEASONS", "赛季"),
    (event_registration, "_validate_distance", "VALID_DISTANCES", "距离"),
    (event_registration, "_validate_competition_bow_type", "VALID_COMPETITION_BOW_TYPES", "比赛弓种"),
    (event_registration, "_validate_points_bow_type", "VALID_POINTS_BOW_TYPES", "积分弓种"),
    (event_registration, "_validate_gender_group", "VALID_GENDER_GROUPS", "分组"),
]


@pytest.mark.parametrize("module, name, choices_name, label", VALIDATORS)
def test_legacy_validation_entrypoints_preserve_options_and_exact_errors(module, name, choices_name, label):
    validator = getattr(module, name)
    choices = getattr(module, choices_name)
    assert isinstance(choices, list)
    for choice in choices:
        assert validator(choice) is choice
    for invalid in ("invalid", None, "", " recurve "):
        with pytest.raises(ValueError) as exc_info:
            validator(invalid)
        assert str(exc_info.value) == f"{label}必须是 {choices}"


def test_schema_local_choice_lists_remain_independent_and_monkeypatchable(monkeypatch):
    assert score.VALID_BOW_TYPES is not event_configuration.VALID_BOW_TYPES
    assert score.VALID_DISTANCES is not event_registration.VALID_DISTANCES
    monkeypatch.setattr(score, "VALID_BOW_TYPES", ["custom"])
    assert score._validate_bow_type("custom") == "custom"
    assert event_configuration._validate_bow_type("recurve") == "recurve"
    with pytest.raises(ValueError, match="弓种必须是"):
        score._validate_bow_type("recurve")


@pytest.mark.parametrize("model, payload, field, label, choices", [
    (score.ScoreCreate, {"event_id": 1, "name": "张三", "bow_type": "bad", "distance": "30m", "format": "ranking", "rank": 1},
     "bow_type", "弓种", score.VALID_BOW_TYPES),
    (score.ScoreUpdate, {"gender_group": "bad"}, "gender_group", "分组", score.VALID_GENDER_GROUPS),
    (event_configuration.EventConfigurationBase, {"event_id": 1, "gender_group": "bad", "bow_type": "recurve", "distance": "30m"},
     "gender_group", "比赛性别分组", event_configuration.VALID_GENDER_GROUPS),
    (event_configuration.EventConfigurationCreate, {"gender_group": "men", "bow_type": "recurve", "distance": "bad"},
     "distance", "距离", event_configuration.VALID_DISTANCES),
    (event_registration.EventRegistrationCreate, {"year": 2026, "season": "春季赛", "name": "张三", "club": "A", "distance": "30m",
                                               "competition_bow_type": "recurve", "points_bow_type": "bad", "competition_gender_group": "men"},
     "points_bow_type", "积分弓种", event_registration.VALID_POINTS_BOW_TYPES),
    (event_registration.EventRegistrationUpdate, {"competition_bow_type": "bad"},
     "competition_bow_type", "比赛弓种", event_registration.VALID_COMPETITION_BOW_TYPES),
])
def test_pydantic_validation_error_contract_is_unchanged(model, payload, field, label, choices):
    with pytest.raises(ValidationError) as exc_info:
        model(**payload)
    assert exc_info.value.errors(include_url=False, include_context=False) == [{
        "type": "value_error", "loc": (field,), "msg": f"Value error, {label}必须是 {choices}", "input": "bad",
    }]


def test_choice_helper_does_not_normalize_or_accept_none():
    choices = ["A", "B"]
    assert validate_choice("A", choices, "组别") == "A"
    with pytest.raises(ValueError) as exc_info:
        validate_choice(None, choices, "组别")
    assert str(exc_info.value) == "组别必须是 ['A', 'B']"


def test_non_null_update_only_applies_explicit_fields_in_original_order():
    writes = []

    class Target:
        def __setattr__(self, name, value):
            writes.append((name, value))
            object.__setattr__(self, name, value)

    target = Target()
    update = SimpleNamespace(count=0, name="", keep=None, forbidden="unexpected")
    apply_non_null_updates(target, update, ("count", "keep", "name"))
    assert writes == [("count", 0), ("name", "")]
    assert not hasattr(target, "forbidden")
    assert not hasattr(target, "keep")


def session_for(target, duplicate=None):
    db = MagicMock()
    db.query.return_value.filter.return_value.first.side_effect = [target, duplicate]
    return db


def test_configuration_update_keeps_none_writes_zero_and_retains_commit_refresh_boundary():
    target = SimpleNamespace(individual_participant_count=20, mixed_doubles_team_count=6, team_count=4)
    db = session_for(target)
    result = EventConfigurationService.update_configuration(db, 5, event_configuration.EventConfigurationUpdate(
        individual_participant_count=0, mixed_doubles_team_count=None,
    ))
    assert result is target
    assert vars(target) == {"individual_participant_count": 0, "mixed_doubles_team_count": 6, "team_count": 4}
    assert db.query.call_count == 1
    db.commit.assert_called_once_with()
    db.refresh.assert_called_once_with(target)


def test_score_update_preserves_explicit_none_and_duplicate_query_boundary():
    target = SimpleNamespace(event_id=7, name="张三", bow_type="recurve", distance="30m", format="ranking", gender_group="men", rank=2)
    db = session_for(target)
    result = ScoreService.update_score(db, 5, score.ScoreUpdate(name="李四", gender_group=None, rank=1))
    assert result is target
    assert target.name == "李四"
    assert target.gender_group == "men"
    assert target.rank == 1
    assert target.event_id == 7
    assert db.query.call_count == 2
    db.commit.assert_called_once_with()
    db.refresh.assert_called_once_with(target)


def test_registration_update_keeps_points_resolution_and_count_sync_after_commit(monkeypatch):
    target = SimpleNamespace(year=2026, season="春季赛", name="张三", club="A", distance="30m", competition_bow_type="recurve",
                             competition_gender_group="men", points_bow_type="recurve")
    db = session_for(target)
    calls = []
    db.commit.side_effect = lambda: calls.append("commit")
    db.refresh.side_effect = lambda row: calls.append(("refresh", row))

    def sync(session, year, season):
        assert session is db
        calls.append(("sync", year, season))

    monkeypatch.setattr(EventConfigurationService, "sync_individual_counts_from_registrations", sync)
    result = EventRegistrationService.update_registration(db, 5, event_registration.EventRegistrationUpdate(
        name=None, club="B", distance="18m", competition_gender_group=None, points_bow_type="barebow",
    ))
    assert result is target
    assert target.name == "张三"
    assert target.club == "B"
    assert target.distance == "18m"
    assert target.competition_gender_group == "men"
    assert target.points_bow_type == "recurve"  # 非无瞄弓按原规则覆盖积分弓种。
    assert db.query.call_count == 2
    assert calls == ["commit", ("sync", 2026, "春季赛"), ("refresh", target)]


@pytest.mark.parametrize("service, update", [
    (ScoreService.update_score, score.ScoreUpdate()),
    (EventConfigurationService.update_configuration, event_configuration.EventConfigurationUpdate()),
    (EventRegistrationService.update_registration, event_registration.EventRegistrationUpdate()),
])
def test_missing_update_row_still_returns_none_without_commit(service, update):
    db = session_for(None)
    assert service(db, 999, update) is None
    assert db.query.call_count == 1
    db.commit.assert_not_called()
    db.refresh.assert_not_called()


@pytest.mark.parametrize("kind, message", [("score", "该成绩已存在，请勿重复保存"), ("registration", "该报名已存在，请勿重复保存")])
def test_duplicate_update_keeps_exact_error_and_does_not_commit(kind, message):
    if kind == "score":
        target = SimpleNamespace(event_id=7, name="张三", bow_type="recurve", distance="30m", format="ranking", gender_group="men", rank=1)
        service, update = ScoreService.update_score, score.ScoreUpdate(name="重复")
    else:
        target = SimpleNamespace(year=2026, season="春季赛", name="张三", club="A", distance="30m", competition_bow_type="recurve",
                                 competition_gender_group="men", points_bow_type="recurve")
        service, update = EventRegistrationService.update_registration, event_registration.EventRegistrationUpdate(name="重复")
    db = session_for(target, duplicate=object())
    with pytest.raises(ValueError) as exc_info:
        service(db, 5, update)
    assert str(exc_info.value) == message
    assert db.query.call_count == 2
    db.commit.assert_not_called()
    db.refresh.assert_not_called()
