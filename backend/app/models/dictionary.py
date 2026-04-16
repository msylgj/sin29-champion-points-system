"""
字典模型 - 枚举和常量的数据库表示
"""
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


class CompetitionGenderGroupDict(Base):
    """比赛性别分组字典表"""
    __tablename__ = "competition_gender_groups"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), nullable=False, unique=True, index=True)  # 代码：men, women, mixed
    name = Column(String(100), nullable=False)  # 名称
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CompetitionGroupDict(Base):
    """比赛组别字典表"""
    __tablename__ = "competition_groups"

    id = Column(Integer, primary_key=True, index=True)
    group_code = Column(String(2), nullable=False, index=True)  # 组别：S/A/B/C
    bow_type = Column(String(50), nullable=False, index=True)  # 弓种代码
    distance = Column(String(10), nullable=False, index=True)  # 距离代码
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
