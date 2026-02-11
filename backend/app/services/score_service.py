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
    def get_score_by_id(db: Session, score_id: int) -> Optional[Score]:
        """根据ID获取成绩"""
        return db.query(Score).filter(Score.id == score_id).first()

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
        if score_update.rank is not None:
            db_score.rank = score_update.rank

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
    def batch_create_scores(db: Session, scores: List[ScoreCreate]) -> List[Score]:
        """批量创建成绩"""
        result = []
        for score in scores:
            created = ScoreService.create_score(db, score)
            result.append(created)
        return result

    @staticmethod
    def get_scores_by_event_and_bow(
        db: Session,
        event_id: int,
        bow_type: str,
        distance: str,
        format: str = "ranking"
    ) -> List[Dict]:
        """获取某赛事某弓种的所有成绩，并计算积分
        
        返回排序后的列表，每项包含成绩信息和动态计算的积分
        """
        # 获取赛事配置，得到参赛人数
        config = db.query(EventConfiguration).filter(
            and_(
                EventConfiguration.event_id == event_id,
                EventConfiguration.bow_type == bow_type,
                EventConfiguration.distance == distance,
                EventConfiguration.format == format
            )
        ).first()
        
        if not config:
            raise ValueError(f"未找到该赛事配置：事件{event_id}, 弓种{bow_type}, 距离{distance}, 格式{format}")
        
        participant_count = config.participant_count
        
        # 获取该比赛的所有成绩，并按排名排序
        scores = db.query(Score).filter(
            and_(
                Score.event_id == event_id,
                Score.bow_type == bow_type,
                Score.distance == distance,
                Score.format == format
            )
        ).order_by(Score.rank).all()
        
        # 计算积分并组装返回数据
        result = []
        for idx, score in enumerate(scores, 1):
            points = ScoringCalculator.calculate_points(
                rank=score.rank,
                competition_format=score.format,
                distance=score.distance,
                participant_count=participant_count
            )
            result.append({
                'id': score.id,
                'display_rank': idx,  # 显示排名（按显示顺序）
                'official_rank': score.rank,  # 官方排名
                'name': score.name,
                'club': score.club,
                'bow_type': score.bow_type,
                'distance': score.distance,
                'format': score.format,
                'points': points,
                'highlight': idx <= 8  # 前8名突出显示
            })
        
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
        from sqlalchemy import and_
        
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
                    EventConfiguration.distance == score.distance,
                    EventConfiguration.format == score.format
                )
            ).first()
            
            if not config:
                # 如果没有配置，跳过（不应该发生）
                continue
            
            # 计算积分
            points = ScoringCalculator.calculate_points(
                rank=score.rank,
                competition_format=score.format,
                distance=score.distance,
                participant_count=config.participant_count
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

        scores = query.order_by(desc(Score.created_at)).offset(skip).limit(limit).all()
        return scores, total

    @staticmethod
    def update_score(
        db: Session,
        score_id: int,
        score_update: ScoreUpdate
    ) -> Optional[Score]:
        """更新成绩"""
        db_score = db.query(Score).filter(Score.id == score_id).first()
        if not db_score:
            return None

        if score_update.raw_score is not None:
            db_score.raw_score = score_update.raw_score
        if score_update.rank is not None:
            db_score.rank = score_update.rank
        if score_update.group_rank is not None:
            db_score.group_rank = score_update.group_rank
        if score_update.participant_count is not None:
            db_score.participant_count = score_update.participant_count
        if score_update.remark is not None:
            db_score.remark = score_update.remark

        # 重新计算积分
        calculator = ScoringCalculator()
        if db_score.rank:
            final_points = calculator.calculate_points(
                rank=db_score.rank,
                competition_format=db_score.competition_format,
                distance=db_score.distance,
                participant_count=db_score.participant_count
            )
            base_points = calculator.calculate_base_points(
                rank=db_score.rank,
                competition_format=db_score.competition_format
            )
        else:
            base_points = 0.0
            final_points = 0.0

        db_score.base_points = base_points
        db_score.points = final_points

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
    def batch_create_scores(db: Session, scores_data: List[ScoreCreate]) -> List[Score]:
        """批量创建成绩"""
        calculator = ScoringCalculator()
        db_scores = []

        for score_data in scores_data:
            # 验证运动员
            athlete = db.query(Athlete).filter(Athlete.id == score_data.athlete_id).first()
            if not athlete:
                raise ValueError(f"运动员 ID {score_data.athlete_id} 不存在")

            db_score = Score(
                athlete_id=score_data.athlete_id,
                year=score_data.year,
                season=score_data.season,
                distance=score_data.distance,
                competition_format=score_data.competition_format,
                gender_group=score_data.gender_group,
                bow_type=score_data.bow_type,
                raw_score=score_data.raw_score,
                rank=score_data.rank,
                group_rank=score_data.group_rank,
                round=score_data.round,
                participant_count=score_data.participant_count,
                remark=score_data.remark,
                is_valid=1
            )

            # 计算积分
            base_points = calculator.calculate_base_points(
                rank=score_data.rank,
                competition_format=score_data.competition_format,
                participant_count=score_data.participant_count
            )
            final_points = calculator.calculate_final_points(
                base_points=base_points,
                distance=score_data.distance
            )

            db_score.base_points = base_points
            db_score.points = final_points
            db_scores.append(db_score)

        db.add_all(db_scores)
        db.commit()

        for score in db_scores:
            db.refresh(score)

        return db_scores

    @staticmethod
    def recalculate_all_scores(db: Session) -> int:
        """重新计算所有成绩的积分"""
        scores = db.query(Score).filter(Score.is_valid == 1).all()
        calculator = ScoringCalculator()

        for score in scores:
            if score.rank:
                final_points = calculator.calculate_points(
                    rank=score.rank,
                    competition_format=score.competition_format,
                    distance=score.distance,
                    participant_count=score.participant_count
                )
                base_points = calculator.calculate_base_points(
                    rank=score.rank,
                    competition_format=score.competition_format
                )
            else:
                base_points = 0.0
                final_points = 0.0

            score.base_points = base_points
            score.points = final_points

        db.commit()
        return len(scores)

    @staticmethod
    def get_athlete_scores(
        db: Session,
        athlete_id: int,
        year: Optional[int] = None,
        season: Optional[str] = None
    ) -> List[Score]:
        """获取运动员的所有成绩"""
        query = db.query(Score).filter(
            and_(
                Score.athlete_id == athlete_id,
                Score.is_valid == 1
            )
        )

        if year is not None:
            query = query.filter(Score.year == year)
        if season:
            query = query.filter(Score.season == season)

        return query.order_by(desc(Score.created_at)).all()
