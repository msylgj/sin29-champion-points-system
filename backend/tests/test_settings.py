from app.config import Settings


def test_settings_builds_database_url_from_db_parts():
    settings = Settings(
        _env_file=None,
        database_url=None,
        db_user='user1',
        db_password='pass1',
        db_host='db.local',
        db_port=5433,
        db_name='archery',
        secret_key='secret',
    )

    assert settings.database_url == 'postgresql://user1:pass1@db.local:5433/archery'


def test_settings_accepts_release_as_false():
    settings = Settings(
        _env_file=None,
        database_url='sqlite:///./test.db',
        debug='release',
        secret_key='secret',
    )

    assert settings.debug is False
