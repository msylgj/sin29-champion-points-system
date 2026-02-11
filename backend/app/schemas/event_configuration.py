"""
赛事配置 Pydantic Schema
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class EventConfigurationBase(BaseModel):
    """赛事配置基础数据"""
    event_id: int = Field(..., description="赛事ID")
    bow_type: str = Field(..., description="弓种：recurve/compound/traditional/longbow/barebow")
    distance: str = Field(..., description="距离：18m/30m/50m/70m")
    format: str = Field(..., description="比赛类型：ranking/elimination/mixed_doubles/team")
    participant_count: int = Field(..., ge=1, description="参赛人数或队伍数")


class EventConfigurationCreate(BaseModel):
    """创建赛事配置请求 - 不包含 event_id，由后端分配"""
    bow_type: str = Field(..., description="弓种：recurve/compound/traditional/longbow/barebow")
    distance: str = Field(..., description="距离：18m/30m/50m/70m")
    format: str = Field(..., description="比赛类型：ranking/elimination/mixed_doubles/team")
    participant_count: int = Field(..., ge=1, description="参赛人数或队伍数")


class EventConfigurationUpdate(BaseModel):
    """更新赛事配置请求"""
    participant_count: int = Field(..., ge=1)


class EventConfigurationRead(EventConfigurationBase):
    """赛事配置读取响应"""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EventConfigurationList(BaseModel):
    """赛事配置列表响应"""
    items: list[EventConfigurationRead]
    total: int


class CreateEventWithConfigs(BaseModel):
    """创建赛事及其配置"""
    year: int = Field(..., ge=2000, le=2100, description="年度")
    season: str = Field(..., description="季度：Q1/Q2/Q3/Q4")
    configurations: list[EventConfigurationCreate] = Field(..., description="赛事配置列表")
