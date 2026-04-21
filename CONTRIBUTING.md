# Contributing to Lucent Lab

Thanks for wanting to make Lucent Lab better! This guide is written for people
who have never opened a pull request before — follow it step by step and you'll
be fine.

## What counts as a contribution

Anything that helps students learn AP Chemistry more clearly:

- **Fix a typo, wrong formula, or wrong number** in a study guide
- **Fix a bug** in an animation (labels overlapping, slider misbehaving, wrong color…)
- **Add a study-mode topic** for a unit that's thin
- **Add a brand-new animation** for a concept that doesn't have one yet
- **Improve accessibility** (keyboard nav, color contrast, screen-reader labels)
- **Improve the design** — make a page cleaner, fix mobile layout, etc.

You don't need permission to start. Pick something and go.

## The easiest path: open an issue first

If you're not sure whether your idea will be accepted, or you want to talk it
through first, just **[open an issue](https://github.com/DjErok/lucentLab/issues/new)**
and describe it. I'll reply.

Good issue titles look like:
- *"VSEPR: angle label overlaps Br atom in ClF₃"*
- *"Unit 4 study guide: add a topic on net ionic equations"*
- *"Typo: Ka/Kb equation in unit08.ts line 234"*

## The path for actually changing the code

1. **Fork the repo** — click the **Fork** button at the top of
   [github.com/DjErok/lucentLab](https://github.com/DjErok/lucentLab). Now you
   have your own copy.
2. **Clone your fork** to your computer:
   ```
   git clone https://github.com/YOUR-USERNAME/lucentLab.git
   cd lucentLab
   ```
3. **Install dependencies** (needs [Node.js 20+](https://nodejs.org/)):
   ```
   npm install
   ```
4. **Run the dev server**:
   ```
   npm run dev
   ```
   Opens at `http://localhost:5173`. Changes hot-reload instantly.
5. **Make your change.** Edit the relevant file(s).
6. **Check it still builds**:
   ```
   npm run build
   ```
   If this fails, TypeScript is complaining — read the error and fix it.
7. **Commit and push** to your fork:
   ```
   git add .
   git commit -m "Fix VSEPR angle label in ClF₃"
   git push
   ```
8. **Open a pull request**: GitHub will show a green banner on your fork —
   click *"Compare & pull request"*. Fill in the description (what you
   changed, why). Submit.

I'll review, comment if anything needs tweaking, and merge. First PRs often
need a small revision — that's normal, don't take it personally.

## Where things live

- `src/animations/*.tsx` — one file per interactive animation
- `src/data/curriculum.ts` — unit list, topic outlines
- `src/data/study/unit0X.ts` — study-mode content (notes, examples, MCQs) for each unit
- `src/pages/` — top-level page components (landing, unit, periodic table)
- `src/components/` — shared UI bits (Nav, Footer, sliders, Feedback, etc.)
- `api/` — Vercel serverless functions (only used by the feedback form)

## Fixing a study-guide typo (the smallest PR)

Almost all factual content lives in `src/data/study/unitXX.ts`. Open that file,
find the string, fix it, commit, PR. You don't need to touch anything else.

See `STUDY_GUIDE_FORMAT.md` for the full schema if you're adding a new topic.

## Adding a new animation

1. Create `src/animations/YourName.tsx` — export a default React component
2. Register it in `src/animations/registry.tsx`
3. Link it from the appropriate unit in `src/data/curriculum.ts`
4. Use existing animations (e.g. `Galvanic.tsx`, `VSEPR.tsx`) as templates —
   they all follow the same theming / slider / tab conventions.

## Style conventions

- **Colors come from CSS variables**, not hex literals where possible
  (`var(--paper)`, `var(--ink-1)`, `var(--phos)`, `var(--hot)`, etc.) so the
  theme toggle works. See `src/theme.tsx`.
- **SVG diagrams**: viewBoxes should leave breathing room — labels collide
  easily if you draw too close to the edges. When in doubt, pad +20 units.
- **Study-mode math**: use `$...$` inline — it's parsed by KaTeX.
- **No new dependencies** unless there's a really good reason. Ask first.

## Bug reports

Use the feedback button at the bottom-right of any page, or open a GitHub
issue. Include: what page, what browser, what you expected, what happened,
and a screenshot if possible.

## Questions?

Open an issue with the `question` label. No question is too small.
