"""分项完整乘算后四舍五入保留一位，再汇总；所有集成数据只存在于独立内存 SQLite。"""
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app.models.dictionary import CompetitionGroupDict
from app.models.event import Event
from app.models.event_configuration import EventConfiguration
from app.models.event_registration import EventRegistration
from app.models.score import Score
from app.routers.scores import get_annual_ranking
from app.services.scoring_calculator import ScoringCalculator


@pytest.mark.parametrize("competition_format", ["ranking", "elimination", "team", "mixed_doubles"])
@pytest.mark.parametrize("coefficient, expected", [(0.6, 0.2), (0.8, 0.2), (1.2, 0.4), (1.4, 0.4)])
def test_all_formats_round_final_c_group_item(competition_format, coefficient, expected):
    individual_counts = {0.6: 8, 0.8: 16, 1.2: 64, 1.4: 128}
    team_counts = {0.6: 2, 0.8: 5, 1.2: 11, 1.4: 15}
    counts = team_counts if competition_format in ("team", "mixed_doubles") else individual_counts

    points = ScoringCalculator.calculate_points(
        rank=20,
        competition_format=competition_format,
        competition_groups={("recurve", "10m"): "C"},
        bow_type="recurve",
        distance="10m",
        participant_count=counts[coefficient],
    )

    # 超出排名限制：1 × 人数系数 × 0.3；0.18 -> 0.2、0.24 -> 0.2、0.36 -> 0.4、0.42 -> 0.4。
    assert points == expected
    assert Decimal(str(points)).as_tuple().exponent >= -1


@pytest.mark.parametrize("participant_count, expected", [(2, 0.1), (4, 0.1)])
def test_small_individual_groups_round_c_group_points(participant_count, expected):
    assert ScoringCalculator.calculate_points(
        rank=20, competition_format="ranking",
        competition_groups={("recurve", "10m"): "C"},
        bow_type="recurve", distance="10m", participant_count=participant_count,
    ) == expected  # 0.06 / 0.12


@pytest.mark.parametrize("base_points, coefficient, group_multiplier, expected", [
    (1, 1, 0.29, 0.3),
    (1, 1, 0.25, 0.3),  # 常规四舍五入，不是银行家舍入的 0.2。
    (1, 0.6, 0.3, 0.2),  # 0.18 -> 0.2。
    (25.82, 0.2, 0.3, 1.5),  # 1.5492 -> 1.5；中途把 5.164 舍为 5.2 会误得 1.6。
    (25.84, 0.2, 0.3, 1.6),  # 1.5504 -> 1.6；提前舍入基础分为 25.8 会误得 1.5。
    (1, 0.3, 0.5, 0.2),  # 十进制 0.15，避免浮点 round 得到 0.1。
])
def test_round_half_up_only_after_complete_item(
    monkeypatch, base_points, coefficient, group_multiplier, expected,
):
    # 注入边界因子验证舍入策略，不修改生产规则表。
    monkeypatch.setattr(ScoringCalculator, "calculate_base_points", staticmethod(lambda *_: base_points))
    monkeypatch.setattr(ScoringCalculator, "get_coefficient_and_cutoff", staticmethod(lambda *_: (coefficient, 8)))
    monkeypatch.setattr(ScoringCalculator, "get_group_multiplier", staticmethod(lambda *_: group_multiplier))

    assert ScoringCalculator.calculate_points(
        rank=1, competition_format="ranking", competition_groups={},
    ) == expected


def test_decimal_product_preserves_exact_tenth():
    # 二进制浮点 19 * 1.4 * 0.5 为 13.299999999999999，舍入后仍为精确的 13.3。
    assert ScoringCalculator.calculate_points(
        rank=3, competition_format="ranking",
        competition_groups={("recurve", "18m"): "B"},
        bow_type="recurve", distance="18m", participant_count=128,
    ) == 13.3


@pytest.fixture
def memory_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    try:
        with Session(engine) as db:
            yield db
    finally:
        engine.dispose()


def add_registration(db, name, season, distance="10m"):
    db.add(EventRegistration(
        year=2024, season=season, name=name, club="测试俱乐部", distance=distance,
        competition_bow_type="recurve", points_bow_type="recurve", competition_gender_group="men",
    ))


@pytest.mark.parametrize("across_seasons", [False, True])
@pytest.mark.parametrize("individual_count, team_count, item_points, total_points, comparison_group", [
    (16, 5, 0.2, 0.6, "A"),
    (8, 2, 0.2, 0.6, "A"),
])
def test_ranking_sums_rounded_items_and_sorts_equal_totals(
    memory_db, across_seasons, individual_count, team_count, item_points, total_points, comparison_group,
):
    db = memory_db
    db.add_all([
        CompetitionGroupDict(group_code="C", bow_type="recurve", distance="10m"),
        CompetitionGroupDict(group_code=comparison_group, bow_type="recurve", distance="30m"),
    ])
    seasons = ["春季赛", "夏季赛", "秋季赛"] if across_seasons else ["春季赛"]
    events = {}
    for season in seasons:
        event = Event(year=2024, season=season)
        db.add(event)
        db.flush()
        events[season] = event
        db.add(EventConfiguration(
            event_id=event.id, gender_group="men", bow_type="recurve", distance="10m",
            individual_participant_count=individual_count,
            mixed_doubles_team_count=team_count, team_count=team_count,
        ))
        add_registration(db, "B", season)

    for index, competition_format in enumerate(["ranking", "elimination", "mixed_doubles"]):
        season = seasons[index] if across_seasons else seasons[0]
        db.add(Score(
            event_id=events[season].id, name="B", bow_type="recurve", distance="10m",
            format=competition_format, gender_group="men", rank=20,
        ))

    # A 的单项与 B 的三个已舍入分项同分；不能让浮点尾差改变姓名次序。
    first_event = events[seasons[0]]
    add_registration(db, "A", seasons[0], "30m")
    add_registration(db, "Z", seasons[0])  # 无成绩选手仍为 0.0。
    db.add(EventConfiguration(
        event_id=first_event.id, gender_group="men", bow_type="recurve", distance="30m",
        individual_participant_count=8, mixed_doubles_team_count=0, team_count=0,
    ))
    db.add(Score(
        event_id=first_event.id, name="A", bow_type="recurve", distance="30m",
        format="ranking", gender_group="men", rank=20,
    ))
    db.commit()

    payload = get_annual_ranking(2024, "recurve", db)
    assert [athlete["name"] for athlete in payload["athletes"]] == ["A", "B", "Z"]
    assert [athlete["ranking"] for athlete in payload["athletes"]] == [1, 2, 3]
    athlete = payload["athletes"][1]
    assert [detail["points"] for detail in athlete["scores"]] == [item_points] * 3
    assert athlete["total_points"] == total_points  # 0.24 × 3 -> 0.6；0.18 × 3 -> 0.6。
    assert payload["athletes"][2]["total_points"] == 0.0
    for season in seasons:
        # 赛季使用年度接口返回的相同已舍入明细，不依赖数据库存储积分。
        season_total = sum(
            (Decimal(str(detail["points"])) for detail in athlete["scores"]
             if detail["event_season"] == f"2024 {season}"), Decimal("0.0"),
        )
        assert season_total == Decimal(str(item_points if across_seasons else total_points))
