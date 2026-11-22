from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import app.models  # noqa: F401
from app.config import get_settings
from app.routers import scores, events, event_configuration, event_registration, dictionary, auth, scoring_rules, ranking_scorecards, elimination_scorecards
from app.database import engine
from app.bootstrap import initialize_database

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """启动时非破坏性引导；规则快照失败必须终止启动，不能静默使用错误规则。"""
    initialize_database(engine)
    yield


app = FastAPI(
    title=settings.app_name,
    description="射箭赛事积分统计系统 API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, tags=["认证"])
app.include_router(scores.router, tags=["成绩管理"])
app.include_router(events.router, tags=["赛事管理"])
app.include_router(event_configuration.router, tags=["赛事配置管理"])
app.include_router(event_registration.router, tags=["赛事报名管理"])
app.include_router(dictionary.router, tags=["字典管理"])
app.include_router(scoring_rules.router, tags=["积分规则"])
app.include_router(ranking_scorecards.router, tags=["记分纸"])
app.include_router(elimination_scorecards.router, tags=["记分纸"])


@app.get("/")
async def root():
    return {
        "message": "欢迎使用射箭赛事积分统计系统 API",
        "version": "1.0.0",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
