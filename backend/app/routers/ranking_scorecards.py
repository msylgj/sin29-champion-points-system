"""管理员记分纸导出：数据仅驻留请求内存，赛事标题由数据库身份决定。"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.event import Event
from app.security import verify_admin_token
from app.services.ranking_scorecard_pdf import ScorecardFontUnavailable, ScorecardUnsupportedText, build_ranking_scorecards


Text = Annotated[str, Field(strict=True, max_length=120)]
router = APIRouter(prefix="/api/events", tags=["记分纸"])


class ScorecardPosition(BaseModel):
    model_config = ConfigDict(extra="forbid")
    target: Text
    club: Text
    athlete: Text


class ScorecardPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    group: Text
    round: Text
    positions: list[ScorecardPosition] = Field(min_length=4, max_length=4)

    @field_validator("group", "round")
    @classmethod
    def require_header(cls, value):
        if not value.strip():
            raise ValueError("组别和轮次不得为空")
        return value.strip()

    @model_validator(mode="after")
    def require_target(self):
        if not any(position.target.strip() for position in self.positions):
            raise ValueError("每页至少需要一个靶位")
        return self


class RankingScorecardRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    pages: list[ScorecardPage] = Field(min_length=1, max_length=300)


@router.post("/{event_id}/ranking-scorecards", response_class=Response)
def ranking_scorecards(
    event_id: int,
    request: RankingScorecardRequest,
    db: Session = Depends(get_db),
    _auth: dict = Depends(verify_admin_token),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if event is None:
        raise HTTPException(status_code=404, detail="赛事不存在")
    try:
        content = build_ranking_scorecards(event.year, event.season, request)
    except ScorecardFontUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ScorecardUnsupportedText as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return Response(content=content, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="ranking-scorecards-{event.id}.pdf"',
        "Cache-Control": "no-store",
    })
