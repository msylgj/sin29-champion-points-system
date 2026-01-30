"""
运动员服务
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.models.athlete import Athlete
from app.schemas.athlete import AthleteCreate, AthleteUpdate
from typing import Optional, List


class AthleteService:
    """运动员业务服务"""

    @staticmethod
    def create_athlete(db: Session, athlete: AthleteCreate) -> Athlete:
        """创建运动员"""
        db_athlete = Athlete(
            name=athlete.name,
            phone=athlete.phone,
            id_number=athlete.id_number,
            gender=athlete.gender
        )
        db.add(db_athlete)
        db.commit()
        db.refresh(db_athlete)
        return db_athlete

    @staticmethod
    def get_athlete_by_id(db: Session, athlete_id: int) -> Optional[Athlete]:
        """根据ID获取运动员"""
        return db.query(Athlete).filter(Athlete.id == athlete_id).first()

    @staticmethod
    def get_athlete_by_id_number(db: Session, id_number: str) -> Optional[Athlete]:
        """根据身份证号获取运动员"""
        return db.query(Athlete).filter(Athlete.id_number == id_number).first()

    @staticmethod
    def list_athletes(
        db: Session,
        skip: int = 0,
        limit: int = 10,
        search: Optional[str] = None,
        gender: Optional[str] = None
    ) -> tuple[List[Athlete], int]:
        """获取运动员列表"""
        query = db.query(Athlete)

        if search:
            query = query.filter(
                or_(
                    Athlete.name.ilike(f"%{search}%"),
                    Athlete.phone.ilike(f"%{search}%"),
                    Athlete.id_number.ilike(f"%{search}%")
                )
            )

        if gender:
            query = query.filter(Athlete.gender == gender)

        total = query.count()
        athletes = query.offset(skip).limit(limit).all()
        return athletes, total

    @staticmethod
    def update_athlete(
        db: Session,
        athlete_id: int,
        athlete_update: AthleteUpdate
    ) -> Optional[Athlete]:
        """更新运动员信息"""
        db_athlete = db.query(Athlete).filter(Athlete.id == athlete_id).first()
        if not db_athlete:
            return None

        if athlete_update.name is not None:
            db_athlete.name = athlete_update.name
        if athlete_update.phone is not None:
            db_athlete.phone = athlete_update.phone
        if athlete_update.gender is not None:
            db_athlete.gender = athlete_update.gender

        db.commit()
        db.refresh(db_athlete)
        return db_athlete

    @staticmethod
    def delete_athlete(db: Session, athlete_id: int) -> bool:
        """删除运动员"""
        db_athlete = db.query(Athlete).filter(Athlete.id == athlete_id).first()
        if not db_athlete:
            return False

        db.delete(db_athlete)
        db.commit()
        return True

    @staticmethod
    def batch_create_athletes(db: Session, athletes_data: List[AthleteCreate]) -> List[Athlete]:
        """批量创建运动员"""
        db_athletes = []
        for athlete_data in athletes_data:
            db_athlete = Athlete(
                name=athlete_data.name,
                phone=athlete_data.phone,
                id_number=athlete_data.id_number,
                gender=athlete_data.gender
            )
            db_athletes.append(db_athlete)

        db.add_all(db_athletes)
        db.commit()

        for athlete in db_athletes:
            db.refresh(athlete)

        return db_athletes
