"""
成绩 API 路由 - 简化版本
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.score import (
    ScoreUpdate, ScoreRead, ScoreList, ScoreBatchImport
)
from app.services.score_service import ScoreService
from app.security import verify_admin_token

router = APIRouter(prefix="/api/scores", tags=["成绩管理"])


@router.get("", response_model=ScoreList, summary="获取成绩列表")
def list_scores(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    event_id: int = Query(None),
    bow_type: str = Query(None),
    format: str = Query(None),
    name: str = Query(None),
    db: Session = Depends(get_db),
    _auth: dict = Depends(verify_admin_token)
):
    """获取成绩列表，支持多条件筛选"""
    skip = (page - 1) * page_size
    scores, total = ScoreService.list_scores(
        db,
        skip=skip,
        limit=page_size,
        event_id=event_id,
        bow_type=bow_type,
        format=format,
        name=name
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
    db: Session = Depends(get_db),
    _auth: dict = Depends(verify_admin_token)
):
    """更新成绩信息"""
    try:
        score = ScoreService.update_score(db, score_id, score_update)
        if not score:
            raise HTTPException(status_code=404, detail="成绩不存在")
        return score
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新失败：{str(e)}")


@router.delete("/{score_id}", summary="删除成绩")
def delete_score(
    score_id: int,
    db: Session = Depends(get_db),
    _auth: dict = Depends(verify_admin_token)
):
    """删除单条成绩"""
    ok = ScoreService.delete_score(db, score_id)
    if not ok:
        raise HTTPException(status_code=404, detail="成绩不存在")
    return {"detail": "删除成功"}


@router.post("/batch/import", response_model=list[ScoreRead], summary="批量导入成绩")
def batch_import_scores(
    batch_import: ScoreBatchImport,
    db: Session = Depends(get_db),
    _auth: dict = Depends(verify_admin_token)
):
    """批量导入成绩"""
    try:
        return ScoreService.batch_create_scores(db, batch_import.scores)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败：{str(e)}")


@router.get("/annual-ranking/{year}/{bow_type}", summary="获取年度弓种积分排名")
def get_annual_ranking(
    year: int,
    bow_type: str,
    db: Session = Depends(get_db)
):
    """获取某年度某弓种的年度积分排名（跨赛事、距离、格式聚合）
    
    返回该弓种在该年度的所有选手及其总积分排名，前8名标记为突出显示
    """
    try:
        ranking = ScoreService.get_yearly_bow_type_ranking(db, year, bow_type)
        return {
            "year": year,
            "bow_type": bow_type,
            "athletes": ranking,
            "total": len(ranking)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取排名失败：{str(e)}")
