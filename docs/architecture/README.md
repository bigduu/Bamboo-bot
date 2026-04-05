# Architecture Documentation

This directory contains Bodhi-owned architecture documentation for the desktop shell, runtime boundary, and system integration story.

## Core Architecture

### System and product map
- [`zenith-flow-diagram.md`](./zenith-flow-diagram.md) - High-level architecture flow across Bamboo, Lotus, Bodhi, and Pavilion

### Context and session management
- [`CONTEXT_SESSION_ARCHITECTURE.md`](./CONTEXT_SESSION_ARCHITECTURE.md) - Complete architecture overview for Context Manager v2.0
- [`context-manager-migration.md`](./context-manager-migration.md) - Migration guide from v1.0 to v2.0
- [`context_manager_fsm_plan.md`](./context_manager_fsm_plan.md) - Finite State Machine design
- [`context_manager_plan.md`](./context_manager_plan.md) - Original planning document

### Interaction and workflow architecture
- Frontend architecture moved to Lotus:
  - [`../../../lotus/docs/architecture/FRONTEND_ARCHITECTURE.md`](../../../lotus/docs/architecture/FRONTEND_ARCHITECTURE.md)
- [`AGENT_LOOP_ARCHITECTURE.md`](./AGENT_LOOP_ARCHITECTURE.md) - Agent interaction loop
- [`WORKFLOW_SYSTEM_ARCHITECTURE.md`](./WORKFLOW_SYSTEM_ARCHITECTURE.md) - Workflow system design

### Tool and model system
- [`tools-system.md`](./tools-system.md) - Tool system developer guide
- [`copilot_model_refactor_plan.md`](./copilot_model_refactor_plan.md) - Copilot model refactor
- [`openai_adapter_plan.md`](./openai_adapter_plan.md) - OpenAI adapter design

### Enhancement plans
- [`MERMAID_ENHANCEMENT.md`](./MERMAID_ENHANCEMENT.md) - Mermaid diagram enhancements
- [`SYSTEM_PROMPT_PERSISTENCE_DESIGN.md`](./SYSTEM_PROMPT_PERSISTENCE_DESIGN.md) - System prompt persistence design
- [`SYSTEM_PROMPT_IMPLEMENTATION_STATUS.md`](./SYSTEM_PROMPT_IMPLEMENTATION_STATUS.md) - Implementation status

## Suggested reading

### I want the big picture
1. [`zenith-flow-diagram.md`](./zenith-flow-diagram.md)
2. [`CONTEXT_SESSION_ARCHITECTURE.md`](./CONTEXT_SESSION_ARCHITECTURE.md)
3. [`AGENT_LOOP_ARCHITECTURE.md`](./AGENT_LOOP_ARCHITECTURE.md)

### I want to understand the desktop/runtime boundary
1. [`zenith-flow-diagram.md`](./zenith-flow-diagram.md)
2. [`WORKFLOW_SYSTEM_ARCHITECTURE.md`](./WORKFLOW_SYSTEM_ARCHITECTURE.md)
3. [`tools-system.md`](./tools-system.md)

### I want frontend details
- See Lotus: [`../../../lotus/docs/architecture/FRONTEND_ARCHITECTURE.md`](../../../lotus/docs/architecture/FRONTEND_ARCHITECTURE.md)

## Maintenance note

Bodhi architecture docs should stay focused on desktop shell behavior, desktop product structure, and Bamboo/Lotus integration boundaries. Deep backend runtime internals should live in Bamboo docs.
