"""
所有服务模块导入
"""
from app.services.scoring_calculator import ScoringCalculator, PointsAggregator

__all__ = [
    "ScoringCalculator",
    "PointsAggregator",
]
