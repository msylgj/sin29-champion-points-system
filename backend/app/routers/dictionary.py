"""
字典表 API 路由 - 获取下拉选项数据
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import Integer, cast, func, case
from app.database import get_db
from app.models.dictionary import BowTypeDict, DistanceDict, CompetitionFormatDict, CompetitionGroupDict

router = APIRouter(prefix="/api/dictionaries", tags=["字典管理"])


def distance_order_expr(model_distance_field):
    """按距离数值降序（70m -> 50m -> 30m -> 18m -> 10m）"""
    return cast(func.replace(model_distance_field, 'm', ''), Integer).desc()


def bow_type_order_expr(model_bow_type_field):
    """按固定弓种顺序：光弓 -> 美猎 -> 传统 -> 反曲 -> 复合"""
    return case(
        (model_bow_type_field == 'barebow', 1),
        (model_bow_type_field == 'longbow', 2),
        (model_bow_type_field == 'traditional', 3),
        (model_bow_type_field == 'recurve', 4),
        (model_bow_type_field == 'compound', 5),
        else_=99,
    )


@router.get("")
def get_all_dictionaries(db: Session = Depends(get_db)):
    """
    一次性获取所有字典数据
    """
    bow_types = db.query(BowTypeDict).order_by(bow_type_order_expr(BowTypeDict.code)).all()
    distances = db.query(DistanceDict).order_by(distance_order_expr(DistanceDict.code)).all()
    formats = db.query(CompetitionFormatDict).all()
    groups = db.query(CompetitionGroupDict).order_by(
        CompetitionGroupDict.group_code.asc(),
        distance_order_expr(CompetitionGroupDict.distance),
        bow_type_order_expr(CompetitionGroupDict.bow_type)
    ).all()
    
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
            ],
            "competitionGroups": [
                {
                    "group_code": item.group_code,
                    "bow_type": item.bow_type,
                    "distance": item.distance
                }
                for item in groups
            ]
        }
    }
