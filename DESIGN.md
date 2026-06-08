# Design Brief

## Direction

EdgeStack — brutalist task tracker for developers. Dark, minimal, high-contrast interface with surgical cyan accents.

## Tone

Raw and focused. No decoration, maximum clarity. Every UI element serves function. Developer-centric tooling aesthetic.

## Differentiation

Monochrome canvas broken only by electric cyan button highlights — pure functionality with an energetic accent.

## Color Palette

| Token       | OKLCH          | Role                   |
| ----------- | -------------- | ---------------------- |
| background  | 0.12 0 0       | deep charcoal base     |
| foreground  | 0.9 0 0        | crisp white text       |
| card        | 0.16 0 0       | subtle elevated panels |
| primary     | 0.7 0.22 200   | electric cyan          |
| accent      | 0.7 0.22 200   | interactive highlights |
| muted       | 0.2 0 0        | secondary content      |
| destructive | 0.55 0.22 25   | delete/dangerous       |

## Typography

- Display: Geist Mono — headings, technical accent
- Body: General Sans — UI labels, form text
- Scale: hero `text-3xl font-bold`, h2 `text-xl font-semibold`, label `text-xs uppercase`, body `text-sm`

## Elevation & Depth

Layering via borders and subtle card backgrounds. No shadows. One border color (`--border`) for all edges. Card rows on dark background with 1px border in muted grey.

## Structural Zones

| Zone    | Background   | Border       | Notes                                |
| ------- | ------------ | ------------ | ------------------------------------ |
| Header  | `--card`     | `border-b`   | app name in mono, centered           |
| Content | `--background` | —          | task list area, spacious grid        |
| Footer  | `--card`     | `border-t`   | optional info or controls            |

## Spacing & Rhythm

Compact 0.5rem (8px) grid. Cards separated by 1rem (16px) vertical gap. Tight horizontal padding within cards. Form elements stacked vertically with 0.75rem (12px) gaps.

## Component Patterns

- Buttons: cyan background, dark text, 2px radius, no shadow. Hover: slightly brighter cyan.
- Cards (task rows): dark card background, 1px border, 2px radius, flex layout with checkbox | title | status | actions.
- Form inputs: dark input background, 1px border, 2px radius. Focus: cyan ring.
- Badges: muted background, foreground text, no radius (sharp corners).

## Motion

- Entrance: fade in 150ms on item add.
- Hover: cyan button brightens 100ms, background subtly lifts via border highlight.
- Decorative: none.

## Constraints

- No gradients, textures, or transparency effects.
- No shadows (shadow-none everywhere).
- No animations beyond 150ms fade/highlight.
- Cyan accent used ONLY for interactive CTAs and focus states.

## Signature Detail

Electric cyan action buttons isolated in a monochrome canvas — bold accents on a brutalist interface create visual rhythm without clutter.
