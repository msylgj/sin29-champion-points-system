"""
赛事 Pydantic Schema
"""
from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional
from app.models.enums import EventStatus, Distance, CompetitionFormat


class EventBase(BaseModel):
    """赛事基础数据"""
    name: str = Field(..., min_length=1, max_length=200, description="赛事名称")
    year: int = Field(..., ge=2000, le=2100, description="年度")
    season: str = Field(..., description="季度：Q1, Q2, Q3, Q4")
    start_date: date = Field(..., description="开始日期")
    end_date: date = Field(..., description="结束日期")
    location: Optional[str] = Field(None, max_length=200, description="地点")
    distance: Distance = Field(..., description="比赛距离")
    competition_format: CompetitionFormat = Field(..., description="赛制")
    description: Optional[str] = None


class EventCreate(EventBase):
    """创建赛事请求"""
    pass


class EventUpdate(BaseModel):
    """更新赛事请求"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    status: Optional[EventStatus] = None
    description: Optional[str] = None


class EventRead(EventBase):
    """赛事读取响应"""
    id: int
    status: EventStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EventList(BaseModel):
    """赛事列表响应"""
    items: list[EventRead]
    total: int
    page: int
    page_size: int
