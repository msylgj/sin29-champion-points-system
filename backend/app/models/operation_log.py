"""
操作日志模型
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Index
from sqlalchemy.sql import func
from app.database import Base


class OperationLog(Base):
    """操作日志表 - 记录用户操作和数据修改"""
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    
    # 操作者
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # 操作信息
    operation_type = Column(String(50), nullable=False, index=True)  # 如：create, update, delete, import, export, calculate
    entity_type = Column(String(50), nullable=False, index=True)  # 实体类型：athlete, event, score, user等
    entity_id = Column(Integer, nullable=True)  # 实体ID
    
    # 操作详情
    description = Column(Text, nullable=True)
    old_values = Column(Text, nullable=True)  # JSON格式的旧值
    new_values = Column(Text, nullable=True)  # JSON格式的新值
    
    # 请求信息
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)
    
    # 操作结果
    status = Column(String(20), default="success", nullable=False)  # success, failure
    error_message = Column(Text, nullable=True)
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # 索引
    __table_args__ = (
        Index('idx_log_user_type', 'user_id', 'operation_type'),
        Index('idx_log_entity', 'entity_type', 'entity_id'),
        Index('idx_log_created', 'created_at'),
    )

    def __repr__(self):
        return f"<OperationLog(id={self.id}, operation_type={self.operation_type}, entity_type={self.entity_type})>"
