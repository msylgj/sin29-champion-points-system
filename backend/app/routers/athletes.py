"""
运动员 API 路由
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.athlete import (
    AthleteCreate, AthleteUpdate, AthleteRead, AthleteList, AthleteBatchImport
)
from app.services.athlete_service import AthleteService

router = APIRouter(prefix="/api/athletes", tags=["运动员管理"])


@router.post("", response_model=AthleteRead, summary="创建运动员")
def create_athlete(athlete: AthleteCreate, db: Session = Depends(get_db)):
    """创建新运动员"""
    # 检查身份证号是否已存在
    existing = AthleteService.get_athlete_by_id_number(db, athlete.id_number)
    if existing:
        raise HTTPException(status_code=400, detail="该身份证号已存在")

    return AthleteService.create_athlete(db, athlete)


@router.get("/{athlete_id}", response_model=AthleteRead, summary="获取运动员详情")
def get_athlete(athlete_id: int, db: Session = Depends(get_db)):
    """获取单个运动员的详细信息"""
    athlete = AthleteService.get_athlete_by_id(db, athlete_id)
    if not athlete:
        raise HTTPException(status_code=404, detail="运动员不存在")
    return athlete


@router.get("", response_model=AthleteList, summary="获取运动员列表")
def list_athletes(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: str = Query(None),
    gender: str = Query(None),
    db: Session = Depends(get_db)
):
    """获取运动员列表，支持分页和搜索"""
    skip = (page - 1) * page_size
    athletes, total = AthleteService.list_athletes(
        db, skip=skip, limit=page_size, search=search, gender=gender
    )
    return AthleteList(
        items=athletes,
        total=total,
        page=page,
        page_size=page_size
    )


@router.put("/{athlete_id}", response_model=AthleteRead, summary="更新运动员信息")
def update_athlete(
    athlete_id: int,
    athlete_update: AthleteUpdate,
    db: Session = Depends(get_db)
):
    """更新运动员信息"""
    athlete = AthleteService.update_athlete(db, athlete_id, athlete_update)
    if not athlete:
        raise HTTPException(status_code=404, detail="运动员不存在")
    return athlete


@router.delete("/{athlete_id}", summary="删除运动员")
def delete_athlete(athlete_id: int, db: Session = Depends(get_db)):
    """删除运动员"""
    success = AthleteService.delete_athlete(db, athlete_id)
    if not success:
        raise HTTPException(status_code=404, detail="运动员不存在")
    return {"message": "运动员已删除"}


@router.post("/batch/import", response_model=list[AthleteRead], summary="批量导入运动员")
def batch_import_athletes(
    batch_import: AthleteBatchImport,
    db: Session = Depends(get_db)
):
    """批量导入运动员"""
    try:
        return AthleteService.batch_create_athletes(db, batch_import.athletes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败：{str(e)}")
