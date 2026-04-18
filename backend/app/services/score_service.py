"""
成绩服务 - 简化版本
"""
from collections import defaultdict

from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, or_
from app.models.score import Score
from app.models.event import Event
from app.models.event_configuration import EventConfiguration
from app.models.dictionary import CompetitionGroupDict
from app.models.event_registration import EventRegistration
from app.schemas.score import ScoreCreate, ScoreUpdate
from app.services.scoring_calculator import ScoringCalculator
from typing import Optional, List, Tuple, Dict


class ScoreService:
    """成绩业务服务"""

    SEASON_ORDER = {
        '春季赛': 1,
        '夏季赛': 2,
        '秋季赛': 3,
        '冬季赛': 4,
    }

    @staticmethod
    def _build_event_config_map(config_rows: List[EventConfiguration]) -> Dict[tuple, EventConfiguration]:
        return {
            (row.event_id, row.gender_group, row.bow_type, row.distance): row
            for row in config_rows
        }

    @staticmethod
    def _registration_sort_key(registration: EventRegistration):
        return (
            ScoreService.SEASON_ORDER.get(registration.season, 99),
            registration.created_at,
            registration.id,
        )

    @staticmethod
    def _get_individual_participant_count(
        score: Score,
        event_config_map: Dict[tuple, EventConfiguration],
    ) -> Optional[int]:
        gender_group = score.gender_group
        if not gender_group:
            return None
        config = event_config_map.get(
            (score.event_id, gender_group, score.bow_type, score.distance)
        )
        if not config:
            return None
        return int(config.individual_participant_count or 0)

    @staticmethod
    def _get_team_participant_count(
        score: Score,
        event_config_map: Dict[tuple, EventConfiguration],
    ) -> Optional[int]:
        gender_group = score.gender_group
        if not gender_group:
            return None
        config = event_config_map.get((score.event_id, gender_group, score.bow_type, score.distance))
        if not config:
            return None
        return int(config.team_count or 0) or None

    @staticmethod
    def _get_mixed_doubles_participant_count(
        score: Score,
        event_config_map: Dict[tuple, EventConfiguration],
    ) -> Optional[int]:
        gender_group = score.gender_group
        if not gender_group:
            return None
        config = event_config_map.get((score.event_id, gender_group, score.bow_type, score.distance))
        if not config:
            return None
        return int(config.mixed_doubles_team_count or 0)

    @staticmethod
    def list_scores(
        db: Session,
        skip: int = 0,
        limit: int = 10,
        event_id: Optional[int] = None,
        bow_type: Optional[str] = None,
        format: Optional[str] = None,
        name: Optional[str] = None
    ) -> Tuple[List[Score], int]:
        """获取成绩列表"""
        query = db.query(Score)

        if event_id is not None:
            query = query.filter(Score.event_id == event_id)
        if bow_type:
            query = query.filter(Score.bow_type == bow_type)
        if format:
            query = query.filter(Score.format == format)
        if name:
            query = query.filter(Score.name.ilike(f"%{name}%"))

        total = query.count()
        # 使用 created_at + id 的稳定排序，避免同时间戳记录在分页时重复/遗漏
        scores = query.order_by(desc(Score.created_at), desc(Score.id)).offset(skip).limit(limit).all()
        return scores, total

    @staticmethod
    def update_score(db: Session, score_id: int, score_update: ScoreUpdate) -> Optional[Score]:
        """更新成绩"""
        db_score = db.query(Score).filter(Score.id == score_id).first()
        if not db_score:
            return None

        # 更新允许的字段
        if score_update.name is not None:
            db_score.name = score_update.name
        if score_update.bow_type is not None:
            db_score.bow_type = score_update.bow_type
        if score_update.distance is not None:
            db_score.distance = score_update.distance
        if score_update.format is not None:
            db_score.format = score_update.format
        if score_update.gender_group is not None:
            db_score.gender_group = score_update.gender_group
        if score_update.rank is not None:
            db_score.rank = score_update.rank

        duplicate = db.query(Score).filter(
            and_(
                Score.id != score_id,
                Score.event_id == db_score.event_id,
                Score.name == db_score.name,
                Score.bow_type == db_score.bow_type,
                Score.distance == db_score.distance,
                Score.format == db_score.format,
            )
        ).first()
        if duplicate:
            raise ValueError('该成绩已存在，请勿重复保存')

        db.commit()
        db.refresh(db_score)
        return db_score

    @staticmethod
    def delete_score(db: Session, score_id: int) -> bool:
        """删除成绩"""
        db_score = db.query(Score).filter(Score.id == score_id).first()
        if not db_score:
            return False
        db.delete(db_score)
        db.commit()
        return True

    @staticmethod
    def _resolve_gender_group(
        score: ScoreCreate,
        registration_map: Dict[tuple, EventRegistration],
    ) -> Optional[str]:
        """推断成绩的性别分组：导入值优先；为空时按规则自动匹配"""
        if score.gender_group:
            return score.gender_group
        if score.format in ('team', 'mixed_doubles'):
            return 'mixed'
        # ranking / elimination: 从报名表中按 姓名+距离+弓种 匹配
        reg = registration_map.get((score.event_id, score.name, score.distance, score.bow_type))
        if reg:
            return reg.competition_gender_group
        return None

    @staticmethod
    def batch_create_scores(db: Session, scores: List[ScoreCreate]) -> List[Score]:
        """批量创建成绩；若同赛事下键重复则覆盖更新 rank"""
        result = []

        # 确保涉及的赛事存在
        event_ids = {item.event_id for item in scores}
        existing_events = db.query(Event.id).filter(Event.id.in_(event_ids)).all()
        existing_event_id_set = {item[0] for item in existing_events}
        missing_event_ids = event_ids - existing_event_id_set
        if missing_event_ids:
            first_missing = sorted(missing_event_ids)[0]
            raise ValueError(f"赛事 ID {first_missing} 不存在")

        # 预加载涉及赛事的报名记录，用于自动推断 gender_group
        event_rows = db.query(Event).filter(Event.id.in_(event_ids)).all()
        event_info = {e.id: e for e in event_rows}
        reg_filters = []
        for eid in event_ids:
            ev = event_info.get(eid)
            if ev:
                reg_filters.append(
                    and_(
                        EventRegistration.year == ev.year,
                        EventRegistration.season == ev.season,
                    )
                )
        registration_rows = (
            db.query(EventRegistration).filter(or_(*reg_filters)).all() if reg_filters else []
        )
        # key: (event_id, name, distance, bow_type) -> registration
        registration_map: Dict[tuple, EventRegistration] = {}
        for reg in registration_rows:
            for eid, ev in event_info.items():
                if ev.year == reg.year and ev.season == reg.season:
                    key = (eid, reg.name, reg.distance, reg.competition_bow_type)
                    if key not in registration_map:
                        registration_map[key] = reg

        for score in scores:
            gender_group = ScoreService._resolve_gender_group(score, registration_map)

            existing = db.query(Score).filter(
                and_(
                    Score.event_id == score.event_id,
                    Score.name == score.name,
                    Score.bow_type == score.bow_type,
                    Score.distance == score.distance,
                    Score.format == score.format,
                )
            ).first()

            if existing:
                existing.rank = score.rank
                existing.gender_group = gender_group
                db.flush()
                result.append(existing)
                continue

            created = Score(
                event_id=score.event_id,
                name=score.name,
                bow_type=score.bow_type,
                distance=score.distance,
                format=score.format,
                gender_group=gender_group,
                rank=score.rank
            )
            db.add(created)
            db.flush()
            result.append(created)

        db.commit()
        for item in result:
            db.refresh(item)
        return result

    @staticmethod
    def get_yearly_bow_type_ranking(
        db: Session,
        year: int,
        bow_type: str
    ) -> List[Dict]:
        """获取某年度某弓种的积分排名（跨赛事、距离、格式聚合）
        
        返回该弓种在该年度的所有选手及其总积分排名
        """
        registration_rows = db.query(EventRegistration).filter(
            EventRegistration.year == year,
            EventRegistration.points_bow_type == bow_type,
        ).all()
        if not registration_rows:
            return []

        athlete_registration_map: Dict[str, List[EventRegistration]] = defaultdict(list)
        for row in registration_rows:
            athlete_registration_map[row.name].append(row)
        # 直接按报名上下文关联成绩，避免按姓名全量扫年度成绩。
        score_rows = db.query(Score, Event, EventRegistration).join(
            Event, Event.id == Score.event_id
        ).join(
            EventRegistration,
            and_(
                EventRegistration.year == Event.year,
                EventRegistration.season == Event.season,
                EventRegistration.name == Score.name,
                EventRegistration.distance == Score.distance,
                EventRegistration.competition_bow_type == Score.bow_type,
            ),
        ).filter(
            Event.year == year,
            EventRegistration.year == year,
            EventRegistration.points_bow_type == bow_type,
        ).all()

        # 预加载组别配置
        group_rows = db.query(CompetitionGroupDict).all()
        competition_groups = {
            (row.bow_type, row.distance): row.group_code
            for row in group_rows
        }

        event_ids = {score.event_id for score, _event, _registration in score_rows}
        config_rows = db.query(EventConfiguration).filter(
            EventConfiguration.event_id.in_(event_ids)
        ).all() if event_ids else []
        event_config_map = ScoreService._build_event_config_map(config_rows)
        
        # 按报名表中的姓名聚合积分，俱乐部使用该年度最早一次报名信息
        athlete_points = {}
        for name, rows in athlete_registration_map.items():
            earliest_registration = min(rows, key=ScoreService._registration_sort_key)
            athlete_points[name] = {
                'name': name,
                'club': earliest_registration.club,
                'total_points': 0.0,
                'scores': []
            }

        for score, event, registration in score_rows:
            participant_count = None

            if score.format in ('ranking', 'elimination'):
                participant_count = ScoreService._get_individual_participant_count(
                    score,
                    event_config_map,
                )
                if not participant_count:
                    participant_count = 8
            elif score.format == 'team':
                participant_count = ScoreService._get_team_participant_count(score, event_config_map)
                if not participant_count:
                    participant_count = 3
            elif score.format == 'mixed_doubles':
                participant_count = ScoreService._get_mixed_doubles_participant_count(score, event_config_map)
                if not participant_count:
                    participant_count = 3
            else:
                participant_count = 8
            
            # 计算积分
            points = ScoringCalculator.calculate_points(
                rank=score.rank,
                competition_format=score.format,
                competition_groups=competition_groups,
                bow_type=score.bow_type,
                distance=score.distance,
                participant_count=participant_count
            )
            
            if score.name not in athlete_points:
                athlete_points[score.name] = {
                    'name': score.name,
                    'club': '',
                    'total_points': 0.0,
                    'scores': []
                }

            athlete_points[score.name]['total_points'] += points
            athlete_points[score.name]['scores'].append({
                'event_id': score.event_id,
                'event_season': f"{event.year} {event.season}",
                'distance': score.distance,
                'format': score.format,
                'rank': score.rank,
                'points': points
            })
        
        # 排序
        result = list(athlete_points.values())
        result.sort(key=lambda x: (-x['total_points'], x['name']))
        
        # 添加排名
        for idx, item in enumerate(result, 1):
            item['ranking'] = idx
            item['highlight'] = idx <= 8
        
        return result
