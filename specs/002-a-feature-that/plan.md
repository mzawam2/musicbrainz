# Implementation Plan: Last.fm Tag-Based Spotify Playlist Creation

**Branch**: `002-a-feature-that` | **Date**: 2025-09-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-a-feature-that/spec.md`
**User Context**: Update tag search to perform search against last.fm and display artists results

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, or `GEMINI.md` for Gemini CLI).
6. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Update the Last.fm tag-based Spotify playlist creation feature to include a search step that displays artist results before playlist creation. Users will enter a tag, see the artists that would be included, and then proceed with playlist creation. This enhances the user experience by providing transparency and allowing verification before committing to playlist creation.

## Technical Context
**Language/Version**: TypeScript 5.9.2 with Angular 20.2.1  
**Primary Dependencies**: Angular Material 20.2.0, RxJS 7.8.0, Angular Signals for state management  
**Storage**: Browser localStorage for caching, Last.fm API (5min TTL), Spotify API  
**Testing**: Karma + Jasmine with Chrome/headless support, coverage reporting enabled  
**Target Platform**: Modern web browsers (ES2022), responsive design for mobile/desktop
**Project Type**: web - Angular frontend application with external API integrations  
**Performance Goals**: <2s tag search response, <30s playlist creation for 20 artists, smooth UI animations  
**Constraints**: Last.fm API rate limits (1 request/second), Spotify OAuth token expiry handling, offline-capable search results caching  
**Scale/Scope**: Single-user application, ~50 UI components, existing tag search infrastructure ready for enhancement

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (Angular frontend app only)
- Using framework directly? YES (Angular Material components, no custom wrappers)
- Single data model? YES (existing LastfmTagArtist, no DTOs needed)
- Avoiding patterns? YES (using Angular services directly, no Repository pattern)

**Architecture**:
- EVERY feature as library? N/A (frontend enhancement to existing feature)
- Libraries listed: N/A (UI enhancement only)
- CLI per library: N/A (web application)
- Library docs: N/A (UI feature documentation in component specs)

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? YES (write failing tests first)
- Git commits show tests before implementation? YES (will commit test updates before UI changes)
- Order: Contract→Integration→E2E→Unit strictly followed? YES (component contract tests → integration → unit)
- Real dependencies used? YES (actual Last.fm API calls, real Angular testing utilities)
- Integration tests for: component behavior, service integration, user workflow
- FORBIDDEN: Implementation before test, skipping RED phase

**Observability**:
- Structured logging included? YES (Angular console logging, error tracking in services)
- Frontend logs → backend? N/A (no backend in this enhancement)
- Error context sufficient? YES (comprehensive error handling in existing services)

**Versioning**:
- Version number assigned? Minor increment (UI enhancement to existing feature)
- BUILD increments on every change? YES (follows existing project patterns)
- Breaking changes handled? N/A (additive UI enhancement only)

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure]
```

**Structure Decision**: Option 2 (Web application) - Angular frontend with external API integrations

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `/scripts/update-agent-context.sh [claude|gemini|copilot]` for your AI assistant
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy** (UI Enhancement Focus):
- Load `/templates/tasks-template.md` as base
- Generate UI-focused tasks from Phase 1 contracts and quickstart scenarios
- UI component contract → component test tasks [P]
- Each workflow scenario → integration test task
- Implementation tasks for signals, templates, and styling
- **Note**: Backend implementation tasks SKIPPED (already complete)

**Specific Task Categories**:
1. **Component Test Tasks** [P]:
   - Search workflow contract tests
   - Signal state management tests  
   - UI element visibility/behavior tests
   - Error handling tests

2. **Implementation Tasks** (Sequential):
   - Add new signals to component TypeScript
   - Implement `searchArtists()` method
   - Update template with search UI elements
   - Add styling for search results and chips
   - Update component validation logic

3. **Integration Test Tasks**:
   - Search → Preview → Create workflow test
   - No results handling test
   - Loading state management test
   - Accessibility compliance test

**Ordering Strategy**:
- TDD order: Component contract tests → Implementation → Integration tests
- UI component focus: Signals → Methods → Template → Styles
- Mark [P] for parallel test creation (independent test files)

**Estimated Output**: 12-15 numbered, ordered tasks in tasks.md (smaller scope due to existing implementation)

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [ ] Complexity deviations documented

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*