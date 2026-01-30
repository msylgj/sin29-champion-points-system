"""
积分规则模型
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, Float, Index, JSON
from sqlalchemy.sql import func
from app.database import Base


class ScoringRule(Base):
    """积分规则表"""
    __tablename__ = "scoring_rules"

    id = Column(Integer, primary_key=True, index=True)
    
    # 规则信息
    name = Column(String(100), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    
    # 规则配置 (JSON格式存储)
    rule_config = Column(JSON, nullable=False)  # 积分规则配置，如：
    # {
    #     "type": "rank_based",  # 基于排名
    #     "ranking_points": {    # 排名对应积分
    #         "1": 100,
    #         "2": 90,
    #         "3": 80,
    #         ...
    #     }
    # }
    # 或
    # {
    #     "type": "score_based",  # 基于成绩
    #     "coefficient": 1.5,     # 系数
    #     "base_score": 50        # 基础分
    # }
    
    # 规则类型
    rule_type = Column(String(50), nullable=False)  # 如：rank_based, score_based, custom
    
    # 是否默认规则
    is_default = Column(Integer, default=0, nullable=False)
    
    # 适用范围
    applicable_formats = Column(String(200), nullable=True)  # 适用的比赛形式：ranking, elimination, team
    applicable_distances = Column(String(200), nullable=True)  # 适用的距离：18m, 30m, 50m, 70m
    
    # 备注
    remark = Column(Text, nullable=True)
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self):
        return f"<ScoringRule(id={self.id}, name={self.name}, rule_type={self.rule_type})>"
