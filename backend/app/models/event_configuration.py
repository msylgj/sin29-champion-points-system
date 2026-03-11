"""
赛事配置模型
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from app.database import Base


class EventConfiguration(Base):
    """赛事配置表 - 记录每个赛事中各比赛组合的参赛规模"""
    __tablename__ = "event_configurations"

    id = Column(Integer, primary_key=True, index=True)
    
    # 赛事关联
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    
    # 比赛标识（同一弓种同距离共用配置）
    bow_type = Column(String(50), nullable=False)  # 弓种：recurve, compound, traditional, longbow, barebow, sightless
    distance = Column(String(10), nullable=False)  # 距离：10m, 18m, 30m, 50m, 70m

    # 参赛规模
    individual_participant_count = Column(Integer, nullable=False, default=0)  # 个人赛人数（排位/淘汰共用）
    mixed_doubles_team_count = Column(Integer, nullable=False, default=0)  # 混双队伍数
    team_count = Column(Integer, nullable=False, default=0)  # 团体队伍数
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # 索引
    __table_args__ = (
        Index('idx_event_config_event', 'event_id'),
        Index('idx_event_config_key', 'event_id', 'bow_type', 'distance', unique=True),
    )
