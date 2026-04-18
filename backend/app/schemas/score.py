"""
成绩 Pydantic Schema - 简化版本
"""
from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import datetime
from typing import Optional

VALID_BOW_TYPES = ['recurve', 'compound', 'traditional', 'longbow', 'barebow', 'sightless']
VALID_DISTANCES = ['10m', '18m', '30m', '50m', '70m']
VALID_FORMATS = ['ranking', 'elimination', 'mixed_doubles', 'team']
VALID_GENDER_GROUPS = ['men', 'women', 'mixed']


def _validate_bow_type(value: str) -> str:
    if value not in VALID_BOW_TYPES:
        raise ValueError(f'弓种必须是 {VALID_BOW_TYPES}')
    return value


def _validate_distance(value: str) -> str:
    if value not in VALID_DISTANCES:
        raise ValueError(f'距离必须是 {VALID_DISTANCES}')
    return value


def _validate_format(value: str) -> str:
    if value not in VALID_FORMATS:
        raise ValueError(f'比赛类型必须是 {VALID_FORMATS}')
    return value


def _validate_gender_group(value: str) -> str:
    if value not in VALID_GENDER_GROUPS:
        raise ValueError(f'分组必须是 {VALID_GENDER_GROUPS}')
    return value


class ScoreBase(BaseModel):
    """成绩基础数据"""
    event_id: int = Field(..., description="赛事ID")
    name: str = Field(..., min_length=1, max_length=100, description="选手姓名")
    bow_type: str = Field(..., description="弓种：recurve, compound, traditional, longbow, barebow, sightless")
    distance: str = Field(..., description="距离：10m, 18m, 30m, 50m, 70m")
    format: str = Field(..., description="比赛类型：ranking, elimination, team")
    gender_group: Optional[str] = Field(None, description="分组：men, women, mixed")
    rank: int = Field(..., ge=1, description="名次")

    @field_validator('bow_type')
    def validate_bow_type(cls, v):
        return _validate_bow_type(v)

    @field_validator('distance')
    def validate_distance(cls, v):
        return _validate_distance(v)

    @field_validator('format')
    def validate_format(cls, v):
        return _validate_format(v)

    @field_validator('gender_group')
    def validate_gender_group(cls, v):
        if v is None:
            return v
        return _validate_gender_group(v)


class ScoreCreate(ScoreBase):
    """创建成绩请求"""
    pass


class ScoreUpdate(BaseModel):
    """更新成绩请求"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    bow_type: Optional[str] = None
    distance: Optional[str] = None
    format: Optional[str] = None
    gender_group: Optional[str] = None
    rank: Optional[int] = Field(None, ge=1)

    @field_validator('bow_type')
    def validate_bow_type(cls, v):
        if v is None:
            return v
        return _validate_bow_type(v)

    @field_validator('distance')
    def validate_distance(cls, v):
        if v is None:
            return v
        return _validate_distance(v)

    @field_validator('format')
    def validate_format(cls, v):
        if v is None:
            return v
        return _validate_format(v)

    @field_validator('gender_group')
    def validate_gender_group(cls, v):
        if v is None:
            return v
        return _validate_gender_group(v)


class ScoreRead(ScoreBase):
    """成绩读取响应"""
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ScoreList(BaseModel):
    """成绩列表响应"""
    items: list[ScoreRead]
    total: int
    page: int
    page_size: int


class ScoreBatchImport(BaseModel):
    """批量导入成绩"""
    scores: list[ScoreCreate]
