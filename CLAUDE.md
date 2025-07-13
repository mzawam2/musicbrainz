# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Angular 19 workspace containing a main application (`angularPlayground`) and two Angular libraries under the `@nationwide` scope:
- `@nationwide/my-lib` - Located in `projects/nationwide/my-lib/`
- `@nationwide/my-lib-b` - Located in `projects/nationwide/my-lib-b/`

The project uses SCSS for styling and follows Angular's standard workspace structure with libraries organized under a scoped namespace.

## Development Commands

### Application Development
- `npm start` or `ng serve` - Start development server on http://localhost:4200
- `npm run build` or `ng build` - Build the main application for production
- `npm run watch` or `ng build --watch --configuration development` - Build with file watching
- `npm test` or `ng test` - Run unit tests for the main application

### Library Development
- `ng build @nationwide/my-lib` - Build the my-lib library
- `ng build @nationwide/my-lib-b` - Build the my-lib-b library
- `ng test @nationwide/my-lib` - Run tests for my-lib
- `ng test @nationwide/my-lib-b` - Run tests for my-lib-b

### Build All Projects
- Build all libraries and application together by running builds sequentially

## Architecture Notes

### Workspace Structure
- Main application: `src/` directory with standard Angular structure
- Libraries: `projects/nationwide/` with each library in its own subdirectory
- Both libraries follow standard Angular library structure with `src/lib/` containing components and services
- Libraries export their public API through `src/public-api.ts`

### Library Configuration
- Libraries use ng-packagr for building and are configured with `ng-package.json`
- Build outputs go to `dist/nationwide/my-lib/` and `dist/nationwide/my-lib-b/`
- Each library has its own TypeScript configurations for lib, production, and spec builds

### Testing
- Uses Karma with Jasmine for unit testing
- Each library and the main app have separate test configurations
- Test files follow the `.spec.ts` naming convention

## Development Guidelines

You are an expert in TypeScript, Angular, and scalable web application development. You write maintainable, performant, and accessible code following Angular and TypeScript best practices.

### TypeScript Best Practices
- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

### Angular Best Practices
- Always use standalone components over NgModules
- Don't use explicit `standalone: true` (it is implied by default)
- Use signals for state management
- Implement lazy loading for feature routes
- Use `NgOptimizedImage` for all static images

### Components
- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- Prefer inline templates for small components
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- DO NOT use `ngStyle`, use `style` bindings instead

### State Management
- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable

### Templates
- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables

### Services
- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection