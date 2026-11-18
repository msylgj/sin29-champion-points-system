"""共享枚举成员校验；调用方保留各自选项顺序、标签及原有校验入口。"""
from collections.abc import Sequence


def validate_choice(value: str, choices: Sequence[str], label: str) -> str:
    if value not in choices:
        raise ValueError(f"{label}必须是 {choices}")
    return value
