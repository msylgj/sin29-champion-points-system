"""只应用服务明确允许的非空更新，不参与查询、校验或事务控制。"""
from collections.abc import Iterable


def apply_non_null_updates(target, update, fields: Iterable[str]) -> None:
    """保持旧更新语义：省略/None不清空已有值，0等其它值正常赋值。"""
    for field in fields:
        value = getattr(update, field)
        if value is not None:
            setattr(target, field, value)
