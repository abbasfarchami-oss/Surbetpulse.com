# Remix of Remix of Remix of SureBet Finder — Guidelines

## Components

The design system exports these components — import them from `@ws-91d6c7c1fcc92258edbe/d94af990-de68-464f-9fc2-80a11c741965` and compose them before building anything from scratch:

`AnimatedNumber`, `AppShell`, `BetModeSetting`, `BetSlip`, `BookLogo`, `BookName`, `BookPlanBuilder`, `BookPricingAdmin`, `BookmakerNormalizer`, `Button`, `GlowIcon`, `I18nProvider`, `OpportunityLifetime`, `OpportunitySkeletons`, `Skeleton`, `SportTabs`, `ThemeToggle`, `TiltCard`

Per-component details (import stanzas, props, variants, examples) live in `.lovable/rules/libraries/{slug}/components.md` — on disk, not auto-loaded. Read that file or the component source when the name alone isn't enough.

## Theme Files

The design system's theme is delivered through the following files. The author's original source files carry the full wiring the design system needs — variable declarations, framework-specific directives, provider objects, etc. — and are the canonical import target.

- `@ws-91d6c7c1fcc92258edbe/d94af990-de68-464f-9fc2-80a11c741965/styles.css` (source — preferred import)
- `@ws-91d6c7c1fcc92258edbe/d94af990-de68-464f-9fc2-80a11c741965/dist/tokens.css` (auto-generated flat list of CSS custom properties — a raw-values fallback only; does NOT carry framework-specific wiring that the source files above provide)

