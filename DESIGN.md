# Design system: Lumen

> **Project override:** this app uses Lumen's structure (class names, tokens, components) but a deliberately COLOURFUL, light-only theme: gradient tiles, 3D buttons, a navy sidebar. The theme lives at the end of `client/src/index.css`, and its colours/gradients are tokens in `client/src/lumen.css`. Where the rules below ("no gradients", "one interactive colour", automatic dark mode) conflict with that, the colourful theme wins.

All UI in this project uses the Lumen design system defined in `lumen.css`. Follow these rules for every screen, component and page you build or change.

## Setup
- Load `lumen.css` once, globally, before any other stylesheet.
- Never hard-code colors, font sizes, spacing or radii. Always use the CSS variables from `lumen.css` (e.g. `var(--accent)`, `var(--space-4)`, `var(--radius-lg)`).
- If you need a new value, add it as a token in `lumen.css` first, then use the token.
- The UI is in Hebrew: set `<html lang="he" dir="rtl">`, and use logical properties (`margin-inline-start`, `padding-inline`, `text-align: start`) instead of left/right.

## Principles
- Calm, clean and content-first. Lots of whitespace; the interface steps back.
- **One interactive color.** `--accent` is used only for things you can click: primary buttons, links, selection, focus. Nothing decorative is blue.
- **Neutrals first.** Pages are `--bg-grouped` with `--surface` cards. Status colors (`--success`, `--warning`, `--danger`) appear only to report a state, as a dot, badge or fill — never as body text on white.
- **Hierarchy through type, not borders.** `h1` (large title) at the top of a screen, `h3` (headline) for card titles, body for content, `.text-footnote` + `--label-secondary` for metadata.
- **Hairlines, not boxes.** Separate rows with a 1px `--separator` line. Cards are separated from the background by color, not borders. Only floating cards on `--bg` get `.card--floating` (shadow).
- **Soft corners by hierarchy:** `--radius-lg` cards and modals, `--radius-md` lists and tables, `--radius-sm` inputs, `--radius-pill` buttons and badges.
- **Touch targets** at least 44px high.
- No gradients, no emoji as icons, no colored left-border cards, no ALL-CAPS labels.

## Components (classes in lumen.css)
- Layout: `.container`, `.section`, `.stack`, `.row`, `.grid`
- Card: `.card`, `.card--floating`
- Buttons: `.btn` + `.btn--primary` (one per screen/section) | `.btn--secondary` | `.btn--danger`, size `.btn--small`
- Forms: `.field` > `label` + `.input` (+ `.hint`); error state `.field--error`
- Lists: `ul.list` > `li` (iOS grouped rows), clickable rows `li.is-link`
- Tables: `.table-wrap` > `table.table`
- Status: `.badge` + `--success | --warning | --danger`
- Segmented control: `.segmented` > `button[aria-pressed]`
- Top bar: `.navbar` (sticky, translucent)
- Numbers: `.stat-value` + `.stat-label`

## Icons
Use one outline icon set (Lucide), 1.75px stroke, 20px, colored `--label` or `--accent`.

## Copy
Short, plain Hebrew. Buttons say exactly what happens ("שמור רכב", not "שלח"). Error messages say what went wrong and how to fix it.

## Dark mode
Automatic via `prefers-color-scheme`. To force a theme: `<html data-theme="dark">` or `data-theme="light"`. Check every new screen in both.
