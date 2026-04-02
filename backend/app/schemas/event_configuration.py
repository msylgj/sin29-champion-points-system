"""
赛事配置 Pydantic Schema
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Literal


class EventConfigurationBase(BaseModel):
    """赛事配置基础数据"""
    event_id: int = Field(..., description="赛事ID")
    bow_type: str = Field(..., description="弓种：recurve/compound/traditional/longbow/barebow")
    distance: str = Field(..., description="距离：10m/18m/30m/50m/70m")
    individual_participant_count: int = Field(0, ge=0, description="个人赛人数（排位/淘汰共用）")
    mixed_doubles_team_count: int = Field(0, ge=0, description="混双队伍数")
    team_count: int = Field(0, ge=0, description="团体队伍数")


class EventConfigurationCreate(BaseModel):
    """创建赛事配置请求 - 不包含 event_id，由后端分配"""
    bow_type: str = Field(..., description="弓种：recurve/compound/traditional/longbow/barebow")
    distance: str = Field(..., description="距离：10m/18m/30m/50m/70m")
    individual_participant_count: int = Field(0, ge=0, description="个人赛人数（排位/淘汰共用）")
    mixed_doubles_team_count: int = Field(0, ge=0, description="混双队伍数")
    team_count: int = Field(0, ge=0, description="团体队伍数")


class EventConfigurationUpdate(BaseModel):
    """更新赛事配置请求"""
    individual_participant_count: int = Field(0, ge=0)
    mixed_doubles_team_count: int = Field(0, ge=0)
    team_count: int = Field(0, ge=0)


class EventConfigurationRead(EventConfigurationBase):
    """赛事配置读取响应"""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CreateEventWithConfigs(BaseModel):
    """创建赛事及其配置"""
    year: int = Field(..., ge=2000, le=2100, description="年度")
    season: Literal["春季赛", "夏季赛", "秋季赛", "冬季赛"] = Field(..., description="赛季：春季赛/夏季赛/秋季赛/冬季赛")
    configurations: list[EventConfigurationCreate] = Field(..., description="赛事配置列表")
