from app.database import Base, SessionLocal, engine
from app.models.event import Event
from app.models.event_configuration import EventConfiguration
from app.models.event_registration import EventRegistration
from app.routers.event_registration import batch_import_event_registrations, list_event_registrations
from app.schemas.event_registration import EventRegistrationBatchImport, EventRegistrationCreate, EventRegistrationUpdate
from app.services.event_registration_service import EventRegistrationService


def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def test_batch_import_event_registrations_creates_and_updates_duplicates():
    reset_database()
    db = SessionLocal()
    try:
        payload = EventRegistrationBatchImport(
            registrations=[
                EventRegistrationCreate(
                    year=2024,
                    season='春季赛',
                    name='张三',
                    club='A俱乐部',
                    distance='18m',
                    competition_bow_type='sightless',
                    points_bow_type='barebow',
                    competition_gender_group='mixed',
                )
            ]
        )

        created = batch_import_event_registrations(payload, db, {'sub': 'admin'})
        assert len(created) == 1
        assert db.query(EventRegistration).count() == 1
        assert db.query(Event).count() == 1
        created_event = db.query(Event).first()
        assert created_event.year == 2024
        assert created_event.season == '春季赛'
        created_config = db.query(EventConfiguration).filter(
            EventConfiguration.event_id == created_event.id,
            EventConfiguration.gender_group == 'mixed',
            EventConfiguration.bow_type == 'sightless',
            EventConfiguration.distance == '18m',
        ).first()
        assert created_config is not None
        assert created_config.individual_participant_count == 1

        updated_payload = EventRegistrationBatchImport(
            registrations=[
                EventRegistrationCreate(
                    year=2024,
                    season='春季赛',
                    name='张三',
                    club='B俱乐部',
                    distance='18m',
                    competition_bow_type='sightless',
                    points_bow_type='traditional',
                    competition_gender_group='women',
                )
            ]
        )

        updated = batch_import_event_registrations(updated_payload, db, {'sub': 'admin'})
        assert len(updated) == 1
        assert db.query(EventRegistration).count() == 1
        assert db.query(Event).count() == 1
        assert updated[0].club == 'B俱乐部'
        assert updated[0].points_bow_type == 'traditional'
        assert updated[0].competition_gender_group == 'women'
    finally:
        db.close()


def test_list_event_registrations_filters_by_year_and_season():
    reset_database()
    db = SessionLocal()
    try:
        db.add_all([
            EventRegistration(
                year=2024,
                season='春季赛',
                name='张三',
                club='A俱乐部',
                distance='18m',
                competition_bow_type='sightless',
                points_bow_type='barebow',
                competition_gender_group='mixed',
            ),
            EventRegistration(
                year=2023,
                season='秋季赛',
                name='李四',
                club='B俱乐部',
                distance='30m',
                competition_bow_type='recurve',
                points_bow_type='recurve',
                competition_gender_group='men',
            ),
        ])
        db.commit()

        response = list_event_registrations(
            page=1,
            page_size=20,
            year=2024,
            season='春季赛',
            name=None,
            db=db,
            _auth={'sub': 'admin'},
        )

        assert response.total == 1
        assert len(response.items) == 1
        assert response.items[0].name == '张三'
    finally:
        db.close()


def test_event_registration_update_and_delete_sync_event_configuration_counts():
    reset_database()
    db = SessionLocal()
    try:
        event = Event(year=2024, season='春季赛')
        db.add(event)
        db.flush()

        db.add(EventConfiguration(
            event_id=event.id,
            gender_group='mixed',
            bow_type='sightless',
            distance='18m',
            individual_participant_count=0,
            mixed_doubles_team_count=1,
            team_count=2,
        ))
        db.add(EventRegistration(
            year=2024,
            season='春季赛',
            name='张三',
            club='A俱乐部',
            distance='18m',
            competition_bow_type='sightless',
            points_bow_type='barebow',
            competition_gender_group='mixed',
        ))
        db.commit()

        EventRegistrationService.update_registration(
            db,
            db.query(EventRegistration).first().id,
            EventRegistrationUpdate(
                competition_bow_type='traditional',
                points_bow_type='traditional',
                competition_gender_group='women',
                distance='30m',
            ),
        )

        updated_config_old = db.query(EventConfiguration).filter(
            EventConfiguration.event_id == event.id,
            EventConfiguration.gender_group == 'mixed',
            EventConfiguration.bow_type == 'sightless',
            EventConfiguration.distance == '18m',
        ).first()
        updated_config_new = db.query(EventConfiguration).filter(
            EventConfiguration.event_id == event.id,
            EventConfiguration.gender_group == 'women',
            EventConfiguration.bow_type == 'traditional',
            EventConfiguration.distance == '30m',
        ).first()

        assert updated_config_old.individual_participant_count == 0
        assert updated_config_old.mixed_doubles_team_count == 1
        assert updated_config_old.team_count == 2
        assert updated_config_new is not None
        assert updated_config_new.individual_participant_count == 1

        registration_id = db.query(EventRegistration).first().id
        deleted = EventRegistrationService.delete_registration(db, registration_id)

        refreshed_new = db.query(EventConfiguration).filter(
            EventConfiguration.event_id == event.id,
            EventConfiguration.gender_group == 'women',
            EventConfiguration.bow_type == 'traditional',
            EventConfiguration.distance == '30m',
        ).first()

        assert deleted is True
        assert refreshed_new.individual_participant_count == 0
    finally:
        db.close()
