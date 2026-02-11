"""
赛事配置模型
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from app.database import Base


class EventConfiguration(Base):
    """赛事配置表 - 记录每个赛事中各比赛组合的参赛规模"""
    __tablename__ = "event_configurations"

    id = Column(Integer, primary_key=True, index=True)
    
    # 赛事关联
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    
    # 比赛标识
    bow_type = Column(String(50), nullable=False)  # 弓种：recurve, compound, traditional, longbow, barebow
    distance = Column(String(10), nullable=False)  # 距离：18m, 30m, 50m, 70m
    format = Column(String(50), nullable=False)  # 比赛类型：ranking, elimination, mixed_doubles, team
    
    # 参赛规模
    participant_count = Column(Integer, nullable=False)  # 参赛人数或队伍数
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # 索引
    __table_args__ = (
        Index('idx_event_config_event', 'event_id'),
        Index('idx_event_config_key', 'event_id', 'bow_type', 'distance', 'format', unique=True),
    )
