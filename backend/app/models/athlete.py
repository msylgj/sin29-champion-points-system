"""
运动员模型
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum, Index
from sqlalchemy.sql import func
from app.database import Base
from app.models.enums import Gender


class Athlete(Base):
    """
    运动员表 - 简化版本
    仅保留基本信息：姓名、手机号、身份证号、性别
    """
    __tablename__ = "athletes"

    id = Column(Integer, primary_key=True, index=True)
    
    # 基本信息（必需）
    name = Column(String(100), nullable=False, index=True)
    phone = Column(String(20), nullable=False, index=True)
    id_number = Column(String(50), nullable=False, unique=True, index=True)
    gender = Column(Enum(Gender), nullable=False)
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # 索引
    __table_args__ = (
        Index('idx_athlete_name', 'name'),
        Index('idx_athlete_phone', 'phone'),
        Index('idx_athlete_id_number', 'id_number'),
    )

    def __repr__(self):
        return f"<Athlete(id={self.id}, name={self.name}, phone={self.phone}, gender={self.gender})>"
