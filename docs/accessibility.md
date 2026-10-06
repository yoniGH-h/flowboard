# Accessibility and responsive review

A pass over the app for keyboard/screen-reader structure, color contrast, and small-viewport
layout, done as part of Phase 6. Findings below are concrete (measured contrast ratios, actual
DOM structure), not a general checklist - each one was verified against the running app, not
assumed from the code.

## Fixed during this pass

- **No `<h1>` on the public auth pages.** `AuthLayout` (used by Sign in, Sign up, Forgot
  password, Reset password) rendered its page title as an MUI `variant="h2"` `Typography`, and
  nothing else on those pages was an `<h1>` - so a screen-reader user landing on `/sign-in` had no
  top-level heading to navigate to. Every *authenticated* page already has a real `<h1>` via
  `PageHeader` (`variant="h1"`, which MUI maps to a real `<h1>` element by default), so this was
  isolated to the four public auth pages. Fixed by adding `component="h1"` to `AuthLayout`'s title
  `Typography` (`frontend/src/auth/AuthLayout.tsx`) - same visual size, now a real `<h1>`
  underneath.
- **Table header text failed WCAG AA contrast.** The `MuiTableCell` `head` style override used
  `color: '#8A8F9C'` on a white/near-white background - measured contrast **~3.24:1**, below the
  4.5:1 minimum for text this size (0.72rem, and not bold enough/large enough to qualify for the
  lower "large text" threshold). Every data table in the app (Project Management, User
  Management, Audit Log, Reports, etc.) uses this. Fixed by switching to `text.secondary`'s
  existing color (`#6B7080`, ~4.9:1 on white) in `frontend/src/theme/theme.js` - already used
  everywhere else in the app for muted labels, so this also makes table headers visually
  consistent with the rest of the UI rather than introducing a new gray.
- **Amber "warning" color failed WCAG AA contrast wherever used as text.** `#B8720A` was used as
  `theme.palette.warning.main` and, independently, as a hardcoded literal in `RiskBadge.tsx`
  (Medium Risk), `PriorityChip.tsx` (High priority), and five dashboard/KPI files (accent colors,
  a pie-chart slice, an overdue-tasks row icon). Measured contrast: **~3.85:1** on white and
  **~3.45:1** on the color's own light tint background (`#FDF1DD`, used behind the Risk/Priority
  chips) - both below the 4.5:1 minimum for normal-size text. This also affected the filled
  `warning`-color `Chip`s in `StatusChip.tsx` (`ON_HOLD` project status, `In Review` column
  category), which render white text on `warning.main` - same contrast ratio, same failure.
  Fixed by replacing every occurrence of `#B8720A` with `#8A5A00` (a darker amber in the same
  hue - still reads as "warning," not confusable with the app's error red or success green) -
  **~5.9:1** on white, **~5.3:1** on the tint background. This is a single literal swapped across
  8 files; nothing else changed. The chart-slice and non-text usages weren't required to change
  (WCAG's non-text/graphical contrast floor is only 3:1, which the original color already met),
  but darkening them too is harmless and keeps the color consistent everywhere it appears.

## Reviewed and already solid

- **Heading hierarchy on authenticated pages**: `PageHeader`'s `variant="h1"` Typography renders
  as a real `<h1>` (MUI's default variant-to-element mapping), giving every management/dashboard/
  project page exactly one top-level heading.
- **Focus indicators**: no `outline: none` (or `outline: 0`) anywhere in `frontend/src` - keyboard
  focus rings are never suppressed. `KanbanTaskCard` additionally defines an explicit
  `&:focus-visible` outline for the drag-and-drop card.
- **Form labels**: every `TextField` across the auth and task/project forms uses MUI's built-in
  `label` prop, which wires a real `<label for=...>` to the input - confirmed via the rendered
  accessibility tree on the Sign in and Sign up pages (`textbox "Email address"`, `textbox
  "Password"`, etc., each with a distinct accessible name).
- **Keyboard-operable drag-and-drop**: `KanbanTaskCard` wires dnd-kit's keyboard sensor
  (`role="button"`, `tabIndex={0}`, and an `aria-label` that explicitly states "Press space or
  enter to pick up and move with arrow keys" for draggable cards, or explains why a card can't be
  moved otherwise) - the Kanban board's core interaction isn't mouse-only.
- **No raw HTML injection**: no `dangerouslySetInnerHTML` anywhere in `frontend/src`, so there's
  no React-side stored-XSS surface to worry about on top of the contrast/heading fixes above.
- **Mobile layout** (checked at 375x812 - iPhone-class viewport): the Sign in page's fields and
  buttons stack full-width, the demo-account buttons wrap onto multiple lines cleanly, and nothing
  overflows or gets clipped.

## Known gap (not fixed - flagging honestly rather than skipping silently)

- The review covered the four public auth pages in a live browser, plus every shared component
  (`PageHeader`, `KanbanTaskCard`, `KanbanColumn`, the chip components, the theme's table-header
  and warning-color tokens) that authenticated pages are built from. It did **not** independently
  load and inspect every authenticated page one by one in a browser (that would need a running
  backend + seeded session for each), so a page-specific issue outside these shared components
  (e.g. one screen's own bespoke markup) could exist unreviewed. The shared-component fixes above
  apply everywhere those components are used, which is most of the app's surface.
