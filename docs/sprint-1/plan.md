---
sprint: 1
theme: existing-system-health-check
status: completed
created: 2026-09-28
content_language: zh
---

# Sprint 1 计划：现有系统体检与最高优先级缺口修复

## 目标

在不触碰现有用户数据的前提下，运行仓库真实门禁、核对文档与代码漂移，并仅对可验证的最高优先级缺陷做最小修复。若门禁全部通过且没有明确 P0/P1 缺陷，只补齐 Kixpower 文档和验证证据。

## 任务

- [x] P1 建立项目简报、运行时快照、漂移登记与可重放 gate 清单。
- [x] D1 执行基线体检门禁，记录每条命令、退出码和关键结果。
- [x] D2 根据失败证据裁决是否存在 P0/P1 缺陷；仅在证据成立时最小修复并运行聚焦检查。
- [x] D3 补全 Dev 执行证据与最终 runtime context。

## Task DAG

```yaml
task_dag:
  nodes:
    - id: P1
      desc: "反推项目真相源并登记运行时漂移"
      depends_on: []
      coupling: none
      estimated_tokens: medium
      target_rules:
        globs: ["PROJECT_BRIEF.md", "docs/brainstorm/**", "docs/sprint-1/**"]
        modules: [docs]
        languages: [markdown, yaml]
        mechanical_links:
          - type: callees
            of: ["full-integrity-test.sh"]
    - id: D1
      desc: "执行现有系统基线体检"
      depends_on: [P1]
      coupling: strong
      estimated_tokens: medium
      target_rules:
        globs: ["full-integrity-test.sh", "backend/tests/**", "frontend/src/**/*.test.js", "docker-compose*.yml"]
        modules: [backend, frontend]
        languages: [python, javascript, shell]
        mechanical_links:
          - type: callees
            of: ["full-integrity-test.sh"]
    - id: D2
      desc: "基于失败证据实施最小 P0/P1 修复；无证据则不改应用代码"
      depends_on: [D1]
      coupling: critical
      estimated_tokens: medium
      target_rules:
        globs: ["full-integrity-test.sh", "backend/app/**", "backend/tests/**", "frontend/src/**"]
        modules: [backend, frontend]
        languages: [python, javascript, shell]
        mechanical_links:
          - type: callers
            of: ["backend/app/main.py"]
          - type: callees
            of: ["frontend/src/api/index.js"]
    - id: D3
      desc: "沉淀 Dev 证据与运行时上下文"
      depends_on: [D2]
      coupling: strong
      estimated_tokens: low
      target_rules:
        globs: ["docs/sprint-1/progress.md", "docs/sprint-1/runtime-context.md"]
        modules: [docs]
        languages: [markdown, yaml]
        mechanical_links: []
  properties:
    max_antichain_width: 1
    critical_path_depth: 4
    coupling_density: 0.33
    layers: [[P1], [D1], [D2], [D3]]
    recommended_topology: sequential
```

## Task Sizing

```yaml
task_sizing:
  task_count: 4
  dag_layers: 4
  dag_width: 1
  strong_coupling_count: 1
  historical_bug_per_sprint: 1
  derived_commit_budget: 6
  hard_cap: 10
  commit_budget_effective: 0
  note: "派生预算低于硬上限；用户禁止 commit，因此本 Sprint 实际预算为 0。"
```

## Drift Whitelist

```yaml
drift_whitelist:
  - pattern: "docs/**"
  - pattern: "PROJECT_BRIEF.md"
  - pattern: ".kixpower/memory/repo/**"
  - pattern: "**/*_test.py"
  - pattern: "**/*.test.js"
  - pattern: "frontend/dist/**"
  - pattern: "backend/test.db"
```

## Verifiable Gates

```yaml
verifiable_gates:
  - id: local_compose_config
    type: local_gate
    cmd: "docker compose -f docker-compose.yml config -q && docker compose -f docker-compose.prod.yml config -q"
    expect: "exit 0；两个 Compose 文件配置有效"
    required: true
  - id: local_backend_pytest
    type: local_gate
    cmd: "cd backend && DATABASE_URL=sqlite:///./test.db python3 -m pytest tests -q"
    expect: "exit 0；后端测试全通过"
    required: true
  - id: local_frontend_lint
    type: local_gate
    cmd: "cd frontend && npm run lint"
    expect: "exit 0；ESLint 无错误"
    required: true
  - id: local_frontend_vitest
    type: local_gate
    cmd: "cd frontend && npm run test:run"
    expect: "exit 0；Vitest 全通过"
    required: true
  - id: local_frontend_build
    type: local_gate
    cmd: "cd frontend && npm run build"
    expect: "exit 0；Vite 生产构建成功"
    required: true
  - id: local_full_integrity
    type: local_gate
    cmd: "DATABASE_URL=sqlite:///./test.db ./full-integrity-test.sh"
    expect: "exit 0；仓库综合完整性脚本全部步骤通过或明确记录脚本自身的 skip"
    required: true
  - id: ci_hosted_pipeline
    type: ci_gate
    cmd: "检查仓库是否存在已配置的托管 CI workflow 及本 revision 运行记录"
    expect: "存在则记录状态；不存在则标记 pending/unavailable，不虚报通过"
    required: false
  - id: manual_doc_code_drift
    type: manual_gate
    cmd: "核对 README 的架构、路由、认证和积分规则与当前代码/测试事实"
    expect: "明确登记已证实漂移、未覆盖项与残余风险"
    required: true
  - id: manual_data_safety
    type: manual_gate
    cmd: "确认所有测试使用独立 SQLite test.db，且未执行破坏性 SQL或改动 data/postgres"
    expect: "无用户数据变更"
    required: true
```

## 本 Sprint 不做什么

- 不新增业务功能，不顺手重构。
- 不迁移或清理 PostgreSQL 数据，不启动会写现有数据卷的测试流程。
- 不把 SQLite 结果等同为 PostgreSQL 完整兼容性证明。
- 不推送、不合并、不发布、不提交 commit。
- 不因缺少工作量而制造应用代码变更。

## 验收标准

- required local gates 在同一最终工作树状态执行并全部通过；失败时有不超过 2 次的 L2 修复重试记录。
- Dev 对每个任务的命令和结果有落盘证据。
- QA 报告区分实际执行、不可运行和待 CI 项。
- L4 validator 成功，状态计数来自 canonical backlog。
