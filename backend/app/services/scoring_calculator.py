"""
积分计算服务 - 根据比赛规则和排名自动计算积分

计分规则说明（来自point.jpg）:
1. 排名赛(单项):
   - 排名1-8: 25, 22, 19, 15, 10, 8, 6, 4分
   
2. 淘汰赛:
   - 排名1-8: 45, 40, 35, 30, 20, 20, 20, 20分
   - 排名9-16: 15分

3. 参赛人数与系数规则 (单项):
   - 8-15人: 系数0.6, 1-4名获得基础积分
   - 16-31人: 系数0.8, 1-8名获得基础积分
   - 32-63人: 系数1.0, 1-16名获得基础积分
   - 64-127人: 系数1.2, 1-16名获得基础积分
   - 128人以上: 系数1.4, 1-16名获得基础积分

4. 18米特殊规则:
   - 所有18米比赛的积分在基础上减半(×0.5)

5. 团体赛规则:
   - 排名1-8: 20, 15, 10, 8, 5, 4, 3, 2分(每人)
   - 单项队伍占数系数：
     * 3-4队: 0.6, 1-2名获得基础积分
     * 5-7队: 0.8, 1-4名获得基础积分
     * 8-10队: 1.0, 1-8名获得基础积分
     * 11-14队: 1.2, 1-8名获得基础积分
     * 14队以上: 1.4, 1-8名获得基础积分
"""
from typing import Dict, Optional, List, Tuple
import json


class ScoringCalculator:
    """积分计算器"""
    
    # 排名赛基础积分表
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
    
    @staticmethod
    def calculate_base_points(rank: int, competition_format: str) -> float:
        """
        计算基础积分（根据排名和赛制）
        超出排名表范围的选手获得1分的基础积分
        
        Args:
            rank: 排名（1开始）
            competition_format: 赛制 ('ranking', 'elimination', 'team')
            
        Returns:
            基础积分
        """
        if competition_format == "ranking":
            return float(ScoringCalculator.RANKING_POINTS.get(rank, 1))
        
        elif competition_format == "elimination":
            return float(ScoringCalculator.ELIMINATION_POINTS.get(rank, 1))
        
        elif competition_format == "team":
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
        if participant_count is None or participant_count < 8:
            # 如果人数不足，使用基础系数1.0，不限制排名
            return 1.0, float('inf')
        
        # 单项赛和团体赛使用不同的系数表
        if competition_format == "team":
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
        5. 如果是18米，再乘以0.5
        
        Args:
            rank: 排名（1开始）
            competition_format: 赛制 ('ranking', 'elimination', 'team')
            distance: 距离 (默认'30m'，'18m'时积分减半)
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
        
        # 步骤5：18米比赛积分减半
        if distance == "18m":
            final_points *= 0.5
        
        return round(final_points, 2)
    
    @staticmethod
    def build_scoring_rule_config(
        use_cutoff: bool = True
    ) -> Dict:
        """
        构建积分规则配置（JSON格式，存储到数据库）
        
        Args:
            use_cutoff: 是否使用排名限制
            
        Returns:
            积分规则配置字典
        """
        return {
            "type": "rank_based",
            "version": "1.0",
            "description": "射箭比赛积分规则 - 支持排名赛、淘汰赛、团体赛",
            "rules": {
                "ranking": {
                    "base_points": ScoringCalculator.RANKING_POINTS,
                    "coefficients": ScoringCalculator.PARTICIPANT_COEFFICIENTS
                },
                "elimination": {
                    "base_points": ScoringCalculator.ELIMINATION_POINTS,
                    "default_points_9_16": 15,
                    "coefficients": ScoringCalculator.PARTICIPANT_COEFFICIENTS
                },
                "team": {
                    "base_points": ScoringCalculator.TEAM_POINTS,
                    "coefficients": ScoringCalculator.TEAM_COEFFICIENTS
                }
            },
            "special_rules": {
                "18m_discount": 0.5,
                "use_participant_count_coefficient": use_cutoff
            }
        }


class PointsAggregator:
    """积分汇总器 - 计算运动员的总积分和排名"""
    
    @staticmethod
    def aggregate_athlete_points(
        scores: List,
        year: int,
        season: Optional[str] = None,
        group_by_gender: bool = False,
        group_by_bow_type: bool = False
    ) -> Dict:
        """
        汇总运动员的积分
        
        Args:
            scores: Score对象列表
            year: 年度
            season: 季度（可选，None表示全年）
            group_by_gender: 是否按性别分组统计
            group_by_bow_type: 是否按弓种分组统计
            
        Returns:
            {
                "athlete_id": 运动员ID,
                "year": 年度,
                "season": 季度,
                "total_points": 总积分,
                "event_count": 参赛次数,
                "by_gender": {...},  # 如果group_by_gender=True
                "by_bow_type": {...}  # 如果group_by_bow_type=True
            }
        """
        if not scores:
            return {}
        
        # 基础汇总
        athlete_id = scores[0].athlete_id if hasattr(scores[0], 'athlete_id') else None
        total_points = sum(s.points or 0 for s in scores)
        event_count = len(set(s.event_id for s in scores))
        
        result = {
            "athlete_id": athlete_id,
            "year": year,
            "season": season,
            "total_points": round(total_points, 2),
            "event_count": event_count
        }
        
        # 按性别分组统计
        if group_by_gender:
            result["by_gender"] = {}
            for gender in ["male", "female", "mixed"]:
                gender_scores = [s for s in scores if s.gender_group == gender]
                if gender_scores:
                    result["by_gender"][gender] = {
                        "points": round(sum(s.points or 0 for s in gender_scores), 2),
                        "count": len(gender_scores)
                    }
        
        # 按弓种分组统计
        if group_by_bow_type:
            result["by_bow_type"] = {}
            for score in scores:
                bow_type = score.bow_type or "unknown"
                if bow_type not in result["by_bow_type"]:
                    result["by_bow_type"][bow_type] = {"points": 0, "count": 0}
                result["by_bow_type"][bow_type]["points"] += score.points or 0
                result["by_bow_type"][bow_type]["count"] += 1
            
            # 四舍五入
            for bow_type in result["by_bow_type"]:
                result["by_bow_type"][bow_type]["points"] = \
                    round(result["by_bow_type"][bow_type]["points"], 2)
        
        return result
    
    @staticmethod
    def calculate_rankings(
        aggregated_points: List[Dict],
        group_field: Optional[str] = None
    ) -> List[Dict]:
        """
        计算排名
        
        Args:
            aggregated_points: 汇总后的积分列表
            group_field: 分组字段（如'gender_group'），如果为空则全局排名
            
        Returns:
            带有排名的积分列表
        """
        if not aggregated_points:
            return []
        
        # 按积分从高到低排序
        sorted_data = sorted(
            aggregated_points,
            key=lambda x: x.get("total_points", 0),
            reverse=True
        )
        
        # 添加排名
        for i, data in enumerate(sorted_data, 1):
            data["rank"] = i
        
        return sorted_data


# 使用示例
if __name__ == "__main__":
    # 示例1：计算单个成绩的积分
    points = ScoringCalculator.calculate_points(
        rank=3,
        competition_format="ranking",
        distance="30m",
        participant_count=20
    )
    print(f"排名3位、30米、20人参赛：{points}分")
    
    # 示例2：18米减半
    points_18m = ScoringCalculator.calculate_points(
        rank=3,
        competition_format="ranking",
        distance="18m",
        participant_count=20
    )
    print(f"排名3位、18米、20人参赛：{points_18m}分（减半后）")
    
    # 示例3：淘汰赛
    points_elim = ScoringCalculator.calculate_points(
        rank=10,
        competition_format="elimination",
        distance="50m",
        participant_count=32
    )
    print(f"淘汰赛排名10位、50米、32人参赛：{points_elim}分")
    
    # 示例4：积分规则配置
    rule_config = ScoringCalculator.build_scoring_rule_config()
    print(f"积分规则配置：{json.dumps(rule_config, indent=2, ensure_ascii=False)}")
