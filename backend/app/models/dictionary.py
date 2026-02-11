"""
字典模型 - 枚举和常量的数据库表示
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base


class BowTypeDict(Base):
    """弓种字典表"""
    __tablename__ = "bow_types"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), nullable=False, unique=True, index=True)  # 代码：recurve, compound等
    name = Column(String(100), nullable=False)  # 名称
    description = Column(Text, nullable=True)  # 描述
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class DistanceDict(Base):
    """距离字典表"""
    __tablename__ = "distances"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(10), nullable=False, unique=True, index=True)  # 代码：18m, 30m等
    name = Column(String(50), nullable=False)  # 名称
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CompetitionFormatDict(Base):
    """比赛类型字典表"""
    __tablename__ = "competition_formats"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), nullable=False, unique=True, index=True)  # 代码：ranking, elimination, team
    name = Column(String(100), nullable=False)  # 名称
    description = Column(Text, nullable=True)  # 描述
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
