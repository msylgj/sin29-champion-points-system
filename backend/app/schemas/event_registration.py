"""
赛事报名 Pydantic Schema
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


VALID_SEASONS = ['春季赛', '夏季赛', '秋季赛', '冬季赛']
VALID_DISTANCES = ['10m', '18m', '30m', '50m', '70m']
VALID_COMPETITION_BOW_TYPES = ['recurve', 'compound', 'traditional', 'longbow', 'barebow', 'sightless']
VALID_POINTS_BOW_TYPES = ['recurve', 'compound', 'traditional', 'longbow', 'barebow']
VALID_GENDER_GROUPS = ['men', 'women', 'mixed']


def _validate_season(value: str) -> str:
    if value not in VALID_SEASONS:
        raise ValueError(f'赛季必须是 {VALID_SEASONS}')
    return value


def _validate_distance(value: str) -> str:
    if value not in VALID_DISTANCES:
        raise ValueError(f'距离必须是 {VALID_DISTANCES}')
    return value


def _validate_competition_bow_type(value: str) -> str:
    if value not in VALID_COMPETITION_BOW_TYPES:
        raise ValueError(f'比赛弓种必须是 {VALID_COMPETITION_BOW_TYPES}')
    return value


def _validate_points_bow_type(value: str) -> str:
    if value not in VALID_POINTS_BOW_TYPES:
        raise ValueError(f'积分弓种必须是 {VALID_POINTS_BOW_TYPES}')
    return value


def _validate_gender_group(value: str) -> str:
    if value not in VALID_GENDER_GROUPS:
        raise ValueError(f'分组必须是 {VALID_GENDER_GROUPS}')
    return value


class EventRegistrationBase(BaseModel):
    """赛事报名基础数据"""
    year: int = Field(..., ge=2000, le=2100, description='赛年')
    season: str = Field(..., description='赛季')
    name: str = Field(..., min_length=1, max_length=100, description='姓名')
    club: str = Field(..., min_length=1, max_length=100, description='俱乐部')
    distance: str = Field(..., description='距离')
    competition_bow_type: str = Field(..., description='比赛弓种')
    points_bow_type: str = Field(..., description='积分弓种')
    competition_gender_group: str = Field(..., description='分组')

    @field_validator('season')
    def validate_season(cls, v):
        return _validate_season(v)

    @field_validator('distance')
    def validate_distance(cls, v):
        return _validate_distance(v)

    @field_validator('competition_bow_type')
    def validate_competition_bow_type(cls, v):
        return _validate_competition_bow_type(v)

    @field_validator('points_bow_type')
    def validate_points_bow_type(cls, v):
        return _validate_points_bow_type(v)

    @field_validator('competition_gender_group')
    def validate_competition_gender_group(cls, v):
        return _validate_gender_group(v)


class EventRegistrationCreate(EventRegistrationBase):
    """创建赛事报名请求"""
    pass


class EventRegistrationUpdate(BaseModel):
    """更新赛事报名请求"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    club: Optional[str] = Field(None, min_length=1, max_length=100)
    distance: Optional[str] = None
    competition_bow_type: Optional[str] = None
    points_bow_type: Optional[str] = None
    competition_gender_group: Optional[str] = None

    @field_validator('distance')
    def validate_distance(cls, v):
        if v is None:
            return v
        return _validate_distance(v)

    @field_validator('competition_bow_type')
    def validate_competition_bow_type(cls, v):
        if v is None:
            return v
        return _validate_competition_bow_type(v)

    @field_validator('points_bow_type')
    def validate_points_bow_type(cls, v):
        if v is None:
            return v
        return _validate_points_bow_type(v)

    @field_validator('competition_gender_group')
    def validate_competition_gender_group(cls, v):
        if v is None:
            return v
        return _validate_gender_group(v)


class EventRegistrationRead(EventRegistrationBase):
    """赛事报名读取响应"""
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EventRegistrationList(BaseModel):
    """赛事报名列表响应"""
    items: list[EventRegistrationRead]
    total: int
    page: int
    page_size: int


class EventRegistrationBatchImport(BaseModel):
    """批量导入赛事报名"""
    registrations: list[EventRegistrationCreate]


class EventRegistrationQuery(BaseModel):
    """赛事报名查询参数"""
    year: Optional[int] = None
    season: Optional[str] = None
    name: Optional[str] = None
