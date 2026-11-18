"""管理员规则版本管理；配置发布后只读，仅允许撤销最新非初始版本。"""
from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.scoring_rule import ScoringRuleCreate, ScoringRuleDeleteResult, ScoringRuleList, ScoringRuleRead
from app.security import verify_admin_token
from app.services.scoring_rule_service import RuleConflictError, RuleEventNotFoundError, RuleNotFoundError, ScoringRuleService


router = APIRouter(prefix="/api/scoring-rules", tags=["积分规则"])


@router.get("", response_model=ScoringRuleList)
def list_scoring_rules(db: Session = Depends(get_db), _auth: dict = Depends(verify_admin_token)):
    try:
        rules = ScoringRuleService.list_rules(db)
        # commit会expire ORM对象；先序列化同次查询快照，避免逐行补查与并发混合时间轴。
        payload = {"items": [ScoringRuleService.serialize(rule) for rule in rules]}
        db.commit()  # 兼容空表时的首次引导；此后纯读取不可变快照。
        return payload
    except Exception:
        db.rollback()
        raise


@router.post("", response_model=ScoringRuleRead, status_code=status.HTTP_201_CREATED)
def create_scoring_rule(
    request: ScoringRuleCreate,
    db: Session = Depends(get_db),
    _auth: dict = Depends(verify_admin_token),
):
    try:
        return ScoringRuleService.serialize(ScoringRuleService.create_rule(db, request))
    except RuleConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except RuleEventNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{rule_id}", response_model=ScoringRuleDeleteResult)
def delete_scoring_rule(
    rule_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
    _auth: dict = Depends(verify_admin_token),
):
    try:
        return ScoringRuleService.delete_rule(db, rule_id)
    except RuleNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuleConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
