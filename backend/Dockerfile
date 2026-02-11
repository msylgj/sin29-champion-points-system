FROM python:3.11-slim

WORKDIR /app

# 设置环境变量以避免缓冲输出
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# 启动应用并输出更多调试信息
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
