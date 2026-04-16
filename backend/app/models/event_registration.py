"""
赛事报名模型
"""
from sqlalchemy import Column, Integer, String, DateTime, CheckConstraint, Index, UniqueConstraint
from sqlalchemy.sql import func
from app.database import Base


class EventRegistration(Base):
    """赛事报名表"""
    __tablename__ = "event_registrations"

    id = Column(Integer, primary_key=True)

    year = Column(Integer, nullable=False)
    season = Column(String(10), nullable=False)  # 赛季：春季赛, 夏季赛, 秋季赛, 冬季赛
    name = Column(String(100), nullable=False)
    club = Column(String(100), nullable=False)
    distance = Column(String(10), nullable=False)  # 距离：10m, 18m, 30m, 50m, 70m
    competition_bow_type = Column(String(50), nullable=False)  # 比赛弓种，允许 sightless
    points_bow_type = Column(String(50), nullable=False)  # 积分弓种，不允许 sightless
    competition_gender_group = Column(String(50), nullable=False)  # 比赛性别分组：men, women, mixed

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("season IN ('春季赛', '夏季赛', '秋季赛', '冬季赛')", name='ck_event_registration_season'),
        CheckConstraint("distance IN ('10m', '18m', '30m', '50m', '70m')", name='ck_event_registration_distance'),
        CheckConstraint(
            "competition_bow_type IN ('recurve', 'compound', 'traditional', 'longbow', 'barebow', 'sightless')",
            name='ck_event_registration_competition_bow_type',
        ),
        CheckConstraint(
            "points_bow_type IN ('recurve', 'compound', 'traditional', 'longbow', 'barebow')",
            name='ck_event_registration_points_bow_type',
        ),
        CheckConstraint(
            "competition_gender_group IN ('men', 'women', 'mixed')",
            name='ck_event_registration_gender_group',
        ),
        Index(
            'idx_event_registrations_year_points_lookup',
            'year',
            'points_bow_type',
            'season',
            'name',
            'distance',
            'competition_bow_type',
        ),
        UniqueConstraint(
            'year',
            'season',
            'name',
            'distance',
            'competition_bow_type',
            name='ux_event_registration_key',
        ),
    )
