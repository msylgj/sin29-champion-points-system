"""
事件参与者模型 - 记录哪些运动员参与了哪些赛事
"""
from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, ForeignKey, Index, String
from sqlalchemy.sql import func
from app.database import Base


class EventParticipant(Base):
    """赛事参与者表 - 记录运动员参加赛事的注册信息"""
    __tablename__ = "event_participants"

    id = Column(Integer, primary_key=True, index=True)
    
    # 外键关系
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    athlete_id = Column(Integer, ForeignKey("athletes.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # 参赛信息
    registration_number = Column(String(50), nullable=True, unique=True)  # 参赛号
    bow_type = Column(String(50), nullable=True)  # 本次比赛使用的弓种
    gender_group = Column(String(50), nullable=True)  # 参加的性别分组
    status = Column(String(20), default="registered", nullable=False)  # 状态：registered, checked_in, participated, withdrew
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # 索引
    __table_args__ = (
        Index('idx_participant_event_athlete', 'event_id', 'athlete_id'),
        Index('idx_participant_status', 'status'),
    )

    def __repr__(self):
        return f"<EventParticipant(id={self.id}, event_id={self.event_id}, athlete_id={self.athlete_id}, status={self.status})>"
