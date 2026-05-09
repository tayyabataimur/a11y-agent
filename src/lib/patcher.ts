import { Project, SyntaxKind, type JsxOpeningElement, type JsxSelfClosingElement, type Node } from "ts-morph";
import { readFileSync } from "fs";

export interface PatchResult {
  violation_id: string;
  original: string;
  patched: string;
  explanation: string;
  wcag: string;
  changed: boolean;
}

// Metadata about a violation's patchability — returned in remediate reports
export interface ViolationMeta {
  id: string;
  auto_fixable: boolean;
  wcag: string;
  explanation: string;
}

type PatchStrategy = (source: string, filename: string) => Omit<PatchResult, "violation_id" | "original">;

type JsxElement = JsxOpeningElement | JsxSelfClosingElement;

// Returns true if a JsxOpeningElement has non-whitespace text content children,
// meaning the element already has a visible accessible name through its content.
// ts-morph wraps JSX children in a SyntaxList, so we look one level deeper.
function hasTextContent(openingEl: JsxOpeningElement): boolean {
  const parent = openingEl.getParent();
  if (!parent || parent.getKind() !== SyntaxKind.JsxElement) return false;

  for (const child of parent.getChildren()) {
    if (child.getKind() === SyntaxKind.JsxText && child.getText().trim().length > 0) {
      return true;
    }
    if (child.getKind() === SyntaxKind.SyntaxList) {
      for (const grandchild of child.getChildren()) {
        if (grandchild.getKind() === SyntaxKind.JsxText && grandchild.getText().trim().length > 0) {
          return true;
        }
      }
    }
  }
  return false;
}

// ─── Patch strategies ────────────────────────────────────────────────────────
// Each strategy receives the current source string and a filename (for ts-morph's
// in-memory filesystem). They return the patched source without touching disk.

function strategyImageAlt(source: string, filename: string): Omit<PatchResult, "violation_id" | "original"> {
  const project = new Project({ useInMemoryFileSystem: true });
  const file = project.createSourceFile(filename, source);
  let patched = false;

  const elements = [
    ...file.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
    ...file.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
  ] as JsxElement[];

  for (const el of elements) {
    const name = el.getTagNameNode().getText();
    if (name !== "img" && name !== "Image") continue;

    const hasAlt = el.getAttributes().some(
      (a) => a.getKind() === SyntaxKind.JsxAttribute && a.getText().startsWith("alt")
    );
    if (!hasAlt) {
      el.addAttribute({ name: "alt", initializer: '""' });
      patched = true;
    }
  }

  return {
    patched: file.getFullText(),
    explanation: patched
      ? 'Added alt="" to img elements missing an alt attribute. Replace the empty string with descriptive text, or keep alt="" for purely decorative images.'
      : "No img elements found missing alt attributes.",
    wcag: "WCAG 1.1.1 Non-text Content (Level A)",
    changed: patched,
  };
}

function strategyButtonName(source: string, filename: string): Omit<PatchResult, "violation_id" | "original"> {
  const project = new Project({ useInMemoryFileSystem: true });
  const file = project.createSourceFile(filename, source);
  let patched = false;

  const elements = [
    ...file.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
    ...file.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
  ] as JsxElement[];

  for (const el of elements) {
    const name = el.getTagNameNode().getText();
    if (name !== "button" && name !== "Button") continue;

    const hasExplicitLabel = el.getAttributes().some((a) => {
      const text = a.getText();
      return text.startsWith("aria-label") || text.startsWith("aria-labelledby") || text.startsWith("title");
    });

    const isSelfClosing = el.getKind() === SyntaxKind.JsxSelfClosingElement;
    const lacksTextContent = isSelfClosing || !hasTextContent(el as JsxOpeningElement);

    if (!hasExplicitLabel && lacksTextContent) {
      el.addAttribute({ name: "aria-label", initializer: '"Describe this button action"' });
      patched = true;
    }
  }

  return {
    patched: file.getFullText(),
    explanation: patched
      ? "Added aria-label to button elements that have no accessible name (no text content, no existing aria-label). Replace the placeholder with a concise description of the action."
      : "No nameless button elements found.",
    wcag: "WCAG 4.1.2 Name, Role, Value (Level A)",
    changed: patched,
  };
}

function strategyLinkName(source: string, filename: string): Omit<PatchResult, "violation_id" | "original"> {
  const project = new Project({ useInMemoryFileSystem: true });
  const file = project.createSourceFile(filename, source);
  let patched = false;

  const elements = [
    ...file.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
    ...file.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
  ] as JsxElement[];

  for (const el of elements) {
    const name = el.getTagNameNode().getText();
    if (name !== "a" && name !== "Link") continue;

    const hasExplicitLabel = el.getAttributes().some((a) => {
      const text = a.getText();
      return text.startsWith("aria-label") || text.startsWith("aria-labelledby") || text.startsWith("title");
    });

    const isSelfClosing = el.getKind() === SyntaxKind.JsxSelfClosingElement;
    const lacksTextContent = isSelfClosing || !hasTextContent(el as JsxOpeningElement);

    if (!hasExplicitLabel && lacksTextContent) {
      el.addAttribute({ name: "aria-label", initializer: '"Describe this link destination"' });
      patched = true;
    }
  }

  return {
    patched: file.getFullText(),
    explanation: patched
      ? "Added aria-label to empty anchor elements. Replace the placeholder with a description of the destination. Links with visible text content were left unchanged."
      : "No nameless link elements found.",
    wcag: "WCAG 2.4.4 Link Purpose (Level A)",
    changed: patched,
  };
}

function strategyInputLabel(source: string, _filename: string): Omit<PatchResult, "violation_id" | "original"> {
  const lines = source.split("\n");
  let patched = false;
  const patchedLines = lines.map((line) => {
    if (/<input(?![^>]*\bid\b)/i.test(line) && !line.includes("//")) {
      patched = true;
      return line + ' {/* a11y-agent: add id and associate a <label htmlFor="..."> */}';
    }
    return line;
  });

  return {
    patched: patchedLines.join("\n"),
    explanation: patched
      ? 'Annotated input elements missing an id. Each input needs a unique id and a matching <label htmlFor={id}>, or use aria-labelledby to point at a visible label element.'
      : "No unlabelled input elements detected via static analysis.",
    wcag: "WCAG 1.3.1 Info and Relationships (Level A), WCAG 4.1.2 Name, Role, Value (Level A)",
    changed: patched,
  };
}

function strategyAriaLabel(source: string, _filename: string): Omit<PatchResult, "violation_id" | "original"> {
  const lines = source.split("\n");
  let patched = false;
  const patchedLines = lines.map((line) => {
    if (line.includes("onClick") && !line.includes("aria-label") && !line.includes("//")) {
      patched = true;
      return line.trimEnd() + " {/* a11y-agent: add aria-label or aria-labelledby */}";
    }
    return line;
  });

  return {
    patched: patchedLines.join("\n"),
    explanation: patched
      ? "Annotated interactive elements with onClick handlers that may lack accessible names. Add aria-label with a descriptive string, or ensure visible text content provides the label."
      : "No unlabelled interactive elements detected via static analysis.",
    wcag: "WCAG 4.1.2 Name, Role, Value (Level A)",
    changed: patched,
  };
}

function strategyHtmlLang(source: string, _filename: string): Omit<PatchResult, "violation_id" | "original"> {
  // Works on HTML files — adds lang="en" to <html> tags missing a lang attribute
  const patched = /<html(?![^>]*\blang\b)/i.test(source);
  const fixed = source.replace(/<html(?![^>]*\blang\b)/i, '<html lang="en"');

  return {
    patched: fixed,
    explanation: patched
      ? 'Added lang="en" to the <html> element. Update the value if the page is not in English (e.g. lang="fr", lang="ar").'
      : "No <html> element found missing a lang attribute.",
    wcag: "WCAG 3.1.1 Language of Page (Level A)",
    changed: patched,
  };
}

function strategyColorContrast(source: string, _filename: string): Omit<PatchResult, "violation_id" | "original"> {
  return {
    patched: source,
    explanation:
      "Colour contrast cannot be auto-patched without design token context. Normal text requires a 4.5:1 ratio; large text requires 3:1 (WCAG AA). Use the WebAIM Contrast Checker at https://webaim.org/resources/contrastchecker/ to identify and correct failing colours.",
    wcag: "WCAG 1.4.3 Contrast Minimum (Level AA)",
    changed: false,
  };
}

function strategyHeadingOrder(source: string, _filename: string): Omit<PatchResult, "violation_id" | "original"> {
  return {
    patched: source,
    explanation:
      "Heading order violations require understanding the full page structure. Headings must descend sequentially (h1, h2, h3...) without skipping levels. Review the heading hierarchy and restructure accordingly.",
    wcag: "WCAG 1.3.1 Info and Relationships (Level A)",
    changed: false,
  };
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const PATCH_REGISTRY: Record<string, PatchStrategy> = {
  "image-alt": strategyImageAlt,
  "button-name": strategyButtonName,
  "link-name": strategyLinkName,
  "label": strategyInputLabel,
  "aria-label": strategyAriaLabel,
  "html-has-lang": strategyHtmlLang,
  "color-contrast": strategyColorContrast,
  "heading-order": strategyHeadingOrder,
};

export const AUTO_FIXABLE = new Set([
  "image-alt",
  "button-name",
  "link-name",
  "label",
  "aria-label",
  "html-has-lang",
]);

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Patch a single violation on a source string. Does not touch disk.
 * filename is used only for ts-morph's in-memory filesystem (extension matters).
 */
export function patchSource(
  source: string,
  filename: string,
  violationId: string
): PatchResult {
  const strategy = PATCH_REGISTRY[violationId];
  if (!strategy) {
    return {
      violation_id: violationId,
      original: source,
      patched: source,
      explanation: `No automatic patch available for "${violationId}". Manual remediation required. See: https://dequeuniversity.com/rules/axe/4.10/${violationId}`,
      wcag: "",
      changed: false,
    };
  }

  const result = strategy(source, filename);
  return { violation_id: violationId, original: source, ...result };
}

/**
 * Apply multiple patches sequentially on the same source.
 * Each patch receives the output of the previous one, so all violations are
 * fixed in a single pass without re-reading from disk.
 */
export function patchAll(
  source: string,
  filename: string,
  violationIds: string[]
): { finalSource: string; results: PatchResult[] } {
  let current = source;
  const results: PatchResult[] = [];

  for (const id of violationIds) {
    const result = patchSource(current, filename, id);
    results.push(result);
    if (result.changed) {
      current = result.patched;
    }
  }

  return { finalSource: current, results };
}

/**
 * Read a file from disk and patch a single violation. Convenience wrapper.
 */
export function patch(filePath: string, violationId: string): PatchResult {
  const source = readFileSync(filePath, "utf-8");
  const filename = filePath.replace(/.*\//, "");
  return patchSource(source, filename, violationId);
}
