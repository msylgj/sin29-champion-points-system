"""
所有模型导入
"""
from app.models.score import Score
from app.models.dictionary import (
    BowTypeDict,
    DistanceDict,
    CompetitionFormatDict,
    CompetitionGenderGroupDict,
    CompetitionGroupDict,
)
from app.models.event import Event
from app.models.event_configuration import EventConfiguration
from app.models.event_registration import EventRegistration

__all__ = [
    # Models
    "Score",
    "BowTypeDict",
    "DistanceDict",
    "CompetitionFormatDict",
    "CompetitionGenderGroupDict",
    "CompetitionGroupDict",
    "Event",
    "EventConfiguration",
    "EventRegistration",
]
