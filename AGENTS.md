# Repository Guidelines

## Project Structure & Modules
- `src/app/`: Angular application code (components, services, routes).
- `src/environments/`: Local environment config; `environment.ts` and `environment.prod.ts` are git-ignored.
- `public/`: Static assets copied to build output.
- `projects/`: Reusable libraries (e.g., `projects/nationwide/my-lib`, `my-lib-b`).
- `dist/`: Build output (generated).

## Build, Test, and Development
- `npm start`: Run dev server at `http://127.0.0.1:4200`.
- `npm run build`: Production build to `dist/angular-playground`.
- `npm run watch`: Dev build with watch.
- `npm test`: Run unit tests (Karma + Jasmine).
- Examples:
  - Coverage: `ng test --code-coverage`.
  - Library build: `ng build @nationwide/my-lib`.

## Coding Style & Naming
- Indentation: 2 spaces; UTF‑8; trim trailing whitespace (see `.editorconfig`).
- TypeScript quotes: single by default.
- Files: kebab-case; suffixes: `.component.ts`, `.service.ts`, `.module.ts`.
- Classes/Interfaces: PascalCase; observables end with `$` when appropriate.
- Styles: SCSS; prefer Angular Material theme utilities where possible.

## Testing Guidelines
- Frameworks: Jasmine + Karma.
- File naming: `*.spec.ts` alongside source.
- Components: use `TestBed`; assert DOM via `fixture.debugElement`.
- Services: mock HTTP with `HttpClientTestingModule`.
- Run locally: `npm test` or open the Karma runner UI for debugging.

## Commit & Pull Requests
- Commits: Conventional Commits (e.g., `feat:`, `fix:`, `chore:`). Keep messages imperative and scoped.
- PRs: include a clear description, linked issues, test evidence (coverage or screenshots for UI), and notes on breaking changes.
- Before opening a PR: rebase onto `master`, run `npm test`, and ensure build passes.

## Security & Configuration Tips
- Do not commit secrets. Keep API keys and private endpoints in local env files (`src/environments/environment*.ts`) which are ignored.
- For per-developer config, prefer local `.vscode` settings or OS keychains; never store credentials in source.
- If production values must differ at deploy time, inject via CI/CD and environment replacement rather than committing them.

