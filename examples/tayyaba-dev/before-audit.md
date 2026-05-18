# Accessibility Report

- **URL:** https://tayyaba.dev
- **Timestamp:** 2026-05-18T10:16:19.904Z
- **Score:** 72/100
- **Grade:** C
- **WCAG level:** Non-compliant

## Summary

- Violations: 3
- Critical: 0
- Serious: 1
- Moderate: 2
- Minor: 0
- Auto-fixable: 0
- Incomplete: 0

## AI Summary

Accessibility evaluation for https://tayyaba.dev
Score: 72/100 (Grade C) — WCAG compliance: Non-compliant

Found 3 violations across 31 checks: 0 critical, 1 serious, 2 moderate, 0 minor.
28 checks pass. 0 could not be fully evaluated automatically.

Top issues to fix (in priority order):
  1. [MODERATE] 34 content areas are not inside a landmark region
     WCAG: BEST-PRACTICE
     Fix: Wrap all page content in appropriate landmark elements: <header>, <nav>, <main>, <aside>, <footer>.
     Example: <main>Page content here</main>
  2. [SERIOUS] 3 links have no accessible name
     WCAG: WCAG 2A, WCAG 244, WCAG 412
     Fix: Every link must have a descriptive accessible name.
     Example: <a href="/about" aria-label="Learn more about us"><img src="arrow.svg" alt=""></a>
  3. [MODERATE] Page is missing a main landmark
     WCAG: BEST-PRACTICE
     Fix: Wrap the primary page content in a <main> element.
     Example: <main>...</main>

To auto-patch all fixable violations, call the remediate tool with mode='fix' and the source file path.

## Top Issues

### 1. 34 content areas are not inside a landmark region
- Severity: moderate
- WCAG: BEST-PRACTICE
- Affected elements: 34
- Auto-fixable: no
- Impact: Screen reader users navigating by landmarks cannot reach this content using shortcut keys.
- Suggestion: Wrap all page content in appropriate landmark elements: <header>, <nav>, <main>, <aside>, <footer>. Content outside landmarks is invisible to landmark navigation.
- Learn more: https://dequeuniversity.com/rules/axe/4.11/region?application=axeAPI

### 2. 3 links have no accessible name
- Severity: serious
- WCAG: WCAG 2A, WCAG 244, WCAG 412
- Affected elements: 3
- Auto-fixable: no
- Impact: Screen reader users cannot determine where a link goes. Voice control users cannot click links by name. This fails basic WCAG Level A compliance.
- Suggestion: Every link must have a descriptive accessible name. Add visible text between the anchor tags, or add an aria-label if the link contains only an icon. Avoid 'click here' or 'read more' as the sole link text.
- Learn more: https://dequeuniversity.com/rules/axe/4.11/link-name?application=axeAPI

### 3. Page is missing a main landmark
- Severity: moderate
- WCAG: BEST-PRACTICE
- Affected elements: 1
- Auto-fixable: no
- Impact: Keyboard and screen reader users cannot skip to the main content. This is a common navigation barrier for users who visit many pages on your site.
- Suggestion: Wrap the primary page content in a <main> element. Every page should have exactly one <main>.
- Learn more: https://dequeuniversity.com/rules/axe/4.11/landmark-one-main?application=axeAPI

