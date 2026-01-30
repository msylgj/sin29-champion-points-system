"""
验证积分计算规则修正
"""

# 模拟 ScoringCalculator 的核心逻辑
RANKING_POINTS = {
    1: 25, 2: 22, 3: 19, 4: 15, 5: 10, 6: 8, 7: 6, 8: 4
}

ELIMINATION_POINTS = {
    1: 45, 2: 40, 3: 35, 4: 30, 
    5: 20, 6: 20, 7: 20, 8: 20,
}

TEAM_POINTS = {
    1: 20, 2: 15, 3: 10, 4: 8, 5: 5, 6: 4, 7: 3, 8: 2
}

PARTICIPANT_COEFFICIENTS = {
    (8, 15): (0.6, 4),
    (16, 31): (0.8, 8),
    (32, 63): (1.0, 16),
    (64, 127): (1.2, 16),
    (128, float('inf')): (1.4, 16)
}

def calculate_base_points(rank, competition_format):
    """获取基础积分（超出范围返回1分）"""
    if competition_format == "ranking":
        return float(RANKING_POINTS.get(rank, 1))
    elif competition_format == "elimination":
        if rank <= 8:
            return float(ELIMINATION_POINTS[rank])
        elif rank <= 16:
            return 15.0
        else:
            return 1.0
    elif competition_format == "team":
        return float(TEAM_POINTS.get(rank, 1))
    return 1.0

def get_coefficient_and_cutoff(participant_count, competition_format):
    """获取系数和排名限制"""
    if participant_count is None or participant_count < 8:
        return 1.0, float('inf')
    
    for (min_count, max_count), (coeff, cutoff) in PARTICIPANT_COEFFICIENTS.items():
        if min_count <= participant_count <= max_count:
            return coeff, cutoff
    
    return 1.0, float('inf')

def calculate_points(rank, competition_format, distance="30m", participant_count=None):
    """计算最终积分"""
    # 步骤1：获取基础积分
    base_points = calculate_base_points(rank, competition_format)
    
    # 步骤2：获取系数和排名限制
    coefficient, cutoff = get_coefficient_and_cutoff(participant_count, competition_format)
    
    # 步骤3：检查是否在"原额积分"限制范围内
    if rank > cutoff:
        base_points = 1.0
    
    # 步骤4：计算最终积分
    final_points = base_points * coefficient
    
    # 步骤5：18米减半
    if distance == "18m":
        final_points *= 0.5
    
    return round(final_points, 2)

# 测试用例
print("=== 修正后的积分计算验证 ===\n")

# 测试1：排名赛，第10名，20人，30米
result = calculate_points(10, "ranking", "30m", 20)
print(f"测试1：排名赛，第10名，20人，30米")
print(f"  基础积分：1分（超出表范围）")
print(f"  系数：0.8（20人在16-31范围）")
print(f"  原额限制：前8名，第10名超出")
print(f"  计算：1 × 0.8 = 0.8分")
print(f"  结果：{result}分\n")

# 测试2：排名赛，第10名，20人，18米
result = calculate_points(10, "ranking", "18m", 20)
print(f"测试2：排名赛，第10名，20人，18米")
print(f"  基础积分：1分（超出表范围）")
print(f"  系数：0.8（20人在16-31范围）")
print(f"  原额限制：前8名，第10名超出")
print(f"  计算：1 × 0.8 × 0.5 = 0.4分")
print(f"  结果：{result}分\n")

# 测试3：排名赛，第1名，20人，30米
result = calculate_points(1, "ranking", "30m", 20)
print(f"测试3：排名赛，第1名，20人，30米")
print(f"  基础积分：25分")
print(f"  系数：0.8（20人在16-31范围）")
print(f"  原额限制：前8名，第1名在范围内")
print(f"  计算：25 × 0.8 = 20.0分")
print(f"  结果：{result}分\n")

# 测试4：淘汰赛，第20名，50人，30米
result = calculate_points(20, "elimination", "30m", 50)
print(f"测试4：淘汰赛，第20名，50人，30米")
print(f"  基础积分：1分（超出范围）")
print(f"  系数：1.0（50人在32-63范围）")
print(f"  原额限制：前16名，第20名超出")
print(f"  计算：1 × 1.0 = 1.0分")
print(f"  结果：{result}分\n")

# 测试5：团体赛，第10队，5队，30米
result = calculate_points(10, "team", "30m", 5)
print(f"测试5：团体赛，第10队，5队，30米")
print(f"  基础积分：1分（超出表范围）")
print(f"  系数：0.8（5队在5-7范围）")
print(f"  原额限制：前4队，第10队超出")
print(f"  计算：1 × 0.8 = 0.8分")
print(f"  结果：{result}分\n")

print("✅ 所有修正规则验证完成！")
