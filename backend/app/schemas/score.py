"""
成绩 Pydantic Schema
"""
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional


class ScoreBase(BaseModel):
    """成绩基础数据"""
    athlete_id: int = Field(..., description="运动员ID")
    year: int = Field(..., ge=2000, le=2100, description="比赛年度")
    season: str = Field(..., description="季度：Q1, Q2, Q3, Q4")
    distance: str = Field(..., description="距离：18m, 30m, 50m, 70m")
    competition_format: str = Field(..., description="赛制：ranking, elimination, team")
    gender_group: str = Field(..., description="性别分组")
    bow_type: Optional[str] = Field(None, description="弓种")
    raw_score: int = Field(..., ge=0, description="原始成绩（环数）")
    rank: Optional[int] = Field(None, ge=1, description="总排名")
    group_rank: Optional[int] = Field(None, ge=1, description="分组排名")
    round: Optional[int] = Field(None, ge=1, description="轮次（淘汰赛用）")
    participant_count: Optional[int] = Field(None, ge=1, description="参赛人数")
    remark: Optional[str] = Field(None, description="备注")

    @field_validator('season')
    def validate_season(cls, v):
        if v not in ['Q1', 'Q2', 'Q3', 'Q4']:
            raise ValueError('季度必须是 Q1, Q2, Q3, Q4')
        return v

    @field_validator('distance')
    def validate_distance(cls, v):
        valid = ['18m', '30m', '50m', '70m']
        if v not in valid:
            raise ValueError(f'距离必须是 {valid}')
        return v

    @field_validator('competition_format')
    def validate_format(cls, v):
        valid = ['ranking', 'elimination', 'team']
        if v not in valid:
            raise ValueError(f'赛制必须是 {valid}')
        return v


class ScoreCreate(ScoreBase):
    """创建成绩请求"""
    pass


class ScoreUpdate(BaseModel):
    """更新成绩请求"""
    raw_score: Optional[int] = Field(None, ge=0)
    rank: Optional[int] = Field(None, ge=1)
    group_rank: Optional[int] = Field(None, ge=1)
    participant_count: Optional[int] = Field(None, ge=1)
    remark: Optional[str] = None


class ScoreRead(ScoreBase):
    """成绩读取响应"""
    id: int
    base_points: Optional[float] = None
    points: Optional[float] = None
    is_valid: int = 1
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ScoreList(BaseModel):
    """成绩列表响应"""
    items: list[ScoreRead]
    total: int
    page: int
    page_size: int


class ScoreBatchImport(BaseModel):
    """批量导入成绩"""
    scores: list[ScoreCreate]
