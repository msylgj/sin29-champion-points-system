"""
成绩服务 - 简化版本
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
from app.models.score import Score
from app.models.event import Event
from app.models.event_configuration import EventConfiguration
from app.schemas.score import ScoreCreate, ScoreUpdate
from app.services.scoring_calculator import ScoringCalculator
from typing import Optional, List, Tuple, Dict


class ScoreService:
    """成绩业务服务"""

    @staticmethod
    def _get_participant_count_for_format(config: EventConfiguration, competition_format: str) -> int:
        """根据赛制从简化配置中读取对应人数/队伍数"""
        if competition_format in ("ranking", "elimination"):
            return config.individual_participant_count
        if competition_format == "mixed_doubles":
            return config.mixed_doubles_team_count
        if competition_format == "team":
            return config.team_count
        return config.individual_participant_count

    @staticmethod
    def create_score(db: Session, score: ScoreCreate) -> Score:
        """创建成绩"""
        # 验证赛事是否存在
        event = db.query(Event).filter(Event.id == score.event_id).first()
        if not event:
            raise ValueError(f"赛事 ID {score.event_id} 不存在")

        # 创建成绩记录
        db_score = Score(
            event_id=score.event_id,
            name=score.name,
            club=score.club,
            bow_type=score.bow_type,
            distance=score.distance,
            format=score.format,
            rank=score.rank
        )

        db.add(db_score)
        db.commit()
        db.refresh(db_score)
        return db_score

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
        scores = query.order_by(desc(Score.created_at)).offset(skip).limit(limit).all()
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
        if score_update.club is not None:
            db_score.club = score_update.club
        if score_update.bow_type is not None:
            db_score.bow_type = score_update.bow_type
        if score_update.distance is not None:
            db_score.distance = score_update.distance
        if score_update.format is not None:
            db_score.format = score_update.format
        if score_update.rank is not None:
            db_score.rank = score_update.rank

        db.commit()
        db.refresh(db_score)
        return db_score

    @staticmethod
    def batch_create_scores(db: Session, scores: List[ScoreCreate]) -> List[Score]:
        """批量创建成绩"""
        result = []
        for score in scores:
            created = ScoreService.create_score(db, score)
            result.append(created)
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
        # 获取该年度该弓种的所有成绩
        scores = db.query(Score).filter(
            Score.bow_type == bow_type
        ).all()
        
        # 按赛事过滤年度
        filtered_scores = []
        for score in scores:
            event = db.query(Event).filter(Event.id == score.event_id).first()
            if event and event.year == year:
                filtered_scores.append(score)
        
        # 按选手+俱乐部聚合积分
        athlete_points = {}  # key: (name, club), value: dict
        
        for score in filtered_scores:
            event = db.query(Event).filter(Event.id == score.event_id).first()
            
            # 获取赛事配置以获取参赛人数
            config = db.query(EventConfiguration).filter(
                and_(
                    EventConfiguration.event_id == score.event_id,
                    EventConfiguration.bow_type == score.bow_type,
                    EventConfiguration.distance == score.distance
                )
            ).first()
            
            # 如果没有配置，使用默认人数（8）而不是跳过
            participant_count = ScoreService._get_participant_count_for_format(config, score.format) if config else 8
            
            # 计算积分
            points = ScoringCalculator.calculate_points(
                rank=score.rank,
                competition_format=score.format,
                bow_type=score.bow_type,
                distance=score.distance,
                participant_count=participant_count
            )
            
            key = (score.name, score.club)
            if key not in athlete_points:
                athlete_points[key] = {
                    'name': score.name,
                    'club': score.club,
                    'total_points': 0.0,
                    'scores': []
                }
            
            athlete_points[key]['total_points'] += points
            athlete_points[key]['scores'].append({
                'event_id': score.event_id,
                'event_season': f"{event.year} {event.season}",
                'distance': score.distance,
                'format': score.format,
                'rank': score.rank,
                'points': points
            })
        
        # 排序
        result = list(athlete_points.values())
        result.sort(key=lambda x: x['total_points'], reverse=True)
        
        # 添加排名
        for idx, item in enumerate(result, 1):
            item['ranking'] = idx
            item['highlight'] = idx <= 8
        
        return result
