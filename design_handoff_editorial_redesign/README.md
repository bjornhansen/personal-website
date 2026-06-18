# Handoff: Editorial Restyle — bjornhansen.dev

## Overview
A restyle of Bjorn Hansen's personal site into an **editorial / magazine** visual
direction: a confident serif masthead, hairline rules instead of cards, monospace
section labels and metadata, and the City Detect green used only as a sparing
accent. Content and information architecture are unchanged from the current site —
this is a **visual** redesign, not a content or structure change.

The site stays a single page with the same sections: Header/nav → Hero → Work →
Background → Contact → Footer.

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype
showing the intended look and feel, not production code to copy verbatim. Your task
is to **recreate this design in the existing Next.js + Tailwind v4 codebase**
(`personal-website/`), reusing its established patterns (App Router, the `@theme`
token block in `styles/globals.css`, the existing component files, `next/font`,
`next/image`, the working dark-mode toggle).

- `editorial-reference.html` — open in any browser to see the full design rendered.
  This is the source of truth for layout, type, and spacing.
- `assets/` — the two existing images reused as-is (`hey.png`, `citydetect-logo.png`).
  They already live in `public/`.

## Fidelity
**High-fidelity.** Exact colors, fonts, sizes, and spacing are specified below and
in the reference HTML. Recreate it closely, but implement with the codebase's
existing libraries (Tailwind utilities + the `@theme` tokens), not inline styles.

---

## Design System Changes

### Fonts
The editorial direction introduces two new typefaces and **drops Inter and
Open Sans**:

| Role | Font | Usage |
|---|---|---|
| Display / headlines | **Newsreader** (Google) — serif, optical sizing | h1, section item titles (City Detect / Blackbird), the contact headline, role labels (italic) |
| Labels / metadata | **JetBrains Mono** (Google) — monospace | kicker, nav, section numbers + labels, periods, skill lists, footer |
| Body / UI | **Hanken Grotesk** (Google) — humanist sans | body fallback, anything not covered above |

Body copy in the hero and section paragraphs is set in **Newsreader** (serif) for
the editorial read; smaller meta text uses Hanken Grotesk / JetBrains Mono.

**Implementation (`app/layout.js`)** — load via `next/font/google`, expose as CSS
variables, and wire them into the `@theme` block:

```js
import { Newsreader, JetBrains_Mono, Hanken_Grotesk } from 'next/font/google'

const newsreader = Newsreader({
  subsets: ['latin'], variable: '--font-newsreader',
  weight: ['300','400','500','600'], style: ['normal','italic'], display: 'swap',
})
const mono = JetBrains_Mono({
  subsets: ['latin'], variable: '--font-mono', weight: ['400','500','700'], display: 'swap',
})
const hanken = Hanken_Grotesk({
  subsets: ['latin'], variable: '--font-sans-new', weight: ['400','500','600'], display: 'swap',
})
// add `${newsreader.variable} ${mono.variable} ${hanken.variable}` to <html>/<body> className
```

**`styles/globals.css`** — replace the font tokens in `@theme`:

```css
@theme {
  --font-*: initial;
  --font-sans: var(--font-sans-new), system-ui, sans-serif;   /* Hanken Grotesk */
  --font-serif: var(--font-newsreader), Georgia, serif;        /* Newsreader  */
  --font-mono: var(--font-mono), ui-monospace, monospace;      /* JetBrains   */

  /* Brand green — unchanged */
  --color-brand: #1a9e48;
  --color-brand-dark: #3ed074;
}
```
(Remove the old `--font-inter` / Open Sans tokens and any `font-inter` utility
usages.)

### Color tokens
Light mode is the default (keep the toggle). The palette is warm paper + ink, not
slate.

| Token | Hex | Use |
|---|---|---|
| Paper (page bg) | `#FBFAF6` | body background |
| Ink (text + rules) | `#1A1A17` | headlines, body-strong, all hairline rules, borders |
| Ink 80 | `#36352F` | hero lead paragraph |
| Ink 70 | `#46453D` | section body paragraphs |
| Meta gray | `#6B6B62` | skill lists |
| Muted gray | `#8A8A82` | periods, footer |
| Rule (subtle) | `#D8D6CB` | inner table dividers (if reused) |
| Brand green | `#1A9E48` | kicker, links, italic role, section numbers |
| Brand green (dark) | `#3ED074` | green on the dark contact block |
| Contact bg | `#1A1A17` | dark section, text `#FBFAF6`, dim text `#C9C8C0` |

Add the paper/ink values as tokens in `@theme` (e.g. `--color-paper: #FBFAF6;
--color-ink: #1A1A17;`) so utilities like `bg-paper` / `text-ink` are available;
keep `slate-*` only where you choose not to migrate.

### Layout primitives
- Content column: **max-width 760px**, centered, `px-32` ≈ `px-8` (32px) horizontal padding.
- **Hairline rules** (`1px solid #1A1A17`) separate every region — top of the hero
  lead, top of each section, etc. No cards, no rounded corners, no shadows.
- Section header pattern: a mono `01` (green) + a mono uppercase label
  (`letter-spacing:0.16em`) on a rule.

---

## Screens / Views

### Single page — `app/page.js` + components

#### 1. Header — `components/Header.js`
- **Layout**: flex row, space-between, max-w-760, `py-26px px-32px`, **bottom border 1px `#1A1A17`**.
- **Logo/name**: "Bjorn Hansen", Newsreader 22px, weight 500, `letter-spacing:-0.01em`.
- **Nav**: JetBrains Mono, 12px, uppercase, `letter-spacing:0.04em`, color `#46453D`.
  Items: Work, Background, Contact (anchor links to `#work` / `#background` / `#contact`),
  then **LinkedIn** and **GitHub** in brand green (weight 500). The current SVG icon
  links can be dropped in favor of these text links, or kept — designer's call.
- Keep the `ThemeToggle` component in the nav cluster.

#### 2. Hero — `components/Hero.js`
- **Kicker**: JetBrains Mono, 12px, uppercase, `letter-spacing:0.18em`, green, text
  `Head of Software · City Detect`. (24px bottom margin.)
- **Headline (h1)**: Newsreader, weight 400, **76px**, `line-height:0.98`,
  `letter-spacing:-0.025em`. Text across two lines:
  `Engineering` / `leader, builder & entrepreneur.` — the word **"leader" is italic,
  weight 300**.
- Below, a region separated by a **top rule**, `margin-top:44px; padding-top:36px`,
  as a flex row (gap 44px):
  - **Lead paragraph** (flex 1): Newsreader, 22px, `line-height:1.55`, color `#36352F`.
    Exact copy: *"I'm an engineering leader, builder, and entrepreneur. As Head of
    Software at City Detect, I lead the team building an AI-powered platform that
    turns street-level imagery data into insight cities and other partners can act
    on. Earlier I co-founded Blackbird, a coding-education startup that taught more
    than 15,000 middle and high school students. I care most about building things
    that do real work in the world, and about building the amazing teams that make
    it happen."*
  - **Photo** (flex none, 140×140): existing `/hey.png`, `object-fit:contain`.
    Secondary, not the focal point.
- Responsive: stack the photo above the paragraph on narrow screens; drop headline
  to ~`text-5xl`/48px.

#### 3 & 4. Work + Background — `components/PortfolioItem.js`
The bordered/rounded card is **removed**. New pattern per entry:
- **Section label row**: top rule (`1px #1A1A17`, `padding-top:20px`), flex baseline
  row: mono green number (`01` / `02`) + mono uppercase label
  (`What I'm building` / `Background`), 12px, `letter-spacing:0.16em`.
- **Entry body** (`padding:30px 0 44px`):
  - Title + period on one baseline-justified row: title in **Newsreader 44px**,
    weight 400, `letter-spacing:-0.02em`; period in **mono 12px `#8A8A82`**
    (`2023 — present` / `Previous startup`).
  - **Role**: Newsreader **italic** 19px, green (`Head of Software` / `Co-founder`).
  - **Description**: Hanken Grotesk 17px, `line-height:1.65`, `#46453D`, max-w 640px.
    (Use the existing copy strings from the current `page.js`.)
  - **Skills**: a single mono 12px line, `#6B6B62`, items joined by ` · ` — NOT pills.
    - City Detect: `AI / ML · Computer Vision · Python · Cloud · Data Platforms`
    - Blackbird: `JavaScript · jQuery · PHP · PostgreSQL · Sass · Bootstrap · AWS`
  - **Link**: 14px, `#1A1A17`, `border-bottom:1px solid #1A1A17`, `Visit {title} →`.

Keep `PortfolioItem` as the reusable component; just restyle its internals to match
the above (drop the avatar square, the rounded card, the pill chips).

#### 5. Contact — `app/page.js` `#contact`
- **Full-bleed dark band**: bg `#1A1A17`, text `#FBFAF6`, inner content max-w 760
  centered, `padding:72px 32px`.
- **Label**: mono 12px uppercase green-dark (`#3ED074`), `03 — Get in touch`.
- **Headline**: Newsreader 52px, weight 400, `Let's talk.`
- **Paragraph**: Newsreader 21px, `line-height:1.55`, `#C9C8C0`, max-w 560.
  Copy: *"Always happy to talk engineering, startups, or City Detect. I share most
  of what I'm thinking about on LinkedIn."*
- **Links** (flex, gap 36): `blmhansen@gmail.com →` (green-dark, underlined via
  bottom border) and `Connect on LinkedIn →` (paper, underlined).

#### 6. Footer — `components/Footer.js`
- max-w 760, flex space-between, mono 11px uppercase `letter-spacing:0.06em`,
  `#8A8A82`. Left: `© 2026 Bjorn Hansen`. Right: `bjornhansen.dev`.

---

## Interactions & Behavior
- **Nav links** smooth-scroll to `#work` / `#background` / `#contact` anchors.
- **Hover states**: links shift to brand green / increase underline; keep the
  existing `transition-*` approach. External links (`LinkedIn`, `GitHub`, project
  links, email) open in a new tab (`target="_blank" rel="noreferrer"`).
- **Dark mode**: keep the existing class-based toggle + the pre-paint inline script
  in `layout.js`. Provide a dark variant of the palette:
  paper → `#15140F` (or near-black), ink → `#FBFAF6`, rules → a low-contrast warm
  gray, green → `--color-brand-dark`. The contact band can stay dark in both modes.
- No new animations required beyond existing transitions.

## State Management
None new. Only the existing `ThemeToggle` state (light/dark, persisted) is involved.

## Design Tokens (summary)
- **Colors**: paper `#FBFAF6`, ink `#1A1A17`, ink-80 `#36352F`, ink-70 `#46453D`,
  meta `#6B6B62`, muted `#8A8A82`, rule-subtle `#D8D6CB`, brand `#1A9E48`,
  brand-dark `#3ED074`.
- **Type scale (px)**: h1 76 · entry title 44 · contact h2 52 · lead 22 · contact
  para 21 · role 19 · body 17 · nav/labels/meta 12 · footer 11.
- **Font weights**: Newsreader 300 (italic accents) / 400 (display+body) / 500
  (name); JetBrains Mono 400–500; Hanken Grotesk 400.
- **Spacing**: content max-width 760px; horizontal padding 32px; section vertical
  rhythm ~30px top / 44px bottom; hero top padding 72px.
- **Borders**: 1px solid ink for all rules; **no radius, no shadow** in light
  editorial chrome.

## Assets
- `assets/hey.png` — existing portrait with "Hey!" bubble (already in `public/`).
  Used small (140px) in the hero.
- `assets/citydetect-logo.png` — existing City Detect mark (already in `public/`).
  Optional in this direction; reintroduce beside "City Detect" if desired.
- New web fonts pulled from Google Fonts via `next/font` (Newsreader, JetBrains
  Mono, Hanken Grotesk) — no local files needed.

## Files
- `editorial-reference.html` — the full rendered design (open in a browser).
- Target codebase files to edit:
  - `app/layout.js` — swap fonts (next/font), update font CSS variables.
  - `styles/globals.css` — replace `@theme` font tokens, add paper/ink color tokens.
  - `components/Header.js` — restyle nav (mono, bottom rule, text social links).
  - `components/Hero.js` — serif masthead, kicker, lead paragraph + small photo.
  - `components/PortfolioItem.js` — remove card/avatar/pills; rule + serif title +
    italic role + mono skill line + underline link.
  - `app/page.js` — section label rows (mono number + label), dark contact band,
    footer; remove the old `font-inter`/slate utility usages.
  - `components/Footer.js` — mono footer.
