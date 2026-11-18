"""计分规则管理的完整、强类型配置契约。"""
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


NonNegativeNumber = Annotated[float, Field(strict=True, ge=0, le=10_000, allow_inf_nan=False)]
PositiveInt = Annotated[int, Field(strict=True, ge=1, le=2147483647)]
Count = Annotated[int, Field(strict=True, ge=2, le=2147483647)]
BowType = Literal["barebow", "longbow", "traditional", "sightless", "recurve", "compound"]
Distance = Literal["10m", "18m", "30m", "50m", "70m"]
Season = Literal["春季赛", "夏季赛", "秋季赛", "冬季赛"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CoefficientRange(StrictModel):
    min_count: Count
    max_count: Optional[Count]
    coefficient: NonNegativeNumber
    cutoff: PositiveInt

    @model_validator(mode="after")
    def validate_range(self):
        if self.max_count is not None and self.max_count < self.min_count:
            raise ValueError("人数区间上限不得小于下限")
        return self


class GroupMultipliers(StrictModel):
    S: NonNegativeNumber
    A: NonNegativeNumber
    B: NonNegativeNumber
    C: NonNegativeNumber


class CompetitionGroupSnapshot(StrictModel):
    bow_type: BowType
    distance: Distance
    group_code: Literal["S", "A", "B", "C"]


class ScoringRuleConfig(StrictModel):
    ranking_points: list[NonNegativeNumber] = Field(min_length=1)
    elimination_points: list[NonNegativeNumber] = Field(min_length=1)
    team_points: list[NonNegativeNumber] = Field(min_length=1)
    individual_coefficients: list[CoefficientRange] = Field(min_length=1)
    team_coefficients: list[CoefficientRange] = Field(min_length=1)
    group_multipliers: GroupMultipliers
    competition_groups: list[CompetitionGroupSnapshot]
    fallback_base_points: NonNegativeNumber
    default_participant_count: Count
    precision: Literal[1] = 1
    rounding: Literal["half_up"] = "half_up"

    @model_validator(mode="after")
    def safe_product_range(self):
        base = max(self.ranking_points + self.elimination_points + self.team_points + [self.fallback_base_points])
        coefficient = max([1.0] + [row.coefficient for row in self.individual_coefficients + self.team_coefficients])
        multiplier = max(self.group_multipliers.model_dump().values())
        if Decimal(str(base)) * Decimal(str(coefficient)) * Decimal(str(multiplier)) > Decimal("1e12"):
            raise ValueError("单项积分的最大乘积不得超过1万亿，避免结果超出安全精度范围")
        return self

    @field_validator("precision", mode="before")
    @classmethod
    def fixed_precision(cls, value):
        if type(value) is not int or value != 1:
            raise ValueError("分项积分精度固定为1位")
        return value

    @field_validator("individual_coefficients", "team_coefficients")
    @classmethod
    def continuous_ranges(cls, rows):
        expected = 2
        for index, row in enumerate(rows):
            if row.min_count != expected:
                raise ValueError("系数区间必须从2开始连续排列，不得重叠或留空")
            if row.max_count is None:
                if index != len(rows) - 1:
                    raise ValueError("无上限区间只能位于最后一行")
            else:
                if index == len(rows) - 1:
                    raise ValueError("最后一个系数区间必须无上限")
                expected = row.max_count + 1
        return rows

    @field_validator("competition_groups")
    @classmethod
    def unique_groups(cls, rows):
        keys = [(row.bow_type, row.distance) for row in rows]
        if len(keys) != len(set(keys)):
            raise ValueError("弓种和距离的组别映射不得重复")
        return rows


class ScoringRuleCreate(StrictModel):
    name: str = Field(min_length=1, max_length=100)
    base_rule_id: PositiveInt
    previous_end_event_id: PositiveInt
    config: Optional[ScoringRuleConfig] = None

    @field_validator("name", mode="before")
    @classmethod
    def trim_name(cls, value):
        return value.strip() if isinstance(value, str) else value


class RulePeriod(StrictModel):
    year: int
    season: Season


class ScoringRuleRead(StrictModel):
    id: int
    name: str
    source_rule_id: Optional[int]
    start: Optional[RulePeriod]
    end: Optional[RulePeriod]
    created_at: datetime
    config: ScoringRuleConfig


class ScoringRuleList(StrictModel):
    items: list[ScoringRuleRead]


class ScoringRuleDeleteResult(StrictModel):
    deleted_rule_id: int
    restored_rule: ScoringRuleRead
