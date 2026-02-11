from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import health, scores, events, event_configuration, dictionary
from app.database import Base, engine
from sqlalchemy import text

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
app.include_router(scores.router, tags=["成绩管理"])
app.include_router(events.router, tags=["赛事管理"])
app.include_router(event_configuration.router, tags=["赛事配置管理"])
app.include_router(dictionary.router, tags=["字典管理"])


@app.on_event("startup")
async def startup_event():
    """应用启动时初始化数据库"""
    try:
        # 首先删除旧的 scores 表（如果存在且结构不正确）
        with engine.connect() as conn:
            # 检查 scores 表是否存在
            result = conn.execute(text("""
                SELECT column_name FROM information_schema.columns 
                WHERE table_name='scores' AND column_name='event_id'
            """))
            has_event_id = result.fetchone() is not None
            
            if not has_event_id:
                # 旧表没有 event_id 列，删除它
                try:
                    conn.execute(text("DROP TABLE IF EXISTS scores CASCADE"))
                    conn.commit()
                    print("✓ Dropped old scores table")
                except Exception as e:
                    print(f"⚠ Could not drop old table: {e}")
        
        # 重建所有表
        Base.metadata.create_all(engine)
        print("✓ Database tables initialized successfully")
    except Exception as e:
        print(f"⚠ Error initializing database: {e}")


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
