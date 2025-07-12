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