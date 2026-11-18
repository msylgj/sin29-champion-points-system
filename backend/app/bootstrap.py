"""只增建缺失表并快照当前规则，不变更或清空已有成绩。"""
import logging

from sqlalchemy import text
from sqlalchemy.orm import Session

import app.models  # noqa: F401: 注册全部metadata
from app.database import Base
from app.services.scoring_rule_service import ScoringRuleService


logger = logging.getLogger(__name__)


def initialize_database(engine):
    # PG多个worker首次启动会并发检查/创建同一张表，事务级锁同时保护DDL与初始快照。
    with engine.begin() as connection:
        if connection.dialect.name == "postgresql":
            connection.execute(text("SELECT pg_advisory_xact_lock(1947368521)"))
        Base.metadata.create_all(bind=connection)
        with Session(bind=connection, join_transaction_mode="create_savepoint") as db:
            rule = ScoringRuleService.ensure_initial_rule(db)
            if not rule.config["competition_groups"]:
                logger.warning("初始积分规则的组别快照为空，未匹配项目将获得0分；请检查初始化前的字典")
            db.commit()
