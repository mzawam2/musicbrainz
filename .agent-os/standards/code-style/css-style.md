# CSS Style Guide

## General Principles

- Use semantic, meaningful class names that describe the purpose or content.
- Prefer CSS custom properties (variables) for colors, spacing, and fonts.
- Organize styles by component, utility, and layout.
- Avoid using IDs for styling; use classes instead.

## Formatting

- Use consistent indentation (2 or 4 spaces).
- Use multi-line formatting for long rule sets.
- Group related properties together (e.g., positioning, box model, typography).
- Add a space between selector and opening brace.

## Naming Conventions

- Use [BEM](http://getbem.com/) (Block, Element, Modifier) or another consistent naming convention.
- Use lowercase letters and hyphens for class names.
- Avoid abbreviations unless widely understood.

## Comments

- Use comments to explain complex or non-obvious code.
- Document sections and major components.

## Specificity & Organization

- Keep specificity low; avoid using `!important`.
- Organize styles from generic to specific.
- Use utility classes for common patterns (e.g., `.text-center`, `.clearfix`).

## Responsive Design

- Use media queries for responsiveness.
- Group media queries with their related selectors.

## Accessibility

- Ensure sufficient color contrast.
- Use `:focus` styles for interactive elements.

## Performance

- Minimize the use of deeply nested selectors.
- Remove unused CSS regularly.
