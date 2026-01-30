"""
运动员 Pydantic Schema
"""
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional
from app.models.enums import Gender


class AthleteBase(BaseModel):
    """运动员基础数据"""
    name: str = Field(..., min_length=1, max_length=100, description="运动员姓名")
    phone: str = Field(..., min_length=10, max_length=20, description="手机号")
    id_number: str = Field(..., description="身份证号")
    gender: Gender = Field(..., description="性别")

    @field_validator('phone')
    def validate_phone(cls, v):
        if not v.replace('-', '').replace(' ', '').isdigit():
            raise ValueError('手机号必须是数字')
        return v


class AthleteCreate(AthleteBase):
    """创建运动员请求"""
    pass


class AthleteUpdate(BaseModel):
    """更新运动员请求"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, min_length=10, max_length=20)
    gender: Optional[Gender] = None


class AthleteRead(AthleteBase):
    """运动员读取响应"""
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class AthleteList(BaseModel):
    """运动员列表响应"""
    items: list[AthleteRead]
    total: int
    page: int
    page_size: int


class AthleteBatchImport(BaseModel):
    """批量导入运动员"""
    athletes: list[AthleteBase]
