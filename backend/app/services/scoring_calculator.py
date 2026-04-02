"""
积分计算服务 - 根据比赛规则和排名自动计算积分

计分规则说明:
1. 排位赛(单项):
   - 排名1-8: 25, 22, 19, 15, 10, 8, 6, 4分
   
2. 淘汰赛:
   - 排名1-8: 45, 40, 35, 30, 20, 20, 20, 20分
   - 排名9-12: 15分
   - 排名13-16: 10分

3. 参赛人数与系数规则 (单项):
   - 8-15人: 系数0.6, 1-4名获得基础积分
   - 16-31人: 系数0.8, 1-8名获得基础积分
   - 32-63人: 系数1.0, 1-16名获得基础积分
   - 64-127人: 系数1.2, 1-16名获得基础积分
   - 128人以上: 系数1.4, 1-16名获得基础积分

4. 组别积分系数规则:
    - 根据弓种+距离匹配组别
    - B组：积分×0.5
    - C组：积分×0.3
    - S/A组或未匹配：积分不变

5. 团体赛规则:
   - 排名1-8: 20, 15, 10, 8, 5, 4, 3, 2分(每人)
   - 单项队伍占数系数：
     * 3-4队: 0.6, 1-2名获得基础积分
     * 5-7队: 0.8, 1-4名获得基础积分
     * 8-10队: 1.0, 1-8名获得基础积分
     * 11-14队: 1.2, 1-8名获得基础积分
     * 14队以上: 1.4, 1-8名获得基础积分
"""
from typing import Dict, Optional, Tuple


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
    
    # 参赛人数与系数映射 (单项赛)
    PARTICIPANT_COEFFICIENTS = {
        (8, 15): (0.6, 4),      # 8-15人：系数0.6，1-4名获得基础积分
        (16, 31): (0.8, 8),     # 16-31人：系数0.8，1-8名获得基础积分
        (32, 63): (1.0, 16),    # 32-63人：系数1.0，1-16名获得基础积分
        (64, 127): (1.2, 16),   # 64-127人：系数1.2，1-16名获得基础积分
        (128, float('inf')): (1.4, 16)  # 128人以上：系数1.4，1-16名获得基础积分
    }
    
    # 队伍数与系数映射 (团体赛)
    TEAM_COEFFICIENTS = {
        (3, 4): (0.6, 2),       # 3-4队：系数0.6，1-2名获得基础积分
        (5, 7): (0.8, 4),       # 5-7队：系数0.8，1-4名获得基础积分
        (8, 10): (1.0, 8),      # 8-10队：系数1.0，1-8名获得基础积分
        (11, 14): (1.2, 8),     # 11-14队：系数1.2，1-8名获得基础积分
        (15, float('inf')): (1.4, 8)  # 15队以上：系数1.4，1-8名获得基础积分
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
            组别系数（B=0.5, C=0.3, 其他=1.0）
        """
        if not bow_type:
            return 1.0

        group_code = competition_groups.get((bow_type, distance))
        if not group_code:
            return 1.0
        return ScoringCalculator.GROUP_MULTIPLIERS.get(group_code, 1.0)
    
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
        competition_groups: Dict[tuple, str],
        bow_type: Optional[str] = None,
        distance: str = "30m",
        participant_count: Optional[int] = None
    ) -> float:
        """
        计算最终积分
        
        规则说明：
        1. 获取基础积分（排名超出表范围时为1分）
        2. 获取系数和"原额积分"的排名限制
        3. 如果排名在限制内，使用步骤1的基础积分；否则替换为1分
        4. 计算：基础积分 × 系数
        5. 根据弓种+距离匹配组别系数（B组×0.5，C组×0.3）
        
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
        
        # 步骤4：计算最终积分：基础积分 × 系数
        final_points = base_points * coefficient
        
        # 步骤5：组别系数调整
        group_multiplier = ScoringCalculator.get_group_multiplier(bow_type, distance, competition_groups)
        final_points *= group_multiplier
        
        return round(final_points, 2)
    
