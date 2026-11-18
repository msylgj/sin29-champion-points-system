"""不可变计分配置快照；可追加后继或撤销最新非初始版本。"""
from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.sql import func

from app.database import Base


class ScoringRule(Base):
    __tablename__ = "scoring_rules"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    source_rule_id = Column(Integer, ForeignKey("scoring_rules.id"), unique=True, nullable=True)
    # 0 表示无限过去；其他值为 year * 4 + 春夏秋冬序号 (1..4)。
    start_key = Column(Integer, nullable=False, unique=True)
    end_key = Column(Integer, nullable=True)
    config = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("start_key >= 0", name="ck_scoring_rule_start"),
        CheckConstraint("end_key IS NULL OR end_key >= start_key", name="ck_scoring_rule_range"),
        CheckConstraint(
            "(start_key = 0 AND source_rule_id IS NULL) OR (start_key > 0 AND source_rule_id IS NOT NULL)",
            name="ck_scoring_rule_source",
        ),
        {"sqlite_autoincrement": True},
    )
