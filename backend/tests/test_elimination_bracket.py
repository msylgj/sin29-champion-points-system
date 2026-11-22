"""Exhaustive pure tests; fixture contains only attachment bracket seed numbers."""
from copy import deepcopy
from decimal import Decimal
from enum import IntEnum

import pytest

from app.services.elimination_bracket import (
    assign_elimination_targets,
    elimination_rounds,
)


# The attachment's 128-slot column, including its deliberate observable 36/93
# orientation. Filtering this sequence yields each smaller attachment column.
ATTACHMENT_SEEDS = (
    1, 128, 65, 64, 33, 96, 97, 32, 17, 112, 81, 48, 49, 80, 113, 16,
    9, 120, 73, 56, 41, 88, 105, 24, 25, 104, 89, 40, 57, 72, 121, 8,
    5, 124, 69, 60, 37, 92, 101, 28, 21, 108, 85, 44, 53, 76, 117, 12,
    13, 116, 77, 52, 45, 84, 109, 20, 29, 100, 36, 93, 61, 68, 125, 4,
    3, 126, 67, 62, 35, 94, 99, 30, 19, 110, 83, 46, 51, 78, 115, 14,
    11, 118, 75, 54, 43, 86, 107, 22, 27, 102, 91, 38, 59, 70, 123, 6,
    7, 122, 71, 58, 39, 90, 103, 26, 23, 106, 87, 42, 55, 74, 119, 10,
    15, 114, 79, 50, 47, 82, 111, 18, 31, 98, 95, 34, 63, 66, 127, 2,
)
CAPACITIES = (2, 4, 8, 16, 32, 64, 128)
SEEDS = {size: tuple(rank for rank in ATTACHMENT_SEEDS if rank <= size) for size in CAPACITIES}


def expected_rounds(count):
    size = next(size for size in CAPACITIES if count <= size)
    seeds = SEEDS[size]
    result = {}
    block = 2
    while block <= size // 2:
        matches = (
            sum(seeds[index] <= count and seeds[index + 1] <= count for index in range(0, size, 2))
            if block == 2 else size // block
        )
        result[f"1/{size // block}"] = (matches, matches * 2)
        block *= 2
    if count >= 4:
        result["bronze"] = (1, 2)
    result["gold"] = (1, 2)
    return result


def ranges_for(count, mode="half"):
    ranges = {}
    for index, (key, (half, full)) in enumerate(expected_rounds(count).items()):
        use_full = mode == "full" or (mode == "mixed" and index % 2)
        length = full if use_full and full <= 99 else half
        start = min(1 + index * 13, 100 - length)
        ranges[key] = (start, start + length - 1)
    return ranges


def expected_label(key, match, side, ranges, rounds):
    start, end = ranges[key]
    if end - start + 1 == rounds[key][0]:
        return f"{start + match}{'左' if side == 0 else '右'}"
    return str(start + match * 2 + side)


@pytest.mark.parametrize("count", range(2, 129))
def test_every_count_has_exact_contested_round_counts_and_order(count):
    actual = elimination_rounds(count)
    assert actual == expected_rounds(count)
    assert list(actual) == list(expected_rounds(count))
    assert all(type(value) is int for counts in actual.values() for value in counts)
    assert all(full == half * 2 and half > 0 for half, full in actual.values())


@pytest.mark.parametrize("count", range(2, 129))
@pytest.mark.parametrize("mode", ["half", "full", "mixed"])
def test_every_rank_and_round_follows_its_attachment_position_not_seed_number(count, mode):
    rounds = expected_rounds(count)
    ranges = ranges_for(count, mode)
    # Input order must not influence canonical output order or traversal.
    ranges = dict(reversed(list(ranges.items())))
    before = deepcopy(ranges)
    cards = assign_elimination_targets(count, ranges)
    assert ranges == before
    assert list(ranges) == list(before)
    assert len(cards) == count
    size = next(size for size in CAPACITIES if count <= size)
    seeds = SEEDS[size]
    main_rounds = [key for key in rounds if key not in ("bronze", "gold")]
    for rank, card in enumerate(cards, 1):
        assert list(card) == list(rounds)
        position = seeds.index(rank)
        for index, key in enumerate(main_rounds):
            # Independent block-index oracle: all original slots in the same
            # half-block have the same next-round place, whoever wins earlier.
            block = 2 ** (index + 1)
            side = (position % block) // (block // 2)
            match = position // block
            if index == 0:
                if seeds[position ^ 1] > count:
                    assert card[key] == "轮空"
                    continue
                match = sum(
                    seeds[offset] <= count and seeds[offset + 1] <= count
                    for offset in range(0, position - position % 2, 2)
                )
            assert card[key] == expected_label(key, match, side, ranges, rounds)
        for key in ("bronze", "gold"):
            if key in rounds:
                assert card[key] == expected_label(key, 0, position // (size // 2), ranges, rounds)
        assert all(isinstance(value, str) for value in card.values())
    if main_rounds:
        first = main_rounds[0]
        start, end = ranges[first]
        allocated = {int(card[first].rstrip("左右")) for card in cards if card[first] != "轮空"}
        assert allocated == set(range(start, end + 1))
        assert sum(card[first] == "轮空" for card in cards) == size - count


def test_27_people_first_five_byes_and_attachment_17_16_left_right_without_target_gaps():
    rounds = elimination_rounds(27)
    assert rounds == {
        "1/16": (11, 22), "1/8": (8, 16), "1/4": (4, 8), "1/2": (2, 4),
        "bronze": (1, 2), "gold": (1, 2),
    }
    ranges = {key: (1, counts[0]) for key, counts in rounds.items()}
    cards = assign_elimination_targets(27, ranges)
    assert [card["1/16"] for card in cards[:5]] == ["轮空"] * 5
    assert all(card["1/16"] != "轮空" for card in cards[5:])
    assert cards[16]["1/16"] == "1左"
    assert cards[15]["1/16"] == "1右"
    assert cards[0]["1/8"] == "1左"
    assert cards[16]["1/8"] == cards[15]["1/8"] == "1右"
    assert cards[0]["1/4"] == cards[16]["1/4"] == cards[15]["1/4"] == "1左"
    assert cards[0]["gold"] == cards[16]["gold"] == cards[15]["gold"] == "1左"
    assert cards[1]["gold"] == "1右"


def test_full_first_round_has_no_suffix_and_byes_consume_neither_target():
    ranges = ranges_for(27)
    ranges["1/16"] = (78, 99)
    cards = assign_elimination_targets(27, ranges)
    assert cards[16]["1/16"] == "78"
    assert cards[15]["1/16"] == "79"
    assert cards[14]["1/16"] == "98"
    assert cards[17]["1/16"] == "99"
    assert all(card["1/16"] == "轮空" or card["1/16"].isdigit() for card in cards)


def test_128_seed_attachment_exception_is_preserved_not_silently_standardized():
    cards = assign_elimination_targets(128, ranges_for(128))
    assert elimination_rounds(128)["1/64"] == (64, 128)
    assert cards[35]["1/64"] == "30左"
    assert cards[92]["1/64"] == "30右"
    assert cards[35]["1/32"] == cards[92]["1/32"]
    for rank in range(1, 129):
        assert "轮空" not in cards[rank - 1].values()


def test_two_people_only_play_gold_and_99_is_an_inclusive_legal_target():
    assert elimination_rounds(2) == {"gold": (1, 2)}
    assert assign_elimination_targets(2, {"gold": (99, 99)}) == [{"gold": "99左"}, {"gold": "99右"}]
    assert assign_elimination_targets(2, {"gold": (98, 99)}) == [{"gold": "98"}, {"gold": "99"}]


def test_three_people_have_a_semifinal_bye_and_no_uncontested_bronze_match():
    assert elimination_rounds(3) == {"1/2": (1, 2), "gold": (1, 2)}
    assert assign_elimination_targets(3, {"1/2": (7, 7), "gold": (9, 9)}) == [
        {"1/2": "轮空", "gold": "9左"},
        {"1/2": "7右", "gold": "9右"},
        {"1/2": "7左", "gold": "9右"},
    ]


def test_semifinal_branch_preprints_both_gold_and_bronze_for_every_possible_candidate():
    ranges = {"1/4": (10, 13), "1/2": (31, 34), "bronze": (91, 92), "gold": (98, 99)}
    cards = assign_elimination_targets(8, ranges)
    # Seed layout is 1,8,5,4 | 3,6,7,2. These are possible semifinal
    # branches, not a hypothetical "the higher seeded athlete always wins".
    for rank in (1, 8, 5, 4):
        assert cards[rank - 1]["gold"] == "98"
        assert cards[rank - 1]["bronze"] == "91"
    for rank in (3, 6, 7, 2):
        assert cards[rank - 1]["gold"] == "99"
        assert cards[rank - 1]["bronze"] == "92"
    assert cards[0]["1/2"] == cards[7]["1/2"] == "31"
    assert cards[4]["1/2"] == cards[3]["1/2"] == "32"


class IntLike(int):
    pass


class NumberEnum(IntEnum):
    TWO = 2


@pytest.mark.parametrize("count", [True, False, 2.0, "2", None, 1, 0, -1, 129, float("inf"), Decimal(2), IntLike(2), NumberEnum.TWO])
def test_count_is_a_strict_integer_in_2_through_128(count):
    with pytest.raises(ValueError, match="2–128"):
        elimination_rounds(count)
    with pytest.raises(ValueError, match="2–128"):
        assign_elimination_targets(count, {})


@pytest.mark.parametrize("key", list(expected_rounds(27)))
@pytest.mark.parametrize("bad", [None, (), (1,), (1, 2, 3), "1,2", {"start": 1, "end": 2}, (True, 2), (1, False), (1.0, 2), (1, "2"), (IntLike(1), 2), (0, 1), (-1, 2), (1, 100), (4, 1), (1, 3)])
def test_every_range_error_names_its_round_and_both_legal_target_counts(key, bad):
    ranges = ranges_for(27)
    ranges[key] = bad
    with pytest.raises(ValueError) as error:
        assign_elimination_targets(27, ranges)
    half, full = expected_rounds(27)[key]
    assert key in str(error.value)
    assert f" {half}（一对共1靶）" in str(error.value)
    assert f" {full}（一人1靶）" in str(error.value)


@pytest.mark.parametrize("value", [None, [], "bad", 1])
def test_ranges_must_be_a_dictionary_and_errors_include_valid_round_choices(value):
    with pytest.raises(ValueError) as error:
        assign_elimination_targets(27, value)
    assert "字典" in str(error.value)
    assert "1/16" in str(error.value)
    assert "11（一对共1靶）" in str(error.value)
    assert "22（一人1靶）" in str(error.value)


def test_missing_and_extra_keys_never_default_to_other_rounds():
    ranges = ranges_for(27)
    del ranges["gold"]
    with pytest.raises(ValueError, match="缺少轮次：gold") as error:
        assign_elimination_targets(27, ranges)
    assert "1（一对共1靶）或 2（一人1靶）" in str(error.value)
    ranges["gold"] = (1, 1)
    ranges["1/32"] = (1, 1)
    with pytest.raises(ValueError, match="未开赛轮次或未知轮次：1/32"):
        assign_elimination_targets(27, ranges)
    with pytest.raises(ValueError, match="bronze"):
        assign_elimination_targets(3, {"1/2": (1, 1), "gold": (1, 1), "bronze": (1, 1)})


def test_128_full_target_count_is_reported_but_a_range_beyond_99_is_never_allowed():
    ranges = ranges_for(128)
    ranges["1/64"] = (1, 128)
    with pytest.raises(ValueError) as error:
        assign_elimination_targets(128, ranges)
    assert "1–99" in str(error.value)
    assert "64（一对共1靶）" in str(error.value)
    assert "128（一人1靶）" in str(error.value)


def test_json_pair_lists_are_accepted_without_mutating_or_coercing_them():
    ranges = {key: list(value) for key, value in ranges_for(27, "mixed").items()}
    before = deepcopy(ranges)
    assert assign_elimination_targets(27, ranges) == assign_elimination_targets(27, ranges_for(27, "mixed"))
    assert ranges == before


def test_results_are_fresh_and_no_range_or_cross_round_overlap_restriction_is_invented():
    first = elimination_rounds(4)
    first["gold"] = (999, 999)
    assert elimination_rounds(4)["gold"] == (1, 2)
    ranges = {key: (1, counts[0]) for key, counts in elimination_rounds(4).items()}
    cards = assign_elimination_targets(4, ranges)
    cards[0]["gold"] = "changed"
    assert assign_elimination_targets(4, ranges)[0]["gold"] == "1左"
    assert cards[1]["gold"] == "1右"
