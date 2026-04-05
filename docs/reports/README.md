# Project Reports

This directory keeps Bodhi-owned reports, architecture summaries, desktop runtime notes, and product positioning material.

## Directory Structure

### `product/` — Product Positioning And Comparative Analysis
Documents that explain how the broader Zenith stack is positioned as a product and how Bodhi fits into that story.

| Document | Description |
|----------|-------------|
| `bodhi-project-analysis.md` | High-level project analysis of Bodhi’s current runtime shape, strengths, and risks |
| `claude-code-vs-zenith-agent-analysis.md` | Competitive / architectural comparison with CLI-first agent products |
| `zenith-bamboo-lotus-bodhi-improvement-checklist.md` | Cross-project improvement checklist across Bamboo, Lotus, and Bodhi |

### `runtime-checks/` — Runtime Validation Notes
Smaller validation reports and runtime-specific checks.

| Document | Description |
|----------|-------------|
| `config-directory-addition-summary.md` | Summary of `.bamboo` configuration-directory prompt enhancement work |
| `env-var-prompt-injection-report.md` | Report for env-var prompt injection behavior |
| `mermaid-enhancement-check-report.md` | Mermaid enhancement verification report |

### `agent-system/` — Agent System Design
Core design documents for the agent interaction model and role system.

| Document | Description |
|----------|-------------|
| `AGENT_ROLE_SYSTEM_DESIGN.md` | Agent role system architecture |
| `AGENT_LOOP_IMPLEMENTATION_SUMMARY.md` | Agent loop implementation overview |
| `COPILOT_AGENT_INTEGRATION_REPORT.md` | Copilot agent integration |
| [`../../../lotus/docs/reports/agent-system/AGENT_APPROVAL_FRONTEND_SUMMARY.md`](../../../lotus/docs/reports/agent-system/AGENT_APPROVAL_FRONTEND_SUMMARY.md) | Frontend approval system design (moved to Lotus) |

### `architecture/` — Architecture Summaries
Architecture decision records and high-level implementation summaries.

| Document | Description |
|----------|-------------|
| `PLAN_ACT_ARCHITECTURE_SUMMARY.md` | Plan-Act architecture overview |
| `PLAN_ACT_IMPLEMENTATION_SUMMARY.md` | Plan-Act implementation details |

### `ui-snapshots/` — UI Snapshot Notes
Markdown snapshot notes captured during UI/runtime verification.

## Quick Find

| Topic | Document |
|-------|----------|
| Product positioning | `product/claude-code-vs-zenith-agent-analysis.md` |
| Bodhi project overview | `product/bodhi-project-analysis.md` |
| Runtime checks | `runtime-checks/config-directory-addition-summary.md` |
| Cross-project improvement roadmap | `product/zenith-bamboo-lotus-bodhi-improvement-checklist.md` |
| Agent system design | `agent-system/AGENT_ROLE_SYSTEM_DESIGN.md` |
| Plan-Act architecture | `architecture/PLAN_ACT_ARCHITECTURE_SUMMARY.md` |
| Change history | [../CHANGELOG.md](../CHANGELOG.md) |

## Retention Guideline

- **Product / comparative reports** stay here if they help explain Bodhi’s product direction
- **Temporary implementation logs** should not accumulate here long-term
- **Frontend-only reports** belong in Lotus
- **Backend runtime research** belongs in Bamboo
