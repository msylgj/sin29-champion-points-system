"""Pure team-bracket tests, including numeric seed fixtures from the reference XLSX."""
from copy import deepcopy
from decimal import Decimal
from enum import IntEnum
from pathlib import Path
from xml.etree import ElementTree
from zipfile import ZipFile

import pytest

from app.services.team_elimination_bracket import (
    assign_team_elimination_targets,
    team_elimination_rounds,
)


# Physical A/C/E columns in 团体排靶逻辑.xlsx. No names or registrations are retained.
ATTACHMENT_SEEDS = {
    2: (1, 2),
    4: (1, 4, 3, 2),
    8: (1, 8, 5, 4, 3, 6, 7, 2),
    16: (1, 16, 9, 8, 5, 12, 13, 4, 3, 14, 11, 6, 7, 10, 15, 2),
}
REFERENCE_PATH = Path("/home/msylgj/.dsh/attachments/v1/files/ef/ef32649038fca1713708951f39d9690574a31667430b42546de910d1005d4a16/团体排靶逻辑.xlsx")


def seeds_for(capacity):
    if capacity in ATTACHMENT_SEEDS:
        return ATTACHMENT_SEEDS[capacity]
    half = seeds_for(capacity // 2)
    result = []
    for rank in half:
        pair = [rank, capacity + 1 - rank]
        result.extend(pair if rank % 2 else reversed(pair))
    return tuple(result)


def expected_rounds(count):
    capacity = 1 << (count - 1).bit_length()
    seeds = seeds_for(capacity)
    result = {}
    block = 2
    while block <= capacity // 2:
        teams = 2 * sum(seeds[index] <= count and seeds[index + 1] <= count for index in range(0, capacity, 2)) if block == 2 else 2 * capacity // block
        result[f"1/{capacity // block}"] = (teams,)
        block *= 2
    if count >= 4:
        result["bronze"] = (2,)
    result["gold"] = (2,)
    return result


def ranges_for(count):
    return {
        key: (start, start + counts[0] - 1)
        for index, (key, counts) in enumerate(expected_rounds(count).items())
        for start in [min(7 + index * 11, 100 - counts[0])]
    }


@pytest.mark.parametrize("count", range(2, 129))
def test_rounds_report_one_exact_actual_team_count_for_every_participant_count(count):
    result = team_elimination_rounds(count)
    assert result == expected_rounds(count)
    assert list(result) == list(expected_rounds(count))
    assert all(len(counts) == 1 and type(counts[0]) is int for counts in result.values())
    assert result["gold"] == (2,)
    assert ("bronze" in result) == (count >= 4)


@pytest.mark.parametrize("count", range(2, 114))
def test_every_rank_follows_its_seed_block_and_uses_every_requested_target(count):
    rounds = expected_rounds(count)
    ranges = dict(reversed(list(ranges_for(count).items())))
    before = deepcopy(ranges)
    cards = assign_team_elimination_targets(count, ranges)
    assert ranges == before
    assert list(ranges) == list(before)
    assert len(cards) == count
    capacity = 1 << (count - 1).bit_length()
    seeds = seeds_for(capacity)
    main = [key for key in rounds if key not in ("bronze", "gold")]
    for rank, card in enumerate(cards, 1):
        assert list(card) == list(rounds)
        position = seeds.index(rank)
        for index, key in enumerate(main):
            block = 2 ** (index + 1)
            side = (position % block) // (block // 2)
            match = position // block
            if index == 0:
                if seeds[position ^ 1] > count:
                    assert card[key] == "轮空"
                    continue
                match = sum(seeds[earlier] <= count and seeds[earlier + 1] <= count for earlier in range(0, match * 2, 2))
            assert card[key] == str(ranges[key][0] + match * 2 + side)
        branch = position // (capacity // 2)
        for key in ("bronze", "gold"):
            if key in rounds:
                assert card[key] == str(ranges[key][0] + branch)
        assert all(value == "轮空" or (value.isdigit() and 1 <= int(value) <= 99) for value in card.values())
    for key in rounds:
        assigned = {int(card[key]) for card in cards if card[key] != "轮空"}
        assert assigned == set(range(ranges[key][0], ranges[key][1] + 1))
    if main:
        assert sum(card[main[0]] == "轮空" for card in cards) == capacity - count
        assert all("轮空" not in [card[key] for key in main[1:]] for card in cards)


def test_two_teams_use_two_whole_gold_targets_including_99():
    assert team_elimination_rounds(2) == {"gold": (2,)}
    assert assign_team_elimination_targets(2, {"gold": [98, 99]}) == [{"gold": "98"}, {"gold": "99"}]
    with pytest.raises(ValueError, match="合法靶数为2"):
        assign_team_elimination_targets(2, {"gold": (99, 99)})


def test_three_teams_keep_top_seed_bye_and_have_no_bronze():
    assert team_elimination_rounds(3) == {"1/2": (2,), "gold": (2,)}
    assert assign_team_elimination_targets(3, {"1/2": (5, 6), "gold": (98, 99)}) == [
        {"1/2": "轮空", "gold": "98"},
        {"1/2": "6", "gold": "99"},
        {"1/2": "5", "gold": "99"},
    ]


def test_four_teams_match_the_attachment_semifinal_and_both_medal_branch_orders():
    assert assign_team_elimination_targets(4, {"1/2": (31, 34), "bronze": (91, 92), "gold": (98, 99)}) == [
        {"1/2": "31", "bronze": "91", "gold": "98"},
        {"1/2": "34", "bronze": "92", "gold": "99"},
        {"1/2": "33", "bronze": "92", "gold": "99"},
        {"1/2": "32", "bronze": "91", "gold": "98"},
    ]


def test_five_teams_do_not_consume_targets_for_three_first_round_byes():
    ranges = {"1/4": (10, 11), "1/2": (31, 34), "bronze": (91, 92), "gold": (98, 99)}
    cards = assign_team_elimination_targets(5, ranges)
    assert [card["1/4"] for card in cards] == ["轮空", "轮空", "轮空", "11", "10"]
    assert [card["1/2"] for card in cards] == ["31", "34", "33", "32", "32"]
    assert [card["gold"] for card in cards] == ["98", "99", "99", "98", "98"]


def test_sixteen_teams_use_attachment_order_not_numeric_rank_order():
    rounds = team_elimination_rounds(16)
    assert rounds == {"1/8": (16,), "1/4": (8,), "1/2": (4,), "bronze": (2,), "gold": (2,)}
    cards = assign_team_elimination_targets(16, {key: (1, count[0]) for key, count in rounds.items()})
    assert [cards[rank - 1]["1/8"] for rank in ATTACHMENT_SEEDS[16]] == [str(target) for target in range(1, 17)]
    for rank in ATTACHMENT_SEEDS[16][:8]:
        assert cards[rank - 1]["bronze"] == cards[rank - 1]["gold"] == "1"
    for rank in ATTACHMENT_SEEDS[16][8:]:
        assert cards[rank - 1]["bronze"] == cards[rank - 1]["gold"] == "2"


def test_128_slot_extension_does_not_inherit_the_individual_attachment_swap():
    # 100 actual teams fit: 72 contested teams then 64. In the unmodified team
    # order rank 93 precedes rank 36, unlike the individual workbook exception.
    assert team_elimination_rounds(100)["1/64"] == (72,)
    cards = assign_team_elimination_targets(100, ranges_for(100))
    assert int(cards[35]["1/64"]) == int(cards[92]["1/64"]) + 1
    assert cards[35]["1/32"] == cards[92]["1/32"]


@pytest.mark.parametrize("count", range(114, 129))
def test_rounds_over_99_targets_are_reported_but_not_assignable(count):
    rounds = team_elimination_rounds(count)
    assert rounds["1/64"] == (2 * (count - 64),)
    ranges = {key: (1, min(99, amount[0])) for key, amount in rounds.items()}
    with pytest.raises(ValueError) as error:
        assign_team_elimination_targets(count, ranges)
    assert "1/64" in str(error.value)
    assert str(rounds["1/64"][0]) in str(error.value)
    assert "1–99" in str(error.value)


class IntLike(int):
    pass


class NumberEnum(IntEnum):
    TWO = 2


@pytest.mark.parametrize("count", [True, False, 2.0, "2", None, 1, 0, -1, 129, float("inf"), Decimal(2), IntLike(2), NumberEnum.TWO])
def test_counts_are_strict_integers_in_two_through_128(count):
    with pytest.raises(ValueError, match="2–128"):
        team_elimination_rounds(count)
    with pytest.raises(ValueError, match="2–128"):
        assign_team_elimination_targets(count, {})


@pytest.mark.parametrize("key", list(expected_rounds(8)))
@pytest.mark.parametrize("bad", [None, (), (1,), (1, 2, 3), "1,2", {"start": 1, "end": 2}, (True, 2), (1, False), (1.0, 2), (1, "2"), (IntLike(1), 2), (0, 1), (-1, 2), (1, 100), (4, 1), (1, 1)])
def test_range_errors_identify_round_and_the_only_legal_target_count(key, bad):
    ranges = ranges_for(8)
    ranges[key] = bad
    with pytest.raises(ValueError) as error:
        assign_team_elimination_targets(8, ranges)
    message = str(error.value)
    assert key in message
    assert f"合法靶数为{team_elimination_rounds(8)[key][0]}" in message
    assert "每队1靶" in message


@pytest.mark.parametrize("ranges", [None, [], "gold", {}, {"gold": [1, 2], "bronze": [3, 4]}, {"gold": [1, 2], "unknown": [1, 2]}, {"gold": [1, 2], 123: [1, 2]}])
def test_missing_unknown_or_unplayed_rounds_cannot_be_silently_ignored(ranges):
    with pytest.raises(ValueError) as error:
        assign_team_elimination_targets(2, ranges)
    assert "gold" in str(error.value)
    assert "合法靶数为2" in str(error.value)


@pytest.mark.skipif(not REFERENCE_PATH.is_file(), reason="Reference workbook is not distributed with the source checkout")
def test_attachment_numeric_seed_columns_match_the_committed_oracle():
    namespace = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    with ZipFile(REFERENCE_PATH) as archive:
        shared_strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared_strings = ["".join(node.itertext()) for node in ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))]
        root = ElementTree.fromstring(archive.read("xl/worksheets/sheet1.xml"))
        columns = {"A": [], "C": [], "E": []}
        for row in root.find(namespace + "sheetData"):
            if int(row.attrib["r"]) == 1:
                continue
            for cell in row:
                column = "".join(char for char in cell.attrib["r"] if char.isalpha())
                value = cell.find(namespace + "v")
                if column not in columns or value is None:
                    continue
                raw = shared_strings[int(value.text)] if cell.attrib.get("t") == "s" else value.text
                columns[column].append(int(raw))
    assert tuple(columns["A"]) == ATTACHMENT_SEEDS[16]
    assert tuple(columns["C"]) == ATTACHMENT_SEEDS[8]
    assert tuple(columns["E"]) == ATTACHMENT_SEEDS[4]
