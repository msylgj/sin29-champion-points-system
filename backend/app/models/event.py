"""
赛事模型 - 简化版本
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Index
from sqlalchemy.sql import func
from app.database import Base


class Event(Base):
    """赛事表"""
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    
    # 赛事基本信息
    year = Column(Integer, nullable=False)  # 年度
    season = Column(String(10), nullable=False)  # 季度 (Q1, Q2, Q3, Q4)
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # 索引
    __table_args__ = (
        Index('idx_event_year_season', 'year', 'season', unique=True),
    )

    def __repr__(self):
        return f"<Event(id={self.id}, year={self.year}, season={self.season})>"
