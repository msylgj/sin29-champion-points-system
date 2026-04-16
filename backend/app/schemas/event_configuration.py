"""
赛事配置 Pydantic Schema
"""
from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import datetime
from typing import Literal, Optional

VALID_BOW_TYPES = ['recurve', 'compound', 'traditional', 'longbow', 'barebow', 'sightless']
VALID_DISTANCES = ['10m', '18m', '30m', '50m', '70m']
VALID_GENDER_GROUPS = ['men', 'women', 'mixed']


def _validate_bow_type(value: str) -> str:
    if value not in VALID_BOW_TYPES:
        raise ValueError(f'弓种必须是 {VALID_BOW_TYPES}')
    return value


def _validate_distance(value: str) -> str:
    if value not in VALID_DISTANCES:
        raise ValueError(f'距离必须是 {VALID_DISTANCES}')
    return value


def _validate_gender_group(value: str) -> str:
    if value not in VALID_GENDER_GROUPS:
        raise ValueError(f'比赛性别分组必须是 {VALID_GENDER_GROUPS}')
    return value


class EventConfigurationBase(BaseModel):
    """赛事配置基础数据"""
    event_id: int = Field(..., description="赛事ID")
    gender_group: str = Field(..., description="比赛性别分组：men/women/mixed")
    bow_type: str = Field(..., description="弓种：recurve/compound/traditional/longbow/barebow/sightless")
    distance: str = Field(..., description="距离：10m/18m/30m/50m/70m")
    individual_participant_count: int = Field(0, ge=0, description="个人赛人数（排位/淘汰共用）")
    mixed_doubles_team_count: int = Field(0, ge=0, description="混双队伍数")
    team_count: int = Field(0, ge=0, description="团体队伍数")

    @field_validator('gender_group')
    def validate_gender_group(cls, v):
        return _validate_gender_group(v)

    @field_validator('bow_type')
    def validate_bow_type(cls, v):
        return _validate_bow_type(v)

    @field_validator('distance')
    def validate_distance(cls, v):
        return _validate_distance(v)


class EventConfigurationCreate(BaseModel):
    """创建赛事配置请求 - 不包含 event_id，由后端分配"""
    gender_group: str = Field(..., description="比赛性别分组：men/women/mixed")
    bow_type: str = Field(..., description="弓种：recurve/compound/traditional/longbow/barebow/sightless")
    distance: str = Field(..., description="距离：10m/18m/30m/50m/70m")
    individual_participant_count: int = Field(0, ge=0, description="个人赛人数（排位/淘汰共用）")
    mixed_doubles_team_count: int = Field(0, ge=0, description="混双队伍数")
    team_count: int = Field(0, ge=0, description="团体队伍数")

    @field_validator('gender_group')
    def validate_gender_group(cls, v):
        return _validate_gender_group(v)

    @field_validator('bow_type')
    def validate_bow_type(cls, v):
        return _validate_bow_type(v)

    @field_validator('distance')
    def validate_distance(cls, v):
        return _validate_distance(v)


class EventConfigurationUpdate(BaseModel):
    """更新赛事配置请求"""
    individual_participant_count: Optional[int] = Field(None, ge=0)
    mixed_doubles_team_count: Optional[int] = Field(None, ge=0)
    team_count: Optional[int] = Field(None, ge=0)


class EventConfigurationRead(EventConfigurationBase):
    """赛事配置读取响应"""
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CreateEventWithConfigs(BaseModel):
    """创建赛事及其配置"""
    year: int = Field(..., ge=2000, le=2100, description="年度")
    season: Literal["春季赛", "夏季赛", "秋季赛", "冬季赛"] = Field(..., description="赛季：春季赛/夏季赛/秋季赛/冬季赛")
    configurations: list[EventConfigurationCreate] = Field(..., description="赛事配置列表")
