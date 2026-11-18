"""积分计算：生产查询使用赛事对应的规则版本配置。

硬编码常量仅用于初始规则快照及无config的兼容调用，不代表所有赛事的现行规则。
分项完整乘算后四舍五入保留1位小数；年度汇总使用这些已舍入分项。
"""
from decimal import Decimal, ROUND_HALF_UP, localcontext
from typing import Dict, Optional, Tuple

from app.schemas.scoring_rule import ScoringRuleConfig


class ScoringCalculator:
    """积分计算器"""
    
    # 排位赛基础积分表
    RANKING_POINTS = {
        1: 25, 2: 22, 3: 19, 4: 15, 5: 10, 6: 8, 7: 6, 8: 4
    }
    
    # 淘汰赛基础积分表
    ELIMINATION_POINTS = {
        1: 45, 2: 40, 3: 35, 4: 30, 
        5: 20, 6: 20, 7: 20, 8: 20,
        9: 15, 10: 15, 11: 15, 12: 15,
        13: 10, 14: 10, 15: 10, 16: 10
    }
    
    # 团体赛基础积分表(每人)
    TEAM_POINTS = {
        1: 20, 2: 15, 3: 10, 4: 8, 5: 5, 6: 4, 7: 3, 8: 2
    }
    
    # 人数区间 -> (系数, 保留基础积分的排名上限)，用于初始快照和兼容调用
    PARTICIPANT_COEFFICIENTS = {
        (2, 3): (0.2, 1),
        (4, 7): (0.4, 2),
        (8, 15): (0.6, 4),
        (16, 31): (0.8, 8),
        (32, 63): (1.0, 16),
        (64, 127): (1.2, 16),
        (128, float('inf')): (1.4, 16)
    }
    
    # 团体/混双队伍数区间使用相同结构
    TEAM_COEFFICIENTS = {
        (2, 4): (0.6, 2),
        (5, 7): (0.8, 4),
        (8, 10): (1.0, 8),
        (11, 14): (1.2, 8),
        (15, float('inf')): (1.4, 8)
    }

    GROUP_MULTIPLIERS = {
        "S": 1.0,
        "A": 1.0,
        "B": 0.5,
        "C": 0.3,
    }

    @staticmethod
    def get_group_multiplier(
        bow_type: Optional[str],
        distance: str,
        competition_groups: Dict[tuple, str]
    ) -> float:
        """
        获取组别积分系数

        Args:
            bow_type: 弓种
            distance: 距离
            competition_groups: 从数据库加载的组别映射 {(bow_type, distance): group_code}

        Returns:
            组别系数（S=1.0, A=1.0, B=0.5, C=0.3, 未匹配=0）
        """
        if not bow_type:
            return 0.0

        group_code = competition_groups.get((bow_type, distance))
        if not group_code:
            return 0.0
        return ScoringCalculator.GROUP_MULTIPLIERS.get(group_code, 0.0)
    
    @staticmethod
    def calculate_base_points(rank: int, competition_format: str) -> float:
        """
        计算基础积分（根据排名和赛制）
        超出排名表范围的选手获得1分的基础积分
        
        Args:
            rank: 排名（1开始）
            competition_format: 赛制 ('ranking', 'elimination', 'mixed_doubles', 'team')
            
        Returns:
            基础积分
        """
        if competition_format == "ranking":
            return float(ScoringCalculator.RANKING_POINTS.get(rank, 1))
        
        elif competition_format == "elimination":
            return float(ScoringCalculator.ELIMINATION_POINTS.get(rank, 1))
        
        elif competition_format in ("mixed_doubles", "team"):
            return float(ScoringCalculator.TEAM_POINTS.get(rank, 1))
        
        return 1.0  # 其他情况返回1分
    
    @staticmethod
    def get_coefficient_and_cutoff(
        participant_count: int,
        competition_format: str
    ) -> Tuple[float, int]:
        """
        获取参赛人数对应的系数和获得基础积分的人数限制
        
        Args:
            participant_count: 参赛人数
            competition_format: 赛制类型
            
        Returns:
            (系数, 获得基础积分的人数上限)
        """
        if participant_count is None:
            return 1.0, float('inf')
        
        # 团体赛和混双赛使用团队系数表，其他赛制使用参赛人数系数表
        if competition_format in ("team", "mixed_doubles"):
            coefficients = ScoringCalculator.TEAM_COEFFICIENTS
        else:
            coefficients = ScoringCalculator.PARTICIPANT_COEFFICIENTS
        
        # 查找匹配的范围
        for (min_count, max_count), (coeff, cutoff) in coefficients.items():
            if min_count <= participant_count <= max_count:
                return coeff, cutoff
        
        # 默认值
        return 1.0, float('inf')
    
    @staticmethod
    def calculate_points(
        rank: int,
        competition_format: str,
        competition_groups: Optional[Dict[tuple, str]] = None,
        bow_type: Optional[str] = None,
        distance: str = "30m",
        participant_count: Optional[int] = None,
        config: Optional[ScoringRuleConfig] = None,
    ) -> float:
        """
        计算最终积分
        
        规则说明：
        1. 获取基础积分（排名超出表范围时为1分）
        2. 获取系数和"原额积分"的排名限制
        3. 如果排名在限制内，使用步骤1的基础积分；否则替换为1分
        4. 计算：基础积分 × 系数
        5. 根据弓种+距离匹配组别系数（B组×0.5，C组×0.3）
        6. 完整乘算后按分项四舍五入保留1位小数，供展示和汇总共用
        
        Args:
            rank: 排名（1开始）
            competition_format: 赛制 ('ranking', 'elimination', 'mixed_doubles', 'team')
            competition_groups: 从数据库加载的组别映射 {(bow_type, distance): group_code}
            bow_type: 弓种（用于匹配组别系数）
            distance: 距离 (默认'30m')
            participant_count: 参赛人数（用于计算系数）
            
        Returns:
            最终积分
        """
        if config is not None:
            return ScoringCalculator._calculate_versioned_points(
                rank, competition_format, bow_type, distance, participant_count, config,
            )

        # 无config的直接调用保留既有行为；生产统计始终传入赛事对应的版本快照。
        competition_groups = competition_groups or {}
        # 步骤1：获取基础积分
        base_points = ScoringCalculator.calculate_base_points(rank, competition_format)
        
        # 步骤2：获取系数和排名限制
        coefficient, cutoff = ScoringCalculator.get_coefficient_and_cutoff(
            participant_count, competition_format
        )
        
        # 步骤3：检查是否在"原额积分"限制范围内
        # 如果排名超出限制，使用1分的基础积分
        if rank > cutoff:
            base_points = 1.0
        
        # 完整分项应用所有系数后再舍入；不在中间乘算阶段损失精度。
        # 从十进制字符串构造，避免二进制浮点误差和 round 的银行家舍入。
        group_multiplier = ScoringCalculator.get_group_multiplier(bow_type, distance, competition_groups)
        final_points = (
            Decimal(str(base_points))
            * Decimal(str(coefficient))
            * Decimal(str(group_multiplier))
        )
        return float(final_points.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))
    
    @staticmethod
    def _calculate_versioned_points(rank, competition_format, bow_type, distance, participant_count, config):
        if isinstance(config, dict):
            config = ScoringRuleConfig.model_validate(config)
        team_format = competition_format in ("team", "mixed_doubles")
        points_table = (
            config.team_points if team_format else
            config.elimination_points if competition_format == "elimination" else
            config.ranking_points if competition_format == "ranking" else []
        )
        base_points = points_table[rank - 1] if 1 <= rank <= len(points_table) else config.fallback_base_points
        count = participant_count or config.default_participant_count
        coefficient, cutoff = 1.0, float("inf")
        # 历史特殊值1（及负数）保留原先不打折、不限制名次的行为；仅缺失/0使用默认人数。
        if count >= 2:
            ranges = config.team_coefficients if team_format else config.individual_coefficients
            selected = next((row for row in ranges if row.min_count <= count and
                             (row.max_count is None or count <= row.max_count)), None)
            if selected is None:
                selected = next(row for row in ranges if row.min_count <= config.default_participant_count and
                                (row.max_count is None or config.default_participant_count <= row.max_count))
            coefficient, cutoff = selected.coefficient, selected.cutoff
        if rank > cutoff:
            base_points = config.fallback_base_points
        group_code = next((row.group_code for row in config.competition_groups
                           if row.bow_type == bow_type and row.distance == distance), None)
        group_multiplier = getattr(config.group_multipliers, group_code, 0.0) if group_code else 0.0
        # 配置数值最多三个float的十进制有效位，64位上下文保留完整乘算精度。
        with localcontext() as context:
            context.prec = 64
            final_points = Decimal(str(base_points)) * Decimal(str(coefficient)) * Decimal(str(group_multiplier))
            return float(final_points.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))
