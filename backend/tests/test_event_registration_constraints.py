from sqlalchemy.exc import IntegrityError

from app.database import Base, SessionLocal, engine
from app.models.event_registration import EventRegistration


def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def test_event_registration_points_bow_type_rejects_sightless():
    reset_database()
    db = SessionLocal()
    try:
        db.add(
            EventRegistration(
                year=2024,
                season='春季赛',
                name='张三',
                club='A俱乐部',
                distance='30m',
                competition_bow_type='sightless',
                points_bow_type='sightless',
                competition_gender_group='mixed',
            )
        )

        try:
            db.commit()
            raise AssertionError('expected IntegrityError')
        except IntegrityError:
            db.rollback()
    finally:
        db.close()


def test_event_registration_allows_sightless_competition_bow_type_with_regular_points_bow_type():
    reset_database()
    db = SessionLocal()
    try:
        db.add(
            EventRegistration(
                year=2024,
                season='春季赛',
                name='李四',
                club='B俱乐部',
                distance='30m',
                competition_bow_type='sightless',
                points_bow_type='barebow',
                competition_gender_group='mixed',
            )
        )
        db.commit()

        assert db.query(EventRegistration).count() == 1
    finally:
        db.close()
