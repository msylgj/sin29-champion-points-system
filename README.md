# 射箭赛事积分统计系统

使用 Vue 3、FastAPI、SQLAlchemy 和 PostgreSQL 管理射箭赛事、报名及成绩，并根据赛事适用的规则计算年度及赛季积分。

## 页面入口

| 页面 | 路径 | 功能 |
| --- | --- | --- |
| 积分排名 | `/points-display`（首页） | 查看年度弓种排名、筛选姓名或俱乐部、导出年度或指定赛季 Excel |
| 赛事配置 | `/event-add` | 按年度和赛季维护赛事；导入、编辑或删除报名；配置团体和混双队伍数 |
| 导入成绩 | `/score-import` | 按赛事导入 Excel、查看赛事配置、维护已有成绩 |
| 积分规则管理 | `/scoring-rules` | 从赛事配置进入，查看、创建规则版本或删除最新非初始版 |

除积分排名外均需管理员验证。首页的「管理」入口进入成绩导入页。口令验证签发管理员 JWT；管理凭证失效后返回积分首页重新验证，成功后回到原管理地址。认证与运行配置见[快速开始](QUICK_START.md)。

## 业务约定

- **赛事与报名**：赛事按年度和赛季唯一。赛事配置按性别分组、弓种及距离区分。报名仅支持 Excel，按年度、赛季、姓名、距离及比赛弓种唯一。报名导入、编辑或删除后自动同步个人人数；团体人数按男子、女子、混合组维护，混双仅使用混合组。无瞄弓报名的积分弓种可选光弓、美猎弓或传统弓；其他报名的积分弓种与比赛弓种一致。
- **成绩**：导入仅支持 Excel，必填列为姓名、弓种、距离、赛制、排名，分组可选。个人赛在导入页按姓名、距离及弓种匹配该赛事报名，团体及混双不做此预校验。同赛事、姓名、距离、弓种及赛制的成绩重复导入时更新排名。
- **积分**：成绩表保存排名而非积分。查询按每场赛事的年度和赛季选用规则快照，分项四舍五入保留一位小数后再汇总。算法、版本边界及导出口径见[积分与规则](docs/SCORING.md)。

## API 入口

后端 `/docs` 提供 OpenAPI 文档。下表列出业务接口，均以 `/api` 开头。管理请求使用 `Authorization: Bearer <token>`。

| 权限 | 接口 |
| --- | --- |
| 公开 | `POST /auth/login`、`GET /events/years`、`GET /dictionaries`、`GET /scores/annual-ranking/{year}/{bow_type}` |
| 管理 | `GET /events`、`GET /events/{event_id}`、`POST /events/with-configs` |
| 管理 | `POST /event-configurations`、`PUT /event-configurations/{config_id}`、`DELETE /event-configurations/{config_id}` |
| 管理 | `GET /event-registrations`、`POST /event-registrations/batch/import`、`PUT /event-registrations/{registration_id}`、`DELETE /event-registrations/{registration_id}` |
| 管理 | `GET /scores`、`POST /scores/batch/import`、`PUT /scores/{score_id}`、`DELETE /scores/{score_id}` |
| 管理 | `GET /scoring-rules`、`POST /scoring-rules`、`DELETE /scoring-rules/{rule_id}` |

## 项目结构与文档

- [前端](frontend)：页面、API 客户端、组件、组合式函数、共享样式及测试。
- [后端](backend)：路由、模型、校验、业务服务及测试。
- [数据库初始化](database/init.sql)：PostgreSQL 空数据目录首次启动所需的表、索引及字典。
- [快速开始](QUICK_START.md)：配置、启动、验证与测试。
- [数据库设计](DATABASE_DESIGN.md)：表结构、关系、索引和初始化职责。
- [变更记录](CHANGELOG.md)：发布历史与升级注意事项。
