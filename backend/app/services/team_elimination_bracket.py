"""Pure team/mixed-team elimination targets, one whole target per playing team.

The team workbook supplies the standard 16-, 8- and 4-slot seed columns. Larger
brackets extend that same recursive order; the individual workbook's special
128-slot swap does not belong here. A card lists possible paths, not winners.
"""


def _validate_participant_count(participant_count: int) -> None:
    if type(participant_count) is not int or not 2 <= participant_count <= 128:
        raise ValueError("参赛队伍数必须为2–128之间的整数（不接受布尔值）")


def _seed_order(capacity: int) -> list[int]:
    """The attachment's physical top-to-bottom order, without individual exceptions."""
    order = [1, 2]
    size = 2
    while size < capacity:
        size *= 2
        order = [
            value
            for rank in order
            for value in ((rank, size + 1 - rank) if rank % 2 else (size + 1 - rank, rank))
        ]
    return order


def team_elimination_rounds(participant_count: int) -> dict[str, tuple[int, ...]]:
    """Return the only legal target count per round, excluding first-round byes.

    Two teams play gold only; three have one contested semifinal and no bronze.
    Counts above 99 are still reported honestly, but cannot fit a legal range.
    """
    _validate_participant_count(participant_count)
    capacity = 1 << (participant_count - 1).bit_length()
    rounds = {}
    remaining = capacity
    while remaining >= 4:
        actual_teams = 2 * (participant_count - capacity // 2) if remaining == capacity else remaining
        rounds[f"1/{remaining // 2}"] = (actual_teams,)
        remaining //= 2
    if participant_count >= 4:
        rounds["bronze"] = (2,)
    rounds["gold"] = (2,)
    return rounds


def _round_requirement(key: str, counts: tuple[int, ...]) -> str:
    note = "，超过1–99可用靶号范围" if counts[0] > 99 else ""
    return f"轮次 {key} 合法靶数为{counts[0]}（每队1靶{note}）"


def _validate_ranges(
    ranges: dict[str, tuple[int, int]], rounds: dict[str, tuple[int, ...]]
) -> dict[str, int]:
    requirements = "；".join(_round_requirement(key, counts) for key, counts in rounds.items())
    if not isinstance(ranges, dict):
        raise ValueError("靶位区间必须为按轮次填写的字典；" + requirements)
    missing = [key for key in rounds if key not in ranges]
    extra = [str(key) for key in ranges if key not in rounds]
    if missing or extra:
        problems = []
        if missing:
            problems.append("缺少轮次：" + "、".join(missing))
        if extra:
            problems.append("包含本场未开赛轮次或未知轮次：" + "、".join(extra))
        raise ValueError("；".join(problems) + "；" + requirements)
    starts = {}
    for key, counts in rounds.items():
        value = ranges[key]
        requirement = _round_requirement(key, counts)
        if not isinstance(value, (tuple, list)) or len(value) != 2:
            raise ValueError(f"{key} 的区间必须包含起止两个靶号；{requirement}")
        start, end = value
        if type(start) is not int or type(end) is not int:
            raise ValueError(f"{key} 起止靶号必须为整数（不接受布尔值）；{requirement}")
        if not 1 <= start <= end <= 99:
            raise ValueError(f"{key} 靶号必须为1–99的升序闭区间；{requirement}")
        length = end - start + 1
        if length != counts[0]:
            raise ValueError(f"{key} 当前区间共{length}靶；{requirement}")
        starts[key] = start
    return starts


def assign_team_elimination_targets(
    participant_count: int, ranges: dict[str, tuple[int, int]]
) -> list[dict[str, str]]:
    """Return rank-ordered cards using whole targets and the workbook's branches.

    A first-round bye neither consumes a target nor renumbers later seed slots.
    Subsequent pairs fold to one possible-winner branch. Each semifinal branch
    receives the same side of both the possible bronze and gold matches.
    """
    rounds = team_elimination_rounds(participant_count)
    starts = _validate_ranges(ranges, rounds)
    capacity = 1 << (participant_count - 1).bit_length()
    slots = [[rank] if rank <= participant_count else [] for rank in _seed_order(capacity)]
    cards: list[dict[str, str]] = [{} for _ in range(participant_count)]
    for key in rounds:
        if key in ("bronze", "gold"):
            continue
        next_slots = []
        match_index = 0
        for index in range(0, len(slots), 2):
            pair = (slots[index], slots[index + 1])
            if not all(pair):
                for rank in pair[0] + pair[1]:
                    cards[rank - 1][key] = "轮空"
            else:
                for side, candidates in enumerate(pair):
                    target = str(starts[key] + match_index * 2 + side)
                    for rank in candidates:
                        cards[rank - 1][key] = target
                match_index += 1
            next_slots.append(pair[0] + pair[1])
        slots = next_slots
    for key in ("bronze", "gold"):
        if key not in rounds:
            continue
        for side, candidates in enumerate(slots):
            target = str(starts[key] + side)
            for rank in candidates:
                cards[rank - 1][key] = target
    return cards
