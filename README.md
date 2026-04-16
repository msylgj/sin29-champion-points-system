# 射箭赛事积分统计系统

本项目是一个基于 `Vue 3 + FastAPI + PostgreSQL` 的射箭赛事积分系统，当前实现覆盖赛事配置、报名导入与管理、成绩导入与管理、年度积分排名查询。

## 项目概览

- 前端：Vue 3、Vite、Vue Router、Axios、XLSX
- 后端：FastAPI、SQLAlchemy、PostgreSQL
- 部署方式：Docker Compose
- 数据初始化：`database/init.sql`

## 前端页面

当前前端只有 3 个主页面：

- `积分排名`
  - 路径：`/points-display`
  - 文件：`frontend/src/views/PointsDisplay.vue`
  - 功能：
    - 选择年度与弓种查看年度积分排名
    - 支持姓名、俱乐部筛选
    - 支持导出 Excel

- `赛事配置`
  - 路径：`/event-add`
  - 文件：`frontend/src/views/EventAdd.vue`
  - 功能：
    - 选择赛年、赛季创建或更新赛事
    - 导入报名表（仅支持 Excel）
    - 查看与编辑已导入报名
    - 根据报名数据同步赛事配置中的个人人数
    - 配置团体和混双人数

- `导入成绩`
  - 路径：`/score-import`
  - 文件：`frontend/src/views/ScoreImport.vue`
  - 功能：
    - 选择赛事
    - 导入成绩（仅支持 Excel）
    - 导入时按报名表校验成绩是否合法
    - 查看赛事配置预览
    - 查看与编辑当前赛事已有成绩

## 当前业务功能

### 1. 赛事配置

- 赛事按 `年度 + 赛季` 唯一
- 赛事配置按 `性别分组 + 弓种 + 距离` 维护
- 个人人数来自报名表统计，不支持手工修改
- 团体人数支持 `男子组 / 女子组 / 混合组`
- 混双人数仅支持 `混合组`

### 2. 报名管理

- 报名表存储在 `event_registrations`
- 报名导入仅支持 Excel
- 导入时支持：
  - 距离模糊匹配
  - 比赛弓种模糊匹配
  - 分组按性别分组字典模糊匹配
- 报名唯一性规则：
  - `同年度 + 同赛季 + 同姓名 + 同距离 + 同比赛弓种`
- 当比赛弓种为 `无瞄弓` 时：
  - 积分弓种只允许 `光弓 / 美猎弓 / 传统弓`
- 当比赛弓种不是 `无瞄弓` 时：
  - 积分弓种固定等于比赛弓种
- 报名导入、编辑、删除后会同步更新赛事配置中的个人人数

### 3. 成绩管理

- 成绩表存储在 `scores`
- 成绩唯一性规则：
  - `同赛事 + 同姓名 + 同距离 + 同弓种 + 同赛制`
- 批量导入时，如果唯一键重复，则覆盖更新 `rank`
- 成绩导入仅支持 Excel
- 成绩导入要求列：
  - `姓名 / 弓种 / 距离 / 赛制 / 排名`
- 导入时按当前赛事对应赛季的报名表做校验：
  - 用 `姓名 + 距离 + 弓种` 匹配报名
  - 未匹配到报名记录时，该行成绩标记为异常

### 4. 年度积分排名

- 积分页调用 `GET /api/scores/annual-ranking/{year}/{bow_type}`
- 查询人群来自报名表：
  - 当年 `points_bow_type = 所选弓种` 的报名人员
- 积分计算规则：
  - 基础积分：
    - 排位赛：
      - 第 1-8 名分别为 `25 / 22 / 19 / 15 / 10 / 8 / 6 / 4`
      - 超出前 8 名时基础积分按 `1` 计
    - 淘汰赛：
      - 第 1-4 名分别为 `45 / 40 / 35 / 30`
      - 第 5-8 名统一为 `20`
      - 第 9-12 名统一为 `15`
      - 第 13-16 名统一为 `10`
      - 超出前 16 名时基础积分按 `1` 计
    - 团体赛、混双赛：
      - 第 1-8 名分别为 `20 / 15 / 10 / 8 / 5 / 4 / 3 / 2`
      - 超出前 8 名时基础积分按 `1` 计
  - 人数/队伍数系数：
    - 排位赛、淘汰赛使用“个人人数系数表”
      - `8-15` 人：系数 `0.6`，仅前 `4` 名保留原额基础积分
      - `16-31` 人：系数 `0.8`，仅前 `8` 名保留原额基础积分
      - `32-63` 人：系数 `1.0`，仅前 `16` 名保留原额基础积分
      - `64-127` 人：系数 `1.2`，仅前 `16` 名保留原额基础积分
      - `128+` 人：系数 `1.4`，仅前 `16` 名保留原额基础积分
    - 团体赛、混双赛使用“队伍数系数表”
      - `3-4` 队：系数 `0.6`，仅前 `2` 名保留原额基础积分
      - `5-7` 队：系数 `0.8`，仅前 `4` 名保留原额基础积分
      - `8-10` 队：系数 `1.0`，仅前 `8` 名保留原额基础积分
      - `11-14` 队：系数 `1.2`，仅前 `8` 名保留原额基础积分
      - `15+` 队：系数 `1.4`，仅前 `8` 名保留原额基础积分
  - 组别系数：
    - 根据 `弓种 + 距离` 在 `competition_groups` 中匹配组别
    - `S / A` 组：系数 `1.0`
    - `B` 组：系数 `0.5`
    - `C` 组：系数 `0.3`
    - 未匹配组别时按 `0`
  - 各赛制人数来源：
    - 排位赛、淘汰赛：
      - 根据成绩所属 `赛季 + 姓名 + 距离 + 弓种` 在报名表中匹配报名记录
      - 再根据报名记录的性别分组匹配赛事配置中的 `individual_participant_count`
      - 若未匹配到有效人数或人数为 `0`，按 `8` 计
    - 团体赛：
      - 根据成绩的 `event_id + 弓种 + 距离` 在赛事配置中取 `team_count`
      - 姓名不含 `*` 时，按 `男子组 -> 混合组` 顺序取第一个大于 `0` 的值
      - 姓名含 `*` 时，按 `女子组 -> 混合组` 顺序取第一个大于 `0` 的值
      - 若都没有有效值，按 `3` 计
    - 混双赛：
      - 根据成绩的 `event_id + mixed + 弓种 + 距离` 取 `mixed_doubles_team_count`
      - 若未匹配到有效值或人数为 `0`，按 `3` 计
  - 最终积分计算顺序：
    - 先取基础积分
    - 再按人数/队伍数确定系数和“可保留原额积分的排名上限”
    - 若排名超出上限，则基础积分改为 `1`
    - 最终积分 = `基础积分 × 系数 × 组别系数`
- 俱乐部展示取该年度该姓名最早一次报名记录中的俱乐部

## 认证方式

管理功能使用管理员密码认证：

- 登录接口：`POST /api/auth/login`
- 请求体：`{"password": "明文密码"}`
- 服务端校验逻辑：
  - 对明文密码做 `SHA-256`
  - 与 `.env` 中的 `SECRET_KEY` 进行比对
- 登录成功后返回 JWT
- 前端将 token 保存到 `localStorage.admin_auth_token`
- 管理页面：
  - `/event-add`
  - `/score-import`
  需要已登录管理员

## API 概览

### 公开接口

- `GET /`
- `POST /api/auth/login`
- `GET /api/events/years`
- `GET /api/dictionaries`
- `GET /api/scores/annual-ranking/{year}/{bow_type}`

### 需要认证的接口

- 赛事
  - `GET /api/events`
  - `GET /api/events/{event_id}`
  - `POST /api/events/with-configs`

- 赛事配置
  - `POST /api/event-configurations`
  - `PUT /api/event-configurations/{config_id}`
  - `DELETE /api/event-configurations/{config_id}`

- 报名
  - `GET /api/event-registrations`
  - `POST /api/event-registrations/batch/import`
  - `PUT /api/event-registrations/{registration_id}`
  - `DELETE /api/event-registrations/{registration_id}`

- 成绩
  - `GET /api/scores`
  - `POST /api/scores/batch/import`
  - `PUT /api/scores/{score_id}`
  - `DELETE /api/scores/{score_id}`

## 项目结构

```text
sin29-champion-points-system
├── backend/
│   ├── app/
│   │   ├── models/
│   │   ├── routers/
│   │   ├── schemas/
│   │   └── services/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── router/
│   │   ├── styles/
│   │   ├── utils/
│   │   └── views/
│   └── package.json
├── database/
│   ├── init.sql
│   └── migrations/
├── docker-compose.yml
├── README.md
├── QUICK_START.md
└── DATABASE_DESIGN.md
```

## 文档导航

- 启动与验收：`QUICK_START.md`
- 数据库结构：`DATABASE_DESIGN.md`
