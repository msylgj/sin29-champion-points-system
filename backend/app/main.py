from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import scores, events, event_configuration, dictionary, auth
from app.database import Base, engine

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """应用生命周期：启动时初始化数据库"""
    try:
        Base.metadata.create_all(engine)
        print("✓ Database tables initialized successfully")
    except Exception as e:
        print(f"⚠ Error initializing database: {e}")

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
app.include_router(dictionary.router, tags=["字典管理"])


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
