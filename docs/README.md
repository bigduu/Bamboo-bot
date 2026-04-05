# Bodhi AI Docs

Start with the [main README](../README.md) if you want the product story first.  
This `docs/` directory is for Bodhi AI desktop runtime, packaging, product architecture, and desktop-facing reports.

## Scope Boundary

- **Bodhi AI owns**: desktop shell runtime, packaging, native integrations, release behavior, and desktop product framing
- **Lotus owns**: frontend product implementation and frontend-focused documentation
- **Bamboo owns**: backend runtime architecture, tools, memory, scheduling, and agent engine internals

Frontend docs moved to Lotus:
- Migration map: [`MOVED_TO_LOTUS.md`](./MOVED_TO_LOTUS.md)
- New frontend docs home: [`../../lotus/docs/README.md`](../../lotus/docs/README.md)

## Bodhi AI-local docs

- Architecture and shell/runtime design: [`architecture/`](./architecture/)
- Configuration and deployment: [`configuration/`](./configuration/), [`deployment/`](./deployment/)
- Migration and release notes: [`migration/`](./migration/), [`release/`](./release/)
- Product, architecture, and runtime reports: [`reports/`](./reports/)
- Technical notes: [`technical-docs/`](./technical-docs/)

## Recommended reading paths

### I want to understand Bodhi AI as a product
1. [README](../README.md)
2. [Architecture index](./architecture/README.md)
3. [Product reports](./reports/README.md)

### I want to work on the desktop shell
1. [Architecture index](./architecture/README.md)
2. [Configuration docs](./configuration/README.md)
3. [Deployment guide](./deployment/DEPLOYMENT_GUIDE.md)

### I want the current doc map
- [INDEX.md](./INDEX.md)

## Documentation placement rules

- **Product landing / user-facing positioning** → `../README.md`
- **Desktop architecture** → `architecture/`
- **Desktop/runtime/product analysis** → `reports/`
- **Release and migration notes** → `migration/`, `release/`
- **Frontend behavior docs** → Lotus, not Bodhi

