"""
赛事模型
"""
from datetime import datetime, date
from sqlalchemy import Column, Integer, String, DateTime, Date, Text, Enum, Boolean, Index
from sqlalchemy.sql import func
from app.database import Base
from app.models.enums import EventStatus, Distance, CompetitionFormat, BowType, Gender


class Event(Base):
    """赛事表"""
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    
    # 赛事基本信息
    name = Column(String(200), nullable=False, index=True)
    year = Column(Integer, nullable=False, index=True)  # 年度
    season = Column(String(10), nullable=False, index=True)  # 季度 (Q1, Q2, Q3, Q4)
    
    # 赛事日期和地点
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    location = Column(String(200), nullable=True)
    
    # 赛事配置
    status = Column(Enum(EventStatus), default=EventStatus.NOT_STARTED, nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # 比赛详情配置
    distance = Column(Enum(Distance), nullable=False)  # 比赛距离：18m, 30m, 50m, 70m
    competition_format = Column(Enum(CompetitionFormat), nullable=False)  # 赛制：排位赛、淘汰赛、团体赛
    supported_bow_types = Column(String(200), nullable=True)  # 支持的弓种，JSON格式或逗号分隔
    supported_genders = Column(String(200), nullable=False, default="male,female,mixed")  # 支持的性别分组
    
    # 比赛规则配置
    max_participants = Column(Integer, nullable=True)  # 最大参赛人数
    min_score = Column(Integer, nullable=True)  # 最低分数
    max_score = Column(Integer, nullable=True)  # 最高分数
    target_count = Column(Integer, default=10, nullable=False)  # 靶数
    arrows_per_round = Column(Integer, default=3, nullable=False)  # 每轮箭数
    
    # 积分规则配置 (关联到 ScoringRule)
    scoring_rule_id = Column(Integer, nullable=True)  # 外键关联积分规则
    
    # 元数据
    remark = Column(Text, nullable=True)
    is_official = Column(Boolean, default=True, nullable=False)  # 是否官方赛事
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # 索引
    __table_args__ = (
        Index('idx_event_year_season', 'year', 'season'),
        Index('idx_event_date', 'start_date', 'end_date'),
        Index('idx_event_status', 'status'),
        Index('idx_event_format', 'distance', 'competition_format'),
    )

    def __repr__(self):
        return f"<Event(id={self.id}, name={self.name}, year={self.year}, season={self.season})>"
