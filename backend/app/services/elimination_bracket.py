"""Pure attachment-compatible seed paths and elimination target allocation.

No winners are predicted: each rank receives every target on its possible
winner path, plus the semifinal branch's possible bronze and gold targets.
"""


def _validate_participant_count(participant_count: int) -> None:
    if type(participant_count) is not int or not 2 <= participant_count <= 128:
        raise ValueError("参赛人数必须为2–128之间的整数（不接受布尔值）")


def _seed_order(capacity: int) -> list[int]:
    """Match the workbook's 靶位底层文件, including its 128-slot orientation."""
    order = [1, 2]
    size = 2
    while size < capacity:
        size *= 2
        order = [
            value
            for rank in order
            for value in (
                (rank, size + 1 - rank)
                if rank % 2
                else (size + 1 - rank, rank)
            )
        ]
    if capacity == 128:
        # The attachment places 36 then 93 at positions 59/60, rather than
        # standard recursive 93 then 36. Preserve its observable left/right.
        order[58], order[59] = order[59], order[58]
    return order


def elimination_rounds(participant_count: int) -> dict[str, tuple[int, int]]:
    """Return scheduled rounds and their (shared-target, individual) counts.

    Only genuinely contested first-round pairs consume targets; their byes do
    not. Later rounds have a full set of possible winners. Three entrants have
    no contested bronze match, and two entrants play only the gold match.
    """
    _validate_participant_count(participant_count)
    capacity = 1 << (participant_count - 1).bit_length()
    rounds = {}
    remaining = capacity
    while remaining >= 4:
        matches = (
            participant_count - capacity // 2
            if remaining == capacity
            else remaining // 2
        )
        rounds[f"1/{remaining // 2}"] = (matches, matches * 2)
        remaining //= 2
    if participant_count >= 4:
        rounds["bronze"] = (1, 2)
    rounds["gold"] = (1, 2)
    return rounds


def _round_requirement(key: str, counts: tuple[int, int]) -> str:
    return (
        f"轮次 {key} 合法靶数为 {counts[0]}（一对共1靶）"
        f"或 {counts[1]}（一人1靶）"
    )


def _validate_ranges(
    ranges: dict[str, tuple[int, int]],
    rounds: dict[str, tuple[int, int]],
) -> dict[str, tuple[int, bool]]:
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
    normalized = {}
    for key, counts in rounds.items():
        value = ranges[key]
        requirement = _round_requirement(key, counts)
        # JSON arrays may be passed directly, although the public Python
        # contract and API validation normalize these into two-item tuples.
        if not isinstance(value, (tuple, list)) or len(value) != 2:
            raise ValueError(f"{key} 的区间必须包含起止两个靶号；{requirement}")
        start, end = value
        if type(start) is not int or type(end) is not int:
            raise ValueError(f"{key} 起止靶号必须为整数（不接受布尔值）；{requirement}")
        if not 1 <= start <= end <= 99:
            raise ValueError(f"{key} 靶号必须为1–99的升序闭区间（起止可相同）；{requirement}")
        length = end - start + 1
        if length not in counts:
            raise ValueError(f"{key} 当前区间共{length}靶；{requirement}")
        normalized[key] = (start, length == counts[0])
    return normalized


def _target(start: int, match_index: int, side: int, shared: bool) -> str:
    if shared:
        return f"{start + match_index}{'左' if side == 0 else '右'}"
    return str(start + match_index * 2 + side)


def assign_elimination_targets(
    participant_count: int, ranges: dict[str, tuple[int, int]]
) -> list[dict[str, str]]:
    """Return rank 1..N cards, never renumbering future matches by seed rank.

    Adjacent initial seed slots are opponents. Each pair then collapses to one
    possible-winner slot, retaining every candidate from that path. Byes are
    marked 轮空 and neither missing nor present side consumes a target.
    """
    rounds = elimination_rounds(participant_count)
    settings = _validate_ranges(ranges, rounds)
    capacity = 1 << (participant_count - 1).bit_length()
    slots = [[rank] if rank <= participant_count else [] for rank in _seed_order(capacity)]
    cards: list[dict[str, str]] = [{} for _ in range(participant_count)]
    for key in rounds:
        if key in ("bronze", "gold"):
            continue
        start, shared = settings[key]
        next_slots = []
        match_index = 0
        for index in range(0, len(slots), 2):
            pair = (slots[index], slots[index + 1])
            if not all(pair):
                for rank in pair[0] + pair[1]:
                    cards[rank - 1][key] = "轮空"
            else:
                for side, candidates in enumerate(pair):
                    target = _target(start, match_index, side, shared)
                    for rank in candidates:
                        cards[rank - 1][key] = target
                match_index += 1
            next_slots.append(pair[0] + pair[1])
        slots = next_slots
    # After the semifinal each branch has one potential finalist and one
    # potential bronze entrant. All its candidate ranks need both locations.
    for key in ("bronze", "gold"):
        if key not in rounds:
            continue
        start, shared = settings[key]
        for side, candidates in enumerate(slots):
            target = _target(start, 0, side, shared)
            for rank in candidates:
                cards[rank - 1][key] = target
    return cards
