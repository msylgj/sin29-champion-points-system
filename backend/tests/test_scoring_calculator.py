"""
积分计算器单元测试
"""
import pytest
from app.services.scoring_calculator import ScoringCalculator, PointsAggregator


class TestScoringCalculator:
    """测试积分计算器"""
    
    def test_ranking_points_rank1_30m(self):
        """测试排位赛排名第1名、30米的积分"""
        points = ScoringCalculator.calculate_points(
            rank=1,
            competition_format="ranking",
            distance="30m",
            participant_count=20
        )
        # 基础25分 × 系数0.8 = 20分
        assert points == 20.0
    
    def test_ranking_points_rank1_18m(self):
        """测试排位赛排名第1名、18米的积分（减半）"""
        points = ScoringCalculator.calculate_points(
            rank=1,
            competition_format="ranking",
            distance="18m",
            participant_count=20
        )
        # 基础25分 × 系数0.8 × 0.5(18米) = 10分
        assert points == 10.0
    
    def test_ranking_points_rank5_30m(self):
        """测试排位赛排名第5名、30米的积分"""
        points = ScoringCalculator.calculate_points(
            rank=5,
            competition_format="ranking",
            distance="30m",
            participant_count=20
        )
        # 基础10分 × 系数0.8 = 8分
        assert points == 8.0
    
    def test_ranking_points_large_group(self):
        """测试排位赛大分组（128人以上）的系数"""
        points = ScoringCalculator.calculate_points(
            rank=1,
            competition_format="ranking",
            distance="30m",
            participant_count=200
        )
        # 基础25分 × 系数1.4 = 35分
        assert points == 35.0
    
    def test_ranking_points_beyond_limit(self):
        """测试排位赛超出获得原额基础积分范囲的排名（获得1分）"""
        points = ScoringCalculator.calculate_points(
            rank=10,
            competition_format="ranking",
            distance="30m",
            participant_count=20
        )
        # 排名10超出限制（8名），但仍获得1分基础积分
        # 1分 × 系数0.8 = 0.8分
        assert points == 0.8
    
    def test_elimination_points_rank1(self):
        """测试淘汰赛排名第1名的积分"""
        points = ScoringCalculator.calculate_points(
            rank=1,
            competition_format="elimination",
            distance="30m",
            participant_count=50
        )
        # 基础45分 × 系数1.0 = 45分
        assert points == 45.0
    
    def test_elimination_points_rank10(self):
        """测试淘汰赛排名第10名的积分"""
        points = ScoringCalculator.calculate_points(
            rank=10,
            competition_format="elimination",
            distance="30m",
            participant_count=50
        )
        # 9-16名统一15分 × 系数1.0 = 15分
        assert points == 15.0
    
    def test_elimination_points_rank10_18m(self):
        """测试淘汰赛排名第10名、18米的积分"""
        points = ScoringCalculator.calculate_points(
            rank=10,
            competition_format="elimination",
            distance="18m",
            participant_count=50
        )
        # 15分 × 0.5(18米) = 7.5分
        assert points == 7.5
    
    def test_team_points_rank1(self):
        """测试团体赛排名第1名的积分"""
        points = ScoringCalculator.calculate_points(
            rank=1,
            competition_format="team",
            distance="30m",
            participant_count=5  # 5队参赛
        )
        # 基础20分 × 系数0.8 = 16分
        assert points == 16.0
    
    def test_team_points_rank5(self):
        """测试团体赛排名第5名的积分"""
        points = ScoringCalculator.calculate_points(
            rank=5,
            competition_format="team",
            distance="30m",
            participant_count=10
        )
        # 基础5分 × 系数1.0 = 5分
        assert points == 5.0
    
    def test_coefficient_small_group(self):
        """测试小分组系数（8-15人）"""
        coeff, cutoff = ScoringCalculator.get_coefficient_and_cutoff(10, "ranking")
        assert coeff == 0.6
        assert cutoff == 4
    
    def test_coefficient_medium_group(self):
        """测试中等分组系数（16-31人）"""
        coeff, cutoff = ScoringCalculator.get_coefficient_and_cutoff(20, "ranking")
        assert coeff == 0.8
        assert cutoff == 8
    
    def test_coefficient_large_group(self):
        """测试大分组系数（32-63人）"""
        coeff, cutoff = ScoringCalculator.get_coefficient_and_cutoff(50, "ranking")
        assert coeff == 1.0
        assert cutoff == 16
    
    def test_coefficient_xlarge_group(self):
        """测试特大分组系数（64-127人）"""
        coeff, cutoff = ScoringCalculator.get_coefficient_and_cutoff(100, "ranking")
        assert coeff == 1.2
        assert cutoff == 16
    
    def test_coefficient_xxlarge_group(self):
        """测试超大分组系数（128人以上）"""
        coeff, cutoff = ScoringCalculator.get_coefficient_and_cutoff(200, "ranking")
        assert coeff == 1.4
        assert cutoff == 16
    
    def test_base_points_ranking(self):
        """测试排位赛的基础积分（超出范囲返回1分）"""
        assert ScoringCalculator.calculate_base_points(1, "ranking") == 25.0
        assert ScoringCalculator.calculate_base_points(2, "ranking") == 22.0
        assert ScoringCalculator.calculate_base_points(3, "ranking") == 19.0
        assert ScoringCalculator.calculate_base_points(8, "ranking") == 4.0
        assert ScoringCalculator.calculate_base_points(9, "ranking") == 1.0  # 超出范围返回1分
        assert ScoringCalculator.calculate_base_points(100, "ranking") == 1.0  # 超出范围返回1分
    
    def test_base_points_elimination(self):
        """测试淘汰赛的基础积分（超出范围返回1分）"""
        assert ScoringCalculator.calculate_base_points(1, "elimination") == 45.0
        assert ScoringCalculator.calculate_base_points(5, "elimination") == 20.0
        assert ScoringCalculator.calculate_base_points(8, "elimination") == 20.0
        assert ScoringCalculator.calculate_base_points(10, "elimination") == 15.0
        assert ScoringCalculator.calculate_base_points(16, "elimination") == 15.0
        assert ScoringCalculator.calculate_base_points(17, "elimination") == 1.0  # 超出范围返回1分
    
    def test_base_points_team(self):
        """测试团体赛的基础积分（超出范围返回1分）"""
        assert ScoringCalculator.calculate_base_points(1, "team") == 20.0
        assert ScoringCalculator.calculate_base_points(2, "team") == 15.0
        assert ScoringCalculator.calculate_base_points(5, "team") == 5.0
        assert ScoringCalculator.calculate_base_points(8, "team") == 2.0
        assert ScoringCalculator.calculate_base_points(9, "team") == 1.0  # 超出范围返回1分
    
    def test_elimination_points_beyond_limit(self):
        """测试淘汰赛超出原额积分限制的排名（获得1分）"""
        points = ScoringCalculator.calculate_points(
            rank=20,
            competition_format="elimination",
            distance="30m",
            participant_count=50
        )
        # 排名20超出限制（16名），但仍获得1分基础积分
        # 1分 × 系数1.0 = 1.0分
        assert points == 1.0
    
    def test_team_points_beyond_limit(self):
        """测试团体赛超出原额基础积分限制的排名（获得1分）"""
        points = ScoringCalculator.calculate_points(
            rank=10,
            competition_format="team",
            distance="30m",
            participant_count=5  # 5队，限制前4队
        )
        # 排名10超出限制（4队），但仍获得1分基础积分
        # 1分 × 系数0.8 = 0.8分
        assert points == 0.8


class TestPointsAggregator:
    """测试积分汇总器"""
    
    def test_aggregate_empty_scores(self):
        """测试空成绩列表"""
        result = PointsAggregator.aggregate_athlete_points([], 2024, "Q1")
        assert result == {}
    
    def test_aggregate_single_score(self):
        """测试单条成绩汇总"""
        # 创建模拟Score对象
        class MockScore:
            def __init__(self, athlete_id, event_id, points):
                self.athlete_id = athlete_id
                self.event_id = event_id
                self.points = points
                self.gender_group = "male"
                self.bow_type = "recurve"
        
        scores = [MockScore(1, 1, 25.5)]
        result = PointsAggregator.aggregate_athlete_points(scores, 2024, "Q1")
        
        assert result["athlete_id"] == 1
        assert result["year"] == 2024
        assert result["season"] == "Q1"
        assert result["total_points"] == 25.5
        assert result["event_count"] == 1
    
    def test_aggregate_multiple_scores(self):
        """测试多条成绩汇总"""
        class MockScore:
            def __init__(self, athlete_id, event_id, points):
                self.athlete_id = athlete_id
                self.event_id = event_id
                self.points = points
                self.gender_group = "male"
                self.bow_type = "recurve"
        
        scores = [
            MockScore(1, 1, 25.5),
            MockScore(1, 2, 20.0),
            MockScore(1, 3, 15.5),
        ]
        result = PointsAggregator.aggregate_athlete_points(scores, 2024, "Q1")
        
        assert result["total_points"] == 61.0
        assert result["event_count"] == 3
    
    def test_ranking_calculation(self):
        """测试排名计算"""
        aggregated = [
            {"athlete_id": 1, "total_points": 100},
            {"athlete_id": 2, "total_points": 90},
            {"athlete_id": 3, "total_points": 80},
        ]
        
        ranked = PointsAggregator.calculate_rankings(aggregated)
        
        assert ranked[0]["rank"] == 1
        assert ranked[0]["athlete_id"] == 1
        assert ranked[1]["rank"] == 2
        assert ranked[2]["rank"] == 3


class TestScoringRuleConfig:
    """测试积分规则配置"""
    
    def test_build_rule_config(self):
        """测试积分规则配置生成"""
        config = ScoringCalculator.build_scoring_rule_config()
        
        assert config["type"] == "rank_based"
        assert "rules" in config
        assert "ranking" in config["rules"]
        assert "elimination" in config["rules"]
        assert "team" in config["rules"]
        assert config["special_rules"]["18m_discount"] == 0.5


# 使用pytest运行测试
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
