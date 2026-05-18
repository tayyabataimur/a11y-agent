# Real audit → diff → verification: tayyaba.dev

This example is **not synthetic**. The artifacts here come from running loop11y against the live https://tayyaba.dev site and a snippet that mirrors the failing markup from that page.

## Files

| File | What it is |
|---|---|
| `before-audit.json` / `before-audit.md` | `loop11y audit https://tayyaba.dev` output. The full live-site report. |
| `before.html` | A minimal HTML snippet that reproduces the footer-link failures axe found on the live site. |
| `snippet-before.json` | Audit of `before.html`. Score 65, Grade C. 4 violations (2 serious, 2 moderate). |
| `patch.diff` | Diff produced by running `patchAll(before.html, ['html-has-lang', 'link-name'])`. |
| `after.html` | `before.html` with the patches applied. |
| `snippet-after.json` | Audit of `after.html`. Score 89, Grade B. Serious violations: 0. |

## Reproduce

```bash
npm ci
npm run build

# 1. Audit the live site
node dist/index.js audit https://tayyaba.dev --json --output examples/tayyaba-dev/before-audit.json

# 2. Audit the snippet
node dist/index.js audit:file examples/tayyaba-dev/before.html --json --output examples/tayyaba-dev/snippet-before.json

# 3. Apply patches programmatically
node -e "
  const { patchAll } = require('./dist/lib/patcher.js');
  const { readFileSync, writeFileSync } = require('node:fs');
  const src = readFileSync('examples/tayyaba-dev/before.html', 'utf8');
  const { finalSource } = patchAll(src, 'before.html', ['html-has-lang', 'link-name']);
  writeFileSync('examples/tayyaba-dev/after.html', finalSource);
"

# 4. Verify
node dist/index.js audit:file examples/tayyaba-dev/after.html --json --output examples/tayyaba-dev/snippet-after.json
diff -u examples/tayyaba-dev/before.html examples/tayyaba-dev/after.html
```

## What this example demonstrates honestly

- **`html-has-lang` is a safe autofix.** `lang="en"` is correct for this page; reviewer cost is zero.
- **`link-name` is a draft (guided) fix.** loop11y inserted `aria-label="Describe this link destination"` on three social-icon links. The score jumped to 89, but a screen reader would now announce literally "Describe this link destination" — useless. A human must replace each placeholder with the real destination ("GitHub profile", "LinkedIn profile", "Email Tayyaba").
- That is why `link-name`, `button-name`, and `image-alt` are tagged `safety: "guided-fix"` and are **not** applied by `remediate` unless you pass `apply_drafts: true`. Automated-pass / manual-fail outcomes are worse than visible failures because they hide the problem.

The `patch.diff` in this directory was generated with the equivalent of `apply_drafts: true` so you can see exactly what the drafts look like. Do not merge a draft into production without replacing the placeholder strings.
