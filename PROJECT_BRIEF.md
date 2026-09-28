---
project: sin29-champion-points-system
content_language: zh
content_language_source: inferred
model_context_window: 1000000
model_context_window_source: default
active_sprint: 1
status: completed
last_updated: 2026-09-28
---

# 射箭赛事积分统计系统项目简报

## 1. 项目愿景

为射箭赛事组织者提供可审计的赛事配置、报名导入、成绩管理和年度积分排名能力，减少人工表格计算错误，并保持积分规则可追溯。

## 2. 用户与场景

- 赛事管理员：维护赛事、报名和成绩，处理 Excel 批量导入。
- 参赛者与俱乐部：查询公开的年度积分排名。
- 运维人员：通过 Docker Compose 部署 PostgreSQL、FastAPI 和 Vue 前端。

## 3. 核心价值

- 将报名、赛事配置、成绩和积分计算串成一致的数据链路。
- 对重复导入、组别归一和积分规则提供确定行为。
- 管理操作使用 JWT 鉴权，排名查询保持公开。

## 4. 当前功能范围

- 年度与赛季赛事配置。
- 报名 Excel 导入、编辑、删除及人数同步。
- 成绩 Excel 导入、编辑、删除及报名预校验。
- 年度积分排名、筛选和 Excel 导出。
- 管理员登录与受保护管理路由。

## 5. 技术架构

- 前端：Vue 3、Vue Router、Axios、Vite、Vitest、ESLint。
- 后端：FastAPI、SQLAlchemy、Pydantic Settings、Pytest。
- 数据库：PostgreSQL 15；测试默认可使用独立 SQLite `test.db`。
- 部署：Docker Compose，前后端与数据库三个服务。
- 数据初始化：`database/init.sql`。

## 6. 关键领域规则

- 赛事由 `年度 + 赛季` 唯一标识。
- 报名由 `年度 + 赛季 + 姓名 + 距离 + 比赛弓种` 唯一标识。
- 成绩由 `赛事 + 姓名 + 距离 + 弓种 + 赛制` 唯一标识。
- 年度积分由基础分、人数或队伍系数、组别系数组合计算。
- 详细规则以当前代码、数据库约束和测试为准；文档冲突时登记漂移。

## 7. 已完成

- 基线已有 90 个前后端应用源文件和 15 个测试文件。
- 已具备 README、快速启动、数据库设计、Docker Compose 与完整性测试脚本。
- Sprint 1 的 4/4 开发任务已完成，未发现需修改应用代码的 P0/P1 缺陷。
- L2 的 6/6 required local gates 已在同一 revision 通过，重试 0。
- QA 已签署 PASS；当前 SHA 的 hosted CI 与两个 required manual gates 均通过。
- L4 canonical memory backlog validator 已通过，candidate/validated/archived 为 0/0/0，`novel_evidence=false`。
- Sprint 1 Producer closeout 已完成，最终报告见 `docs/sprint-1/done.md`。

## 8. 下一步

- 下一 Sprint 优先评估 PostgreSQL 实际运行链路与 SQLite 测试覆盖之间的验证缺口。
- 将 `full-integrity-test.sh` 的绝对路径作为 P2 可移植性候选，仅在真实失败证据或任务优先级支持时处理。
- 继续遵守无明确 P0/P1 证据不制造应用代码改动的决策。

## 9. 风险登记

- `full-integrity-test.sh` 的 Python 语法检查目录写死为当前绝对路径，可移植性待真实门禁验证。
- SQLite 测试不能完全覆盖 PostgreSQL 方言、约束与容器启动链路。
- `.env` 默认密钥只适合开发；生产必须覆盖 `SECRET_KEY` 和数据库凭据。
- 仓库已有 `.github/workflows/ci.yml` 与 `.github/workflows/docker.yml`；QA 已确认当前 revision 对应的两条 hosted CI run 均成功。
- 业务规则密集，文档与代码可能随规则变更发生漂移。

## 10. 质量策略

- 后端以 Pytest 全量测试和独立 SQLite 数据库验证。
- 前端执行 ESLint、Vitest 无交互测试和 Vite 生产构建。
- Compose 文件执行 `docker compose config -q`。
- 综合验收执行仓库自带 `full-integrity-test.sh`，结果逐项记录。

## 11. 安全与数据边界

- 不执行破坏性 SQL，不修改或删除现有用户数据。
- 测试固定使用独立 SQLite 数据库，不连接默认 PostgreSQL 用户数据卷。
- 不推送、不合并、不发布、不提交 commit。
- 管理功能通过 JWT 保护；公开接口范围以路由代码为准。

## 12. 运维与运行时

- 开发编排见 `docker-compose.yml`，生产编排见 `docker-compose.prod.yml`。
- 关键配置包括 `DATABASE_URL`、`SECRET_KEY`、`DEBUG`、数据库及端口变量。
- 运行时事实与文档漂移集中记录在 `docs/sprint-1/runtime-context.md`。

## 13. 决策记录

- Sprint 1 主题：现有系统体检与最高优先级缺口修复。
- 基线：`98e9760a469912dd0c4606b059cfd387793ba7b4`。
- 当前分支：`kixpower/sprint-1-import`。
- 无失败门禁或明确 P0/P1 缺陷时，不制造应用代码改动。
- 当前工具面缺少 `runSubagent`，阶段按同一契约在主线程串行降级执行，并在证据中如实记录。

## 14. 成功标准

- Producer、Dev、L2、QA、L4 与 Producer closeout 顺序完整。
- 所有 required local gate 在同一工作树 revision 真实执行并记录。
- QA 对 ci/manual gate 给出 PASS、合法 CONDITIONAL 或明确 FAIL。
- canonical memory backlog validator 成功，L4 生命周期计数可核验。
- 最终变更限于计划范围，残余风险被明确列出。
