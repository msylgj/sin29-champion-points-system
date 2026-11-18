"""版本化计分规则：初始快照、原子发布、按比赛时间选择。"""
from copy import deepcopy

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from app.models.dictionary import CompetitionGroupDict
from app.models.event import Event
from app.models.scoring_rule import ScoringRule
from app.schemas.scoring_rule import ScoringRuleConfig, ScoringRuleCreate
from app.services.scoring_calculator import ScoringCalculator


SEASONS = ("春季赛", "夏季赛", "秋季赛", "冬季赛")


class RuleConflictError(ValueError):
    pass


class RuleEventNotFoundError(ValueError):
    pass


class RuleNotFoundError(ValueError):
    pass


def period_key(year: int, season: str) -> int:
    if year < 1 or season not in SEASONS:
        raise ValueError("赛事年度或赛季无效")
    return year * 4 + SEASONS.index(season) + 1


def key_period(key):
    if key is None or key == 0:
        return None
    year, season_index = divmod(key - 1, 4)
    return {"year": year, "season": SEASONS[season_index]}


class ScoringRuleService:
    @staticmethod
    def default_config(db: Session) -> ScoringRuleConfig:
        def ranges(table):
            return [
                {"min_count": low, "max_count": None if high == float("inf") else high,
                 "coefficient": coefficient, "cutoff": cutoff}
                for (low, high), (coefficient, cutoff) in table.items()
            ]

        # 原表只约束(group,bow,distance)，拒绝歧义而非随机覆盖后永久冻结错误映射。
        groups = {}
        for row in db.query(CompetitionGroupDict).order_by(CompetitionGroupDict.id).all():
            key = (row.bow_type, row.distance)
            if key in groups and groups[key] != row.group_code:
                raise ValueError(f"组别映射冲突：{row.bow_type}/{row.distance}，请在初始化规则前修正字典")
            groups[key] = row.group_code
        return ScoringRuleConfig(
            ranking_points=list(ScoringCalculator.RANKING_POINTS.values()),
            elimination_points=list(ScoringCalculator.ELIMINATION_POINTS.values()),
            team_points=list(ScoringCalculator.TEAM_POINTS.values()),
            individual_coefficients=ranges(ScoringCalculator.PARTICIPANT_COEFFICIENTS),
            team_coefficients=ranges(ScoringCalculator.TEAM_COEFFICIENTS),
            group_multipliers=ScoringCalculator.GROUP_MULTIPLIERS,
            competition_groups=[
                {"bow_type": bow_type, "distance": distance, "group_code": group_code}
                for (bow_type, distance), group_code in groups.items()
            ],
            fallback_base_points=1, default_participant_count=2,
        )

    @staticmethod
    def ensure_initial_rule(db: Session) -> ScoringRule:
        """只创建一次，随调用者事务提交；保存点隔离并发唯一键失败。"""
        existing = db.query(ScoringRule).filter(ScoringRule.start_key == 0).first()
        if existing:
            return existing
        config = ScoringRuleService.default_config(db).model_dump(mode="json")
        try:
            with db.begin_nested():
                initial = ScoringRule(name="初始规则", source_rule_id=None, start_key=0, config=config)
                db.add(initial)
                db.flush()
            return initial
        except IntegrityError:
            existing = db.query(ScoringRule).filter(ScoringRule.start_key == 0).first()
            if existing is None:
                raise
            return existing

    @staticmethod
    def list_rules(db: Session) -> list[ScoringRule]:
        ScoringRuleService.ensure_initial_rule(db)
        # ensure的存在性检查可能先把初始行放进identity map；刷新为本次列表SELECT的同一快照。
        return db.query(ScoringRule).order_by(ScoringRule.start_key.desc()).populate_existing().all()

    @staticmethod
    def serialize(rule: ScoringRule) -> dict:
        return {
            "id": rule.id, "name": rule.name, "source_rule_id": rule.source_rule_id,
            "start": key_period(rule.start_key), "end": key_period(rule.end_key),
            "created_at": rule.created_at, "config": deepcopy(rule.config),
        }

    @staticmethod
    def _lock_latest(db: Session):
        # 创建和删除严格共用从最新到前版的锁顺序；等待后行可能已被另一事务删除。
        return db.query(ScoringRule).order_by(ScoringRule.start_key.desc()).populate_existing().with_for_update().first()

    @staticmethod
    def create_rule(db: Session, request: ScoringRuleCreate) -> ScoringRule:
        """锁定+CAS关闭旧版，与追加新版同一事务；失败不留下半关闭的时间轴。"""
        try:
            ScoringRuleService.ensure_initial_rule(db)
            latest = ScoringRuleService._lock_latest(db)
            if latest is None or latest.id != request.base_rule_id or latest.end_key is not None:
                raise RuleConflictError("规则已更新，请重新加载最新版本后创建；当前草稿不能直接发布")
            event = db.query(Event).filter(Event.id == request.previous_end_event_id).first()
            if event is None:
                raise RuleEventNotFoundError("截止赛事不存在")
            end_key = period_key(event.year, event.season)
            if end_key < latest.start_key:
                raise ValueError("截止赛事不得早于当前规则的开始赛季")
            config = request.config or ScoringRuleConfig.model_validate(deepcopy(latest.config))
            child = aliased(ScoringRule)
            has_successor = db.query(child.id).filter(child.source_rule_id == latest.id).exists()
            updated = db.query(ScoringRule).filter(
                ScoringRule.id == latest.id, ScoringRule.end_key.is_(None), ~has_successor,
            ).update({ScoringRule.end_key: end_key}, synchronize_session=False)
            if updated != 1:
                raise RuleConflictError("规则已被其他管理员更新，请重新加载")
            # 下方仅让新响应对象不expire；被bulk UPDATE关闭的前版不能留着旧end缓存。
            db.expire(latest, ["end_key"])
            successor = ScoringRule(
                name=request.name, source_rule_id=latest.id, start_key=end_key + 1,
                config=config.model_dump(mode="json"),
            )
            db.add(successor)
            db.flush()
            # INSERT已返回id/created_at，提交后不可refresh：另一管理员可能立即删除该版本。
            # 保持已加载ORM结果供既有调用者使用，避免响应序列化再次查库读到混合状态。
            expire_on_commit = db.expire_on_commit
            try:
                db.expire_on_commit = False
                db.commit()
            finally:
                db.expire_on_commit = expire_on_commit
            return successor
        except IntegrityError as exc:
            db.rollback()
            raise RuleConflictError("规则已被其他管理员更新，请重新加载") from exc
        except Exception:
            db.rollback()
            raise

    @staticmethod
    def delete_rule(db: Session, rule_id: int) -> dict:
        """仅撤销最新非初始版本，删除与前版恢复同事务完成。"""
        try:
            target = db.query(ScoringRule).filter(ScoringRule.id == rule_id).populate_existing().first()
            if target is None:
                raise RuleNotFoundError("规则不存在或已删除")
            if target.start_key == 0 or target.source_rule_id is None:
                raise ValueError("初始规则不可删除")
            latest = ScoringRuleService._lock_latest(db)
            if latest is None or latest.id != rule_id or latest.end_key is not None:
                raise RuleConflictError("只能删除最新且仍持续生效的规则，请刷新后重试")
            # 与create先锁latest一致，接着锁时间上紧邻的前版，不能越过中间版本恢复。
            previous = db.query(ScoringRule).filter(
                ScoringRule.start_key < latest.start_key,
            ).order_by(ScoringRule.start_key.desc()).populate_existing().with_for_update().first()
            if (previous is None or previous.id != latest.source_rule_id
                    or previous.end_key != latest.start_key - 1):
                raise RuleConflictError("规则前版或生效边界已变化，无法安全删除，请刷新后重试")
            expected_end = latest.start_key - 1
            child = aliased(ScoringRule)
            has_successor = db.query(child.id).filter(child.source_rule_id == rule_id).exists()
            deleted = db.query(ScoringRule).filter(
                ScoringRule.id == rule_id, ScoringRule.start_key == latest.start_key,
                ScoringRule.source_rule_id == previous.id, ScoringRule.end_key.is_(None), ~has_successor,
            ).delete(synchronize_session="fetch")
            if deleted != 1:
                raise RuleConflictError("规则已被其他管理员更新，请刷新后重试")
            restored = db.query(ScoringRule).filter(
                ScoringRule.id == previous.id, ScoringRule.start_key == previous.start_key,
                ScoringRule.end_key == expected_end,
            ).update({ScoringRule.end_key: None}, synchronize_session=False)
            if restored != 1:
                raise RuleConflictError("前版规则已被其他管理员更新，请刷新后重试")
            db.refresh(previous)  # 仍在持锁事务内，构造同次操作的一致响应快照。
            payload = {"deleted_rule_id": rule_id, "restored_rule": ScoringRuleService.serialize(previous)}
            db.commit()
            return payload
        except IntegrityError as exc:
            db.rollback()
            raise RuleConflictError("规则已被其他管理员更新，请刷新后重试") from exc
        except Exception:
            db.rollback()
            raise

    @staticmethod
    def rule_for_event(rules: list[ScoringRule], event: Event) -> ScoringRule:
        key = period_key(event.year, event.season)
        for rule in rules:  # list_rules 已按开始时间倒序预加载，无额外数据库查询。
            if rule.start_key <= key and (rule.end_key is None or key <= rule.end_key):
                return rule
        raise ValueError("赛事没有匹配的积分规则版本")
