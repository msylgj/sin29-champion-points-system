"""
成绩服务
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc
from app.models.score import Score
from app.models.athlete import Athlete
from app.schemas.score import ScoreCreate, ScoreUpdate
from app.services.scoring_calculator import ScoringCalculator
from typing import Optional, List, Tuple


class ScoreService:
    """成绩业务服务"""

    @staticmethod
    def create_score(db: Session, score: ScoreCreate) -> Score:
        """创建成绩"""
        # 验证运动员是否存在
        athlete = db.query(Athlete).filter(Athlete.id == score.athlete_id).first()
        if not athlete:
            raise ValueError(f"运动员 ID {score.athlete_id} 不存在")

        # 创建成绩记录
        db_score = Score(
            athlete_id=score.athlete_id,
            year=score.year,
            season=score.season,
            distance=score.distance,
            competition_format=score.competition_format,
            gender_group=score.gender_group,
            bow_type=score.bow_type,
            raw_score=score.raw_score,
            rank=score.rank,
            group_rank=score.group_rank,
            round=score.round,
            participant_count=score.participant_count,
            remark=score.remark,
            is_valid=1
        )

        # 计算积分
        calculator = ScoringCalculator()
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

        db_score.base_points = base_points
        db_score.points = final_points

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
        athlete_id: Optional[int] = None,
        year: Optional[int] = None,
        season: Optional[str] = None,
        distance: Optional[str] = None,
        competition_format: Optional[str] = None,
        is_valid: Optional[int] = 1
    ) -> Tuple[List[Score], int]:
        """获取成绩列表"""
        query = db.query(Score)

        if athlete_id is not None:
            query = query.filter(Score.athlete_id == athlete_id)
        if year is not None:
            query = query.filter(Score.year == year)
        if season:
            query = query.filter(Score.season == season)
        if distance:
            query = query.filter(Score.distance == distance)
        if competition_format:
            query = query.filter(Score.competition_format == competition_format)
        if is_valid is not None:
            query = query.filter(Score.is_valid == is_valid)

        total = query.count()
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
