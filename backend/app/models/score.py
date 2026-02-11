"""
成绩模型 - 简化版本
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from app.database import Base


class Score(Base):
    """成绩表 - 只记录名次，积分在查询时动态计算"""
    __tablename__ = "scores"

    id = Column(Integer, primary_key=True, index=True)
    
    # 赛事关联
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # 运动员信息
    name = Column(String(100), nullable=False)  # 选手姓名
    club = Column(String(100), nullable=False)  # 俱乐部
    
    # 比赛配置
    bow_type = Column(String(50), nullable=False)  # 弓种：recurve, compound, traditional, longbow, barebow
    distance = Column(String(10), nullable=False)  # 距离：18m, 30m, 50m, 70m
    format = Column(String(50), nullable=False)  # 比赛类型：ranking, elimination, mixed_doubles, team
    
    # 成绩
    rank = Column(Integer, nullable=False)  # 名次
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # 索引
    __table_args__ = (
        Index('idx_score_event_name', 'event_id', 'name'),
        Index('idx_score_event_bow_format', 'event_id', 'bow_type', 'distance', 'format'),
    )
