---
sprint: 1
status: PASS
qa_started_sha: 98e9760a469912dd0c4606b059cfd387793ba7b4
qa_verified_sha: 98e9760a469912dd0c4606b059cfd387793ba7b4
l2_verified_sha: 98e9760a469912dd0c4606b059cfd387793ba7b4
l2_gate_manifest_sha256: 40b7ef8a2d9aaf0c5566f756f91c4d0e672a8f4151df8d070832bdcab5a247f9
qa_gate_manifest_sha256: 40b7ef8a2d9aaf0c5566f756f91c4d0e672a8f4151df8d070832bdcab5a247f9
qa_test_changes: []
ci_pending: false
---

# Sprint 1 QA 签署

## 结论

**PASS**。L2 已在同一 revision 记录 6/6 required local gates 通过；QA 未重跑 local gates。托管 CI 在当前 SHA 有成功记录，两个 required manual gates 均通过，未发现 P0/P1 缺陷或用户数据变更。

## Revision 信任链

| 检查 | 结果 | 证据 |
|---|---|---|
| HEAD 与 QA/L2 SHA 一致 | PASS | `HEAD = qa_started_sha = l2_verified_sha = 98e9760a469912dd0c4606b059cfd387793ba7b4` |
| required local gate 集合 | PASS | plan 中 6 个 required local gate ID 与 `l2_verification_passed` 完整一致 |
| manifest 交接 | PASS | handoff、progress 与 QA session marker 均记录 `40b7ef8a2d9aaf0c5566f756f91c4d0e672a8f4151df8d070832bdcab5a247f9` |
| stash 一致性 | PASS | L2、QA session marker 与当前 `git stash` 均为空集合 |
| QA 测试变更 | PASS | `qa_test_changes: []`；QA 未修改测试、fixture 或测试配置 |

说明：QA 签署时主机没有 `pwsh`，先核对 required gate ID 集合；收尾阶段使用临时 PowerShell 7.4.6 运行 canonical contract helper，对当前 `plan.md` 的 6 个 required local gates 独立复算，得到与各交接 artifact 一致的摘要。

## 客观门禁

| Gate | 类型 | 结果 | QA 证据 |
|---|---|---|---|
| `local_compose_config` | local_gate | PASS（采信 L2） | progress 记录 exit 0；QA 按约束未重跑 |
| `local_backend_pytest` | local_gate | PASS（采信 L2） | progress 记录 63 passed；命令显式设置 `DATABASE_URL=sqlite:///./test.db` |
| `local_frontend_lint` | local_gate | PASS（采信 L2） | progress 记录 exit 0；QA 按约束未重跑 |
| `local_frontend_vitest` | local_gate | PASS（采信 L2） | progress 记录 8 files、25 tests；QA 按约束未重跑 |
| `local_frontend_build` | local_gate | PASS（采信 L2） | progress 记录 96 modules transformed；QA 按约束未重跑 |
| `local_full_integrity` | local_gate | PASS（采信 L2） | progress 记录 10/10；入口默认并显式传递 SQLite `test.db` |
| `ci_hosted_pipeline` | ci_gate，required=false | PASS | 当前 SHA 有 GitHub Actions `CI` run `31465749301` 与 `Build and Push Images On Tag` run `31465867884`，均为 `completed/success` |
| `manual_doc_code_drift` | manual_gate | PASS | README 四类声明均有下述代码或测试证据；签署时发现 1 项非阻断的 Sprint 文档漂移，已在 closeout 修正 |
| `manual_data_safety` | manual_gate | PASS | QA 未启动服务、未运行数据库命令；SQLite 测试入口成立；未发现破坏性 SQL或非文档工作树改动；`data/postgres` 目录元数据未在 QA 期间变化 |

## Manual：README 与代码

| README 声明 | 结果 | 可定位证据 |
|---|---|---|
| Vue 3 + FastAPI + PostgreSQL + Docker Compose 架构 | 支持 | `frontend/package.json`；`backend/app/main.py`；`docker-compose.yml` 的 PostgreSQL 15、backend、frontend 三服务 |
| 三个主路由及管理页保护 | 支持 | `frontend/src/router/index.js` 定义 `/points-display`、`/event-add`、`/score-import`；后两者设置 `requiresAdminAuth`；`frontend/src/router/index.test.js` 覆盖未认证重定向和已认证放行 |
| 管理员密码 SHA-256 校验、JWT、Bearer | 支持 | `backend/app/security.py`、`backend/app/routers/auth.py`；受保护 router 使用 `Depends(verify_admin_token)`；`frontend/src/api/index.js` 注入 Bearer token，相关测试验证 header 与 401 清理 |
| 年度排名来源、无瞄弓兼容与排序 | 支持 | `backend/app/services/score_service.py` 按报名积分弓种筛选、关联成绩、人数回退和季节排序；`backend/tests/test_api_endpoints.py` 覆盖年度聚合与无瞄弓兼容 |
| 基础分、人数/队伍系数、组别倍率和计算顺序 | 支持 | `backend/app/services/scoring_calculator.py` 的积分表、区间表、`GROUP_MULTIPLIERS` 与 `calculate_points`；`backend/tests/test_scoring_calculator.py` 覆盖主要区间、排名截断和组别系数 |

QA 签署时证实一项漂移：`docs/sprint-1/runtime-context.md` 与 `docs/sprint-1/drift-check.md` 当时写“未发现托管 CI workflow”，但仓库实际存在 `.github/workflows/ci.yml` 和 `.github/workflows/docker.yml`，且当前 SHA 有两条成功运行。该漂移不影响 gate 结论，已由 closeout 在上述两份文档中修正；QA 阶段本身未修改这些非 QA 文档。

## Manual：数据安全

- QA 未连接 PostgreSQL，未启动 Docker Compose 服务，未执行 SQL。
- `full-integrity-test.sh` 默认 `DATABASE_URL=sqlite:///./test.db`，并将同一值传给 Pytest 和内联 Python；后端测试统一导入该进程配置下的 `app.database` engine。
- 在应用、测试、初始化 SQL和 Compose 文件的只读扫描中未命中 `DROP`、`TRUNCATE` 或 `DELETE FROM`。
- `git status --short --untracked-files=all` 未显示 `data/postgres` 或任何应用代码变更。
- `data/postgres` 属于 UID 70、权限 0700，QA 用户不能遍历内容；目录自身 mtime/ctime 在 QA 前后保持 `2026-09-27 07:34:21 +0800`。因此结论基于未执行写路径、Git 状态和目录元数据，不宣称完成内容级哈希核验。

## 残余风险

1. 本地及 hosted 后端测试都使用 SQLite，不能证明 PostgreSQL 方言、初始化和卷挂载链路完全兼容。
2. `data/postgres` 权限阻止内容级前后哈希；当前只能证明 QA 未执行写入路径且目录元数据未变。
3. 前端路由测试直接覆盖 `/score-import`，`/event-add` 依赖同一 `requiresAdminAuth` 守卫但没有独立路由用例。
4. 主机未安装 PowerShell；本次依赖临时 PowerShell 7.4.6 运行 canonical helper，临时运行时被清理后需重新获取。
5. QA 签署时发现的 runtime/drift CI 文档漂移已在 closeout 修正。

## QA 边界

QA 仅创建本签署文件，未修改应用代码、README、PROJECT_BRIEF、plan、测试或 fixture，未执行 commit、push、merge 或 publish。根据 Kixpower 角色写域，`progress.md` 的 QA 权威字段与阶段状态由 Orchestrator 回填；建议回填 `qa_verified_sha`、`qa_gate_manifest_sha256`、`ci_pending: false`，并将 Q1 标记完成。
