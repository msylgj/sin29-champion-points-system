"""
赛事报名服务
"""
from typing import List, Optional, Tuple

from sqlalchemy import and_, desc
from sqlalchemy.orm import Session

from app.models.event_registration import EventRegistration
from app.schemas.event_registration import EventRegistrationCreate, EventRegistrationUpdate
from app.services.event_configuration_service import EventConfigurationService


class EventRegistrationService:
    """赛事报名业务服务"""

    SIGHTLESS_ALLOWED_POINTS_BOW_TYPES = {'barebow', 'longbow', 'traditional'}

    @staticmethod
    def _resolve_points_bow_type(competition_bow_type: str, points_bow_type: Optional[str]) -> str:
        if competition_bow_type == 'sightless':
            if points_bow_type not in EventRegistrationService.SIGHTLESS_ALLOWED_POINTS_BOW_TYPES:
                raise ValueError('无瞄弓的积分弓种仅支持：光弓、美猎弓、传统弓')
            return points_bow_type
        return competition_bow_type

    @staticmethod
    def list_registrations(
        db: Session,
        *,
        skip: int = 0,
        limit: int = 10,
        year: Optional[int] = None,
        season: Optional[str] = None,
        name: Optional[str] = None,
    ) -> Tuple[List[EventRegistration], int]:
        query = db.query(EventRegistration)

        if year is not None:
            query = query.filter(EventRegistration.year == year)
        if season:
            query = query.filter(EventRegistration.season == season)
        if name:
            query = query.filter(EventRegistration.name.ilike(f'%{name}%'))

        total = query.count()
        items = query.order_by(desc(EventRegistration.created_at), desc(EventRegistration.id)).offset(skip).limit(limit).all()
        return items, total

    @staticmethod
    def batch_create_registrations(
        db: Session,
        registrations: List[EventRegistrationCreate],
    ) -> List[EventRegistration]:
        result: List[EventRegistration] = []
        sync_pairs = set()

        for item in registrations:
            resolved_points_bow_type = EventRegistrationService._resolve_points_bow_type(
                item.competition_bow_type,
                item.points_bow_type,
            )
            existing = db.query(EventRegistration).filter(
                and_(
                    EventRegistration.year == item.year,
                    EventRegistration.season == item.season,
                    EventRegistration.name == item.name,
                    EventRegistration.distance == item.distance,
                    EventRegistration.competition_bow_type == item.competition_bow_type,
                )
            ).first()

            if existing:
                existing.club = item.club
                existing.points_bow_type = resolved_points_bow_type
                existing.competition_gender_group = item.competition_gender_group
                db.flush()
                result.append(existing)
                sync_pairs.add((item.year, item.season))
                continue

            created = EventRegistration(
                year=item.year,
                season=item.season,
                name=item.name,
                club=item.club,
                distance=item.distance,
                competition_bow_type=item.competition_bow_type,
                points_bow_type=resolved_points_bow_type,
                competition_gender_group=item.competition_gender_group,
            )
            db.add(created)
            db.flush()
            result.append(created)
            sync_pairs.add((item.year, item.season))

        db.commit()
        for year, season in sync_pairs:
            EventConfigurationService.sync_individual_counts_from_registrations(db, year, season)
        for row in result:
            db.refresh(row)
        return result

    @staticmethod
    def update_registration(
        db: Session,
        registration_id: int,
        registration_update: EventRegistrationUpdate
    ) -> Optional[EventRegistration]:
        db_registration = db.query(EventRegistration).filter(EventRegistration.id == registration_id).first()
        if not db_registration:
            return None

        old_year = db_registration.year
        old_season = db_registration.season

        if registration_update.name is not None:
            db_registration.name = registration_update.name
        if registration_update.club is not None:
            db_registration.club = registration_update.club
        if registration_update.distance is not None:
            db_registration.distance = registration_update.distance
        if registration_update.competition_bow_type is not None:
            db_registration.competition_bow_type = registration_update.competition_bow_type
        if registration_update.competition_gender_group is not None:
            db_registration.competition_gender_group = registration_update.competition_gender_group

        if registration_update.points_bow_type is not None:
            db_registration.points_bow_type = registration_update.points_bow_type

        db_registration.points_bow_type = EventRegistrationService._resolve_points_bow_type(
            db_registration.competition_bow_type,
            db_registration.points_bow_type,
        )

        duplicate = db.query(EventRegistration).filter(
            and_(
                EventRegistration.id != registration_id,
                EventRegistration.year == db_registration.year,
                EventRegistration.season == db_registration.season,
                EventRegistration.name == db_registration.name,
                EventRegistration.distance == db_registration.distance,
                EventRegistration.competition_bow_type == db_registration.competition_bow_type,
            )
        ).first()
        if duplicate:
            raise ValueError('该报名已存在，请勿重复保存')

        db.commit()
        EventConfigurationService.sync_individual_counts_from_registrations(db, old_year, old_season)
        db.refresh(db_registration)
        return db_registration

    @staticmethod
    def delete_registration(db: Session, registration_id: int) -> bool:
        db_registration = db.query(EventRegistration).filter(EventRegistration.id == registration_id).first()
        if not db_registration:
            return False

        year = db_registration.year
        season = db_registration.season
        db.delete(db_registration)
        db.commit()
        EventConfigurationService.sync_individual_counts_from_registrations(db, year, season)
        return True
