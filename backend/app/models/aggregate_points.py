"""
总积分模型 - 记录运动员的总积分汇总
"""
from datetime import datetime
from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, Index, String
from sqlalchemy.sql import func
from app.database import Base


class AthleteAggregatePoints(Base):
    """运动员积分汇总表 - 记录运动员在特定年度、季度的总积分"""
    __tablename__ = "athlete_aggregate_points"

    id = Column(Integer, primary_key=True, index=True)
    
    # 外键关系
    athlete_id = Column(Integer, ForeignKey("athletes.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # 时间维度
    year = Column(Integer, nullable=False, index=True)
    season = Column(String(10), nullable=True)  # Q1, Q2, Q3, Q4，如果为None则表示全年积分
    
    # 积分信息
    total_points = Column(Float, default=0.0, nullable=False)
    event_count = Column(Integer, default=0, nullable=False)  # 参赛次数
    rank = Column(Integer, nullable=True)  # 排名
    
    # 分组统计（可选）
    bow_type = Column(String(50), nullable=True)  # 按弓种分组的排名
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # 索引
    __table_args__ = (
        Index('idx_agg_athlete_year_season', 'athlete_id', 'year', 'season'),
        Index('idx_agg_year_season_rank', 'year', 'season', 'rank'),
    )

    def __repr__(self):
        return f"<AthleteAggregatePoints(athlete_id={self.athlete_id}, year={self.year}, season={self.season}, total_points={self.total_points})>"
