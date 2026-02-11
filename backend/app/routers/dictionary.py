"""
字典表 API 路由 - 获取下拉选项数据
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.dictionary import BowTypeDict, DistanceDict, CompetitionFormatDict

router = APIRouter(prefix="/api/dictionaries", tags=["字典管理"])


@router.get("/bow-types")
def get_bow_types(db: Session = Depends(get_db)):
    """
    获取所有弓种
    """
    bow_types = db.query(BowTypeDict).all()
    return {
        "success": True,
        "data": [
            {"code": item.code, "name": item.name}
            for item in bow_types
        ]
    }


@router.get("/distances")
def get_distances(db: Session = Depends(get_db)):
    """
    获取所有距离
    """
    distances = db.query(DistanceDict).all()
    return {
        "success": True,
        "data": [
            {"code": item.code, "name": item.name}
            for item in distances
        ]
    }


@router.get("/competition-formats")
def get_competition_formats(db: Session = Depends(get_db)):
    """
    获取所有比赛类型
    """
    formats = db.query(CompetitionFormatDict).all()
    return {
        "success": True,
        "data": [
            {"code": item.code, "name": item.name}
            for item in formats
        ]
    }


@router.get("")
def get_all_dictionaries(db: Session = Depends(get_db)):
    """
    一次性获取所有字典数据
    """
    bow_types = db.query(BowTypeDict).all()
    distances = db.query(DistanceDict).all()
    formats = db.query(CompetitionFormatDict).all()
    
    return {
        "success": True,
        "data": {
            "bowTypes": [
                {"code": item.code, "name": item.name}
                for item in bow_types
            ],
            "distances": [
                {"code": item.code, "name": item.name}
                for item in distances
            ],
            "competitionFormats": [
                {"code": item.code, "name": item.name}
                for item in formats
            ]
        }
    }
