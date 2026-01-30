"""
积分汇总 Pydantic Schema
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class AggregatePointsRead(BaseModel):
    """积分汇总读取响应"""
    id: int
    athlete_id: int
    athlete_name: Optional[str] = Field(None, description="运动员姓名")
    year: int
    season: Optional[str]
    total_points: float
    event_count: int
    rank: Optional[int]
    gender_group: Optional[str]
    bow_type: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RankingRead(BaseModel):
    """排名读取响应"""
    rank: int
    athlete_id: int
    athlete_name: str
    phone: Optional[str]
    gender: str
    total_points: float
    event_count: int
    best_score: Optional[int] = None
    average_rank: Optional[float] = None


class RankingList(BaseModel):
    """排名列表响应"""
    items: list[RankingRead]
    total: int
    page: int
    page_size: int
    year: int
    season: Optional[str]
    gender_group: Optional[str]
    bow_type: Optional[str]
