import pytest
from pydantic import ValidationError

from app.config import Settings


def test_settings_requires_explicit_database_url(monkeypatch):
    monkeypatch.delenv('DATABASE_URL', raising=False)

    with pytest.raises(ValidationError) as exc_info:
        Settings(
            _env_file=None,
            secret_key='secret',
        )

    assert 'database_url' in str(exc_info.value)


def test_settings_accepts_explicit_database_url():
    settings = Settings(
        _env_file=None,
        database_url='postgresql://user1:pass1@db.local:5433/archery',
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
