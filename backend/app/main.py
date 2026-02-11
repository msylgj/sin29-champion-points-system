from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import health, athletes, scores, events, stats
from app.routers import event_configuration

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="射箭赛事积分统计系统 API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api", tags=["健康检查"])
app.include_router(athletes.router, tags=["运动员管理"])
app.include_router(scores.router, tags=["成绩管理"])
app.include_router(events.router, tags=["赛事管理"])
app.include_router(event_configuration.router, tags=["赛事配置管理"])
app.include_router(stats.router, tags=["统计和排名"])


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
