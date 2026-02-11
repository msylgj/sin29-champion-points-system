"""
赛事 Pydantic Schema - 简化版本
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class EventBase(BaseModel):
    """赛事基础数据"""
    year: int = Field(..., ge=2000, le=2100, description="年度")
    season: str = Field(..., description="季度：Q1, Q2, Q3, Q4")


class EventCreate(EventBase):
    """创建赛事请求"""
    pass


class EventUpdate(BaseModel):
    """更新赛事请求"""
    pass


class EventRead(EventBase):
    """赛事读取响应"""
    id: int
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

