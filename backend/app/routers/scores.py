"""
成绩 API 路由
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.score import (
    ScoreCreate, ScoreUpdate, ScoreRead, ScoreList, ScoreBatchImport
)
from app.services.score_service import ScoreService

router = APIRouter(prefix="/api/scores", tags=["成绩管理"])


@router.post("", response_model=ScoreRead, summary="录入成绩")
def create_score(score: ScoreCreate, db: Session = Depends(get_db)):
    """录入单条成绩"""
    try:
        return ScoreService.create_score(db, score)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建失败：{str(e)}")


@router.get("/{score_id}", response_model=ScoreRead, summary="获取成绩详情")
def get_score(score_id: int, db: Session = Depends(get_db)):
    """获取单条成绩详情"""
    score = ScoreService.get_score_by_id(db, score_id)
    if not score:
        raise HTTPException(status_code=404, detail="成绩不存在")
    return score


@router.get("", response_model=ScoreList, summary="获取成绩列表")
def list_scores(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    athlete_id: int = Query(None),
    year: int = Query(None),
    season: str = Query(None),
    distance: str = Query(None),
    competition_format: str = Query(None),
    is_valid: int = Query(1),
    db: Session = Depends(get_db)
):
    """获取成绩列表，支持多条件筛选"""
    skip = (page - 1) * page_size
    scores, total = ScoreService.list_scores(
        db,
        skip=skip,
        limit=page_size,
        athlete_id=athlete_id,
        year=year,
        season=season,
        distance=distance,
        competition_format=competition_format,
        is_valid=is_valid
    )
    return ScoreList(
        items=scores,
        total=total,
        page=page,
        page_size=page_size
    )


@router.put("/{score_id}", response_model=ScoreRead, summary="更新成绩")
def update_score(
    score_id: int,
    score_update: ScoreUpdate,
    db: Session = Depends(get_db)
):
    """更新成绩信息"""
    score = ScoreService.update_score(db, score_id, score_update)
    if not score:
        raise HTTPException(status_code=404, detail="成绩不存在")
    return score


@router.delete("/{score_id}", summary="删除成绩")
def delete_score(score_id: int, db: Session = Depends(get_db)):
    """删除成绩"""
    success = ScoreService.delete_score(db, score_id)
    if not success:
        raise HTTPException(status_code=404, detail="成绩不存在")
    return {"message": "成绩已删除"}


@router.post("/batch/import", response_model=list[ScoreRead], summary="批量导入成绩")
def batch_import_scores(
    batch_import: ScoreBatchImport,
    db: Session = Depends(get_db)
):
    """批量导入成绩"""
    try:
        return ScoreService.batch_create_scores(db, batch_import.scores)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败：{str(e)}")


@router.post("/recalculate", summary="重新计算所有成绩的积分")
def recalculate_scores(db: Session = Depends(get_db)):
    """重新计算所有成绩的积分"""
    try:
        count = ScoreService.recalculate_all_scores(db)
        return {"message": f"已重新计算 {count} 条成绩的积分"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"重新计算失败：{str(e)}")


@router.get("/athlete/{athlete_id}/scores", response_model=list[ScoreRead], summary="获取运动员成绩")
def get_athlete_scores(
    athlete_id: int,
    year: int = Query(None),
    season: str = Query(None),
    db: Session = Depends(get_db)
):
    """获取运动员的所有成绩"""
    scores = ScoreService.get_athlete_scores(db, athlete_id, year, season)
    return scores
