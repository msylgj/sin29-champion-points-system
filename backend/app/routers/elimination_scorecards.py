"""管理员个人淘汰赛手卡：只读字典与赛事，现算靶位并下载 PDF。"""
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.dictionary import BowTypeDict, DistanceDict
from app.models.event import Event
from app.security import verify_admin_token
from app.services.elimination_bracket import assign_elimination_targets, elimination_rounds
from app.services.elimination_scorecard_pdf import build_elimination_scorecards
from app.services.ranking_scorecard_pdf import ScorecardFontUnavailable


router = APIRouter(prefix="/api/events", tags=["记分纸"])
Round = Literal["1/64", "1/32", "1/16", "1/8", "1/4", "1/2", "bronze", "gold"]
Target = Annotated[int, Field(strict=True, ge=1, le=99)]
GROUP_LABELS = {"men": "男子组", "women": "女子组", "mixed": "混合组"}
MEDAL_LABELS = {"bronze": "铜牌赛", "gold": "金牌赛"}


class EliminationScorecardRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    bow_type: str = Field(strict=True, min_length=1, max_length=50)
    distance: str = Field(strict=True, min_length=1, max_length=10)
    gender_group: Literal["men", "women", "mixed"]
    participant_count: int = Field(strict=True, ge=2, le=128)
    ranges: dict[Round, tuple[Target, Target]] = Field(min_length=1, max_length=8)


def _event(db, event_id):
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="赛事不存在")
    return event


@router.get("/{event_id}/elimination-rounds")
def get_elimination_rounds(
    event_id: int,
    participant_count: Annotated[int, Query(ge=2, le=128)],
    db: Session = Depends(get_db),
    _auth: dict = Depends(verify_admin_token),
):
    _event(db, event_id)
    return {"participant_count": participant_count, "rounds": [
        {"key": key, "label": MEDAL_LABELS.get(key, key), "target_counts": counts}
        for key, counts in elimination_rounds(participant_count).items()
    ]}


@router.post("/{event_id}/elimination-scorecards", response_class=Response)
def elimination_scorecards(
    event_id: int,
    request: EliminationScorecardRequest,
    db: Session = Depends(get_db),
    _auth: dict = Depends(verify_admin_token),
):
    event = _event(db, event_id)
    bow = db.query(BowTypeDict).filter_by(code=request.bow_type).first()
    distance = db.query(DistanceDict).filter_by(code=request.distance).first()
    if bow is None or distance is None:
        raise HTTPException(status_code=422, detail="请选择有效的弓种和距离")
    group = f"{distance.name}{bow.name}"
    if request.gender_group != "mixed":
        group += f" {GROUP_LABELS[request.gender_group]}"
    try:
        cards = assign_elimination_targets(request.participant_count, request.ranges)
        content = build_elimination_scorecards(event.year, event.season, group, cards, bow_type=bow.code)
    except ScorecardFontUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return Response(content=content, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="elimination-scorecards-{event.id}.pdf"',
        "Cache-Control": "no-store",
    })
