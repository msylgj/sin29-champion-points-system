"""
所有模型导入
"""
from app.models.score import Score
from app.models.dictionary import BowTypeDict, DistanceDict, CompetitionFormatDict, CompetitionGroupDict
from app.models.event import Event
from app.models.event_configuration import EventConfiguration

__all__ = [
    # Models
    "Score",
    "BowTypeDict",
    "DistanceDict",
    "CompetitionFormatDict",
    "CompetitionGroupDict",
    "Event",
    "EventConfiguration",
]
