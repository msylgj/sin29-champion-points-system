"""API integration: validate real 27-person draws without writing event data."""
import re

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event as sql_event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.models.dictionary import BowTypeDict, DistanceDict
from app.models.event import Event
from app.routers import elimination_scorecards as routes
from app.security import create_admin_access_token
from app.services import ranking_scorecard_pdf as shared


@pytest.fixture
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    for model in (Event, BowTypeDict, DistanceDict):
        model.__table__.create(engine)
    with Session(engine) as db:
        db.add_all([
            Event(id=42, year=2026, season="秋季赛"),
            BowTypeDict(code="recurve", name="反曲弓"),
            BowTypeDict(code="compound", name="复合弓"),
            DistanceDict(code="10m", name="10米"),
        ])
        db.commit()
    statements = []
    sql_event.listen(engine, "before_cursor_execute", lambda conn, cur, statement, params, ctx, many: statements.append(statement))

    def isolated_db():
        with Session(engine) as db:
            yield db

    app = FastAPI()
    app.include_router(routes.router)
    app.dependency_overrides[get_db] = isolated_db
    app.state.statements = statements
    with TestClient(app) as value:
        yield value
    engine.dispose()


@pytest.fixture
def admin():
    return {"Authorization": f"Bearer {create_admin_access_token()}"}


@pytest.fixture
def payload():
    return {"bow_type": "recurve", "distance": "10m", "gender_group": "mixed", "participant_count": 27,
            "ranges": {"1/16": [1, 11], "1/8": [1, 8], "1/4": [1, 4], "1/2": [1, 2], "bronze": [3, 3], "gold": [1, 1]}}


@pytest.mark.parametrize("bow_type, bow_name, score_header", [
    ("recurve", "反曲弓", "局分"),
    ("compound", "复合弓", "累计"),
])
def test_plan_and_pdf_for_27_share_one_bracket(client, admin, payload, monkeypatch, bow_type, bow_name, score_header):
    captured = []
    headers = []
    renderer = routes.build_elimination_scorecards
    fit_text = shared._fit_text

    def render(year, season, group, cards, **kwargs):
        captured.append((year, season, group, cards))
        return renderer(year, season, group, cards, **kwargs)

    def record_header(pdf, text, *args, **kwargs):
        if text in ("局分", "累计"):
            headers.append(text)
        return fit_text(pdf, text, *args, **kwargs)

    monkeypatch.setattr(routes, "build_elimination_scorecards", render)
    monkeypatch.setattr(shared, "_fit_text", record_header)
    payload["bow_type"] = bow_type
    plan = client.get("/api/events/42/elimination-rounds?participant_count=27", headers=admin)
    assert plan.status_code == 200
    assert [(item["key"], item["target_counts"]) for item in plan.json()["rounds"]] == [
        ("1/16", [11, 22]), ("1/8", [8, 16]), ("1/4", [4, 8]), ("1/2", [2, 4]), ("bronze", [1, 2]), ("gold", [1, 2])]
    response = client.post("/api/events/42/elimination-scorecards", headers=admin, json=payload)
    assert response.status_code == 200, response.text[:180]
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["cache-control"] == "no-store"
    assert len(re.findall(rb"/Type\s*/Page\b", response.content)) == 27
    year, season, group, cards = captured[0]
    assert (year, season, group) == (2026, "秋季赛", f"10米{bow_name}")
    assert headers == [score_header] * (27 * 6)
    assert [card["1/16"] for card in cards[:5]] == ["轮空"] * 5
    assert (cards[16]["1/16"], cards[15]["1/16"]) == ("1左", "1右")
    assert cards[0]["1/8"] == "1左"
    assert cards[16]["1/8"] == cards[15]["1/8"] == "1右"
    assert all(statement.lstrip().startswith("SELECT") for statement in client.app.state.statements)


@pytest.mark.parametrize("change", ["wrong_count", "backwards", "missing_round", "other_round", "range_limit", "numeric_string", "no_bow", "bad_group", "too_many"])
def test_invalid_plan_cannot_produce_pdf(client, admin, payload, change, monkeypatch):
    monkeypatch.setattr(routes, "build_elimination_scorecards", lambda *args, **kwargs: pytest.fail("invalid plan reached PDF builder"))
    if change == "wrong_count": payload["ranges"]["1/16"] = [1, 12]
    if change == "backwards": payload["ranges"]["1/16"] = [11, 1]
    if change == "missing_round": payload["ranges"].pop("bronze")
    if change == "other_round": payload["ranges"]["1/32"] = [1, 16]
    if change == "range_limit": payload["ranges"]["1/16"] = [89, 100]
    if change == "numeric_string": payload["ranges"]["1/16"] = ["1", 11]
    if change == "no_bow": payload["bow_type"] = "unknown"
    if change == "bad_group": payload["gender_group"] = "other"
    if change == "too_many": payload["participant_count"] = 129
    response = client.post("/api/events/42/elimination-scorecards", headers=admin, json=payload)
    assert response.status_code == 422
    if change == "wrong_count":
        detail = response.json()["detail"]
        assert all(part in detail for part in ("1/16", "11", "22"))


def test_auth_event_and_count_limits(client, admin, payload):
    assert client.get("/api/events/42/elimination-rounds?participant_count=27").status_code == 401
    assert client.post("/api/events/42/elimination-scorecards", json=payload).status_code == 401
    assert client.get("/api/events/404/elimination-rounds?participant_count=27", headers=admin).status_code == 404
    assert client.post("/api/events/404/elimination-scorecards", headers=admin, json=payload).status_code == 404
    assert client.get("/api/events/42/elimination-rounds?participant_count=1", headers=admin).status_code == 422
    maximum = client.get("/api/events/42/elimination-rounds?participant_count=128", headers=admin).json()
    assert maximum["rounds"][0] == {"key": "1/64", "label": "1/64", "target_counts": [64, 128]}


@pytest.mark.parametrize("bow_type, bow_name", [("recurve", "反曲弓"), ("compound", "复合弓")])
@pytest.mark.parametrize("gender_group, suffix", [("mixed", ""), ("men", " 男子组"), ("women", " 女子组")])
def test_pdf_group_label_omits_only_mixed_without_a_separator(client, admin, payload, monkeypatch, bow_type, bow_name, gender_group, suffix):
    captured = []
    fit_text = shared._fit_text

    def record(pdf, text, *args, **kwargs):
        captured.append(str(text))
        return fit_text(pdf, text, *args, **kwargs)

    monkeypatch.setattr(shared, "_fit_text", record)
    payload.update(bow_type=bow_type, gender_group=gender_group, participant_count=2, ranges={"gold": [17, 17]})
    response = client.post("/api/events/42/elimination-scorecards", headers=admin, json=payload)
    assert response.status_code == 200
    expected = f"10米{bow_name}{suffix}"
    assert captured.count(expected) == 2
    if gender_group == "mixed":
        assert not any("混合组" in text for text in captured)
        assert f"{expected} " not in captured
    assert routes.GROUP_LABELS["mixed"] == "混合组"  # UI选项/分组契约不改，仅打印时省略。
    assert payload["gender_group"] == gender_group
    assert all(statement.lstrip().startswith("SELECT") for statement in client.app.state.statements)

@pytest.mark.parametrize("format_name, bow_type", [("team", "recurve"), ("mixed_team", "compound")])
def test_team_final_requires_distinct_targets_and_renders_one_pdf_page(client, admin, format_name, bow_type):
    url = "/api/events/42"
    plan = client.get(url + "/elimination-rounds", headers=admin, params={"participant_count": 2, "competition_format": format_name})
    assert plan.json() == {"participant_count": 2, "rounds": [{"key": "gold", "label": "金牌赛", "target_counts": [2]}]}
    data = {"bow_type": bow_type, "distance": "10m", "gender_group": "mixed", "participant_count": 2,
            "competition_format": format_name, "ranges": {"gold": [39, 39]}}
    assert client.post(url + "/elimination-scorecards", headers=admin, json=data).status_code == 422
    data["ranges"]["gold"] = [39, 40]
    response = client.post(url + "/elimination-scorecards", headers=admin, json=data)
    assert response.status_code == 200, response.text[:180]
    assert response.headers["content-type"] == "application/pdf"
    assert len(re.findall(rb"/Type\s*/Page\b", response.content)) == 1
    assert all(statement.lstrip().startswith("SELECT") for statement in client.app.state.statements)


def test_team_plan_excludes_byes_and_never_offers_a_shared_target(client, admin):
    response = client.get("/api/events/42/elimination-rounds", headers=admin,
                          params={"participant_count": 17, "competition_format": "team"})
    assert response.status_code == 200
    assert [(item["key"], item["target_counts"]) for item in response.json()["rounds"]] == [
        ("1/16", [2]), ("1/8", [16]), ("1/4", [8]), ("1/2", [4]), ("bronze", [2]), ("gold", [2]),
    ]
