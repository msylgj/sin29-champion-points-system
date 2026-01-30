"""
统计和排名 API 路由
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from app.database import get_db
from app.models.score import Score
from app.models.athlete import Athlete
from app.schemas.aggregate_points import RankingRead, RankingList

router = APIRouter(prefix="/api/stats", tags=["统计和排名"])


@router.get("/rankings", response_model=RankingList, summary="获取排名列表")
def get_rankings(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    year: int = Query(..., description="年度"),
    season: str = Query(None, description="季度（可选）"),
    gender_group: str = Query(None, description="性别分组（可选）"),
    bow_type: str = Query(None, description="弓种（可选）"),
    db: Session = Depends(get_db)
):
    """
    获取排名列表

    支持按年度、季度、性别分组、弓种进行筛选
    """
    query = db.query(
        Score.athlete_id,
        Athlete.name,
        Athlete.phone,
        Athlete.gender,
        func.sum(Score.points).label('total_points'),
        func.count(Score.id).label('event_count'),
        func.avg(Score.rank).label('average_rank'),
        func.max(Score.raw_score).label('best_score')
    ).join(Athlete, Score.athlete_id == Athlete.id).filter(
        Score.year == year,
        Score.is_valid == 1
    )

    if season:
        query = query.filter(Score.season == season)
    if gender_group:
        query = query.filter(Score.gender_group == gender_group)
    if bow_type:
        query = query.filter(Score.bow_type == bow_type)

    query = query.group_by(Score.athlete_id, Athlete.name, Athlete.phone, Athlete.gender)
    query = query.order_by(desc('total_points'))

    total = len(query.all())
    skip = (page - 1) * page_size

    results = query.offset(skip).limit(page_size).all()

    items = []
    for rank, result in enumerate(results, start=skip + 1):
        items.append(RankingRead(
            rank=rank,
            athlete_id=result.athlete_id,
            athlete_name=result.name,
            phone=result.phone,
            gender=result.gender,
            total_points=float(result.total_points or 0),
            event_count=int(result.event_count or 0),
            best_score=int(result.best_score or 0) if result.best_score else None,
            average_rank=float(result.average_rank or 0) if result.average_rank else None
        ))

    return RankingList(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        year=year,
        season=season,
        gender_group=gender_group,
        bow_type=bow_type
    )


@router.get("/athlete/{athlete_id}/aggregate", summary="获取运动员积分汇总")
def get_athlete_aggregate(
    athlete_id: int,
    year: int = Query(..., description="年度"),
    season: str = Query(None, description="季度（可选）"),
    db: Session = Depends(get_db)
):
    """获取运动员在指定年度/季度的积分汇总"""
    query = db.query(
        func.sum(Score.points).label('total_points'),
        func.count(Score.id).label('event_count'),
        func.avg(Score.rank).label('average_rank'),
        func.max(Score.raw_score).label('best_score')
    ).filter(
        Score.athlete_id == athlete_id,
        Score.year == year,
        Score.is_valid == 1
    )

    if season:
        query = query.filter(Score.season == season)

    result = query.first()

    if not result or result.total_points is None:
        raise HTTPException(status_code=404, detail="未找到该运动员的成绩数据")

    return {
        "athlete_id": athlete_id,
        "year": year,
        "season": season,
        "total_points": float(result.total_points or 0),
        "event_count": int(result.event_count or 0),
        "average_rank": float(result.average_rank or 0) if result.average_rank else None,
        "best_score": int(result.best_score or 0) if result.best_score else None
    }


@router.get("/top-performers", summary="获取绩效最优者")
def get_top_performers(
    year: int = Query(..., description="年度"),
    season: str = Query(None, description="季度（可选）"),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """获取指定时期的绩效最优者"""
    query = db.query(
        Score.athlete_id,
        Athlete.name,
        func.sum(Score.points).label('total_points'),
        func.count(Score.id).label('event_count')
    ).join(Athlete, Score.athlete_id == Athlete.id).filter(
        Score.year == year,
        Score.is_valid == 1
    )

    if season:
        query = query.filter(Score.season == season)

    results = query.group_by(
        Score.athlete_id, Athlete.name
    ).order_by(desc('total_points')).limit(limit).all()

    return [
        {
            "athlete_id": r.athlete_id,
            "athlete_name": r.name,
            "total_points": float(r.total_points or 0),
            "event_count": int(r.event_count or 0)
        }
        for r in results
    ]
