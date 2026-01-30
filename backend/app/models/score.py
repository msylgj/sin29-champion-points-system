"""
成绩模型
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, Float, ForeignKey, Index, Numeric
from sqlalchemy.sql import func
from app.database import Base


class Score(Base):
    """成绩表 - 记录运动员在每场比赛中的成绩"""
    __tablename__ = "scores"

    id = Column(Integer, primary_key=True, index=True)
    
    # 外键关系
    athlete_id = Column(Integer, ForeignKey("athletes.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # 时间维度信息
    year = Column(Integer, nullable=False, index=True)  # 比赛年度
    season = Column(String(10), nullable=False, index=True)  # 季度：Q1, Q2, Q3, Q4
    
    # 比赛配置信息
    distance = Column(String(10), nullable=False, index=True)  # 距离：18m, 30m, 50m, 70m
    competition_format = Column(String(50), nullable=False, index=True)  # 赛制：ranking, elimination, team
    gender_group = Column(String(50), nullable=False, index=True)  # 性别分组：male, female, mixed
    bow_type = Column(String(50), nullable=True, index=True)  # 弓种：recurve, compound, traditional, longbow, barebow
    
    # 成绩信息
    raw_score = Column(Integer, nullable=False)  # 原始成绩（环数）
    rank = Column(Integer, nullable=True, index=True)  # 总排名
    group_rank = Column(Integer, nullable=True)  # 分组排名
    
    # 积分信息
    base_points = Column(Float, nullable=True, default=0.0)  # 基础积分（根据排名）
    points = Column(Float, nullable=True, default=0.0)  # 最终积分（考虑系数和18米减半）
    
    # 比赛轮次详情（用于淘汰赛）
    round = Column(Integer, nullable=True)  # 轮次
    
    # 参赛人数统计（用于积分系数计算）
    participant_count = Column(Integer, nullable=True)  # 本场赛事该分组的参赛人数
    
    # 状态和备注
    is_valid = Column(Integer, default=1, nullable=False)  # 是否有效：1=有效，0=无效
    remark = Column(Text, nullable=True)
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    __table_args__ = (
        Index('idx_score_athlete', 'athlete_id'),
        Index('idx_score_year_season', 'year', 'season'),
        Index('idx_score_distance_format', 'distance', 'competition_format'),
        Index('idx_score_gender_bow', 'gender_group', 'bow_type'),
        Index('idx_score_rank', 'rank'),
        Index('idx_score_valid', 'is_valid'),
    )

    def __repr__(self):
        return f"<Score(id={self.id}, athlete_id={self.athlete_id}, event_id={self.event_id}, " \
               f"year={self.year}, season={self.season}, distance={self.distance}, " \
               f"rank={self.rank}, raw_score={self.raw_score}, points={self.points})>"
