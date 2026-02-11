"""
成绩 Pydantic Schema - 简化版本
"""
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional


class ScoreBase(BaseModel):
    """成绩基础数据"""
    event_id: int = Field(..., description="赛事ID")
    name: str = Field(..., min_length=1, max_length=100, description="选手姓名")
    club: str = Field(..., min_length=1, max_length=100, description="俱乐部")
    bow_type: str = Field(..., description="弓种：recurve, compound, traditional, longbow, barebow")
    distance: str = Field(..., description="距离：18m, 30m, 50m, 70m")
    format: str = Field(..., description="比赛类型：ranking, elimination, team")
    rank: int = Field(..., ge=1, description="名次")

    @field_validator('bow_type')
    def validate_bow_type(cls, v):
        valid = ['recurve', 'compound', 'traditional', 'longbow', 'barebow']
        if v not in valid:
            raise ValueError(f'弓种必须是 {valid}')
        return v

    @field_validator('distance')
    def validate_distance(cls, v):
        valid = ['18m', '30m', '50m', '70m']
        if v not in valid:
            raise ValueError(f'距离必须是 {valid}')
        return v

    @field_validator('format')
    def validate_format(cls, v):
        valid = ['ranking', 'elimination', 'mixed_doubles', 'team']
        if v not in valid:
            raise ValueError(f'比赛类型必须是 {valid}')
        return v


class ScoreCreate(ScoreBase):
    """创建成绩请求"""
    pass


class ScoreUpdate(BaseModel):
    """更新成绩请求"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    club: Optional[str] = Field(None, min_length=1, max_length=100)
    bow_type: Optional[str] = None
    distance: Optional[str] = None
    format: Optional[str] = None
    rank: Optional[int] = Field(None, ge=1)


class ScoreRead(ScoreBase):
    """成绩读取响应"""
    id: int
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
    event_id: int
    scores: list[ScoreCreate]



class ScoreBatchImport(BaseModel):
    """批量导入成绩"""
    scores: list[ScoreCreate]
