"""
基础配置模型 - 枚举和常量
"""
import enum


class BowType(str, enum.Enum):
    """弓种类型枚举"""
    RECURVE = "recurve"  # 反曲弓
    COMPOUND = "compound"  # 复合弓
    TRADITIONAL = "traditional"  # 传统弓
    LONGBOW = "longbow"  # 美猎弓
    BAREBOW = "barebow"  # 光弓
    SIGHTLESS = "sightless"  # 无瞄弓


class Distance(str, enum.Enum):
    """比赛距离枚举"""
    DISTANCE_10M = "10m"  # 10米
    DISTANCE_18M = "18m"  # 18米
    DISTANCE_30M = "30m"  # 30米
    DISTANCE_50M = "50m"  # 50米
    DISTANCE_70M = "70m"  # 70米


class CompetitionFormat(str, enum.Enum):
    """比赛形式/赛制枚举"""
    RANKING = "ranking"  # 排位赛
    ELIMINATION = "elimination"  # 淘汰赛
    MIXED_DOUBLES = "mixed_doubles"  # 混双赛
    TEAM = "team"  # 团体赛


class Season(str, enum.Enum):
    """赛季枚举"""
    SPRING = "春季赛"
    SUMMER = "夏季赛"
    AUTUMN = "秋季赛"
    WINTER = "冬季赛"

