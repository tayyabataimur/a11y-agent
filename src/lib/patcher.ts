import { Project, SyntaxKind, type JsxOpeningElement, type JsxSelfClosingElement } from "ts-morph";
import { readFileSync } from "fs";

export interface PatchResult {
  violation_id: string;
  original: string;
  patched: string;
  explanation: string;
  wcag: string;
  changed: boolean;
}

export type AutofixSafety = "safe-autofix" | "guided-fix" | "manual-only";

export interface AutofixMeta {
  id: string;
  title: string;
  category: string;
  safety: AutofixSafety;
  frameworks: string[];
  wcag: string;
  explanation: string;
}

type PatchStrategy = (source: string, filename: string) => Omit<PatchResult, "violation_id" | "original">;

type StrategyEntry = {
  meta: AutofixMeta;
  strategy: PatchStrategy;
};

type JsxElement = JsxOpeningElement | JsxSelfClosingElement;

function isHtmlLike(filename: string, source: string): boolean {
  return /\.(html?|vue|svelte|astro)$/i.test(filename) || /^\s*<!doctype html|^\s*<html[\s>]/i.test(source);
}

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

function strategyImageAltJsx(source: string, filename: string): Omit<PatchResult, "violation_id" | "original"> {
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

function strategyImageAltHtml(source: string): Omit<PatchResult, "violation_id" | "original"> {
  let patched = false;
  const fixed = source.replace(/<img\b(?![^>]*\balt\s*=)([^>]*?)(\/?)>/gi, (_match, attrs, selfClosing) => {
    patched = true;
    return `<img${attrs} alt=""${selfClosing}>`;
  });

  return {
    patched: fixed,
    explanation: patched
      ? 'Added alt="" to HTML img elements missing an alt attribute. Replace the empty string with descriptive text, or keep alt="" for purely decorative images.'
      : "No HTML img elements found missing alt attributes.",
    wcag: "WCAG 1.1.1 Non-text Content (Level A)",
    changed: patched,
  };
}

function strategyImageAlt(source: string, filename: string): Omit<PatchResult, "violation_id" | "original"> {
  return isHtmlLike(filename, source) ? strategyImageAltHtml(source) : strategyImageAltJsx(source, filename);
}

function strategyButtonNameJsx(source: string, filename: string): Omit<PatchResult, "violation_id" | "original"> {
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

function strategyButtonNameHtml(source: string): Omit<PatchResult, "violation_id" | "original"> {
  let patched = false;
  const fixed = source.replace(
    /<button\b(?![^>]*\b(?:aria-label|aria-labelledby|title)\s*=)([^>]*)>([\s\S]*?)<\/button>/gi,
    (match, attrs, inner) => {
      const visibleText = inner.replace(/<[^>]+>/g, " ").trim();
      if (visibleText.length > 0) return match;
      patched = true;
      return `<button${attrs} aria-label="Describe this button action">${inner}</button>`;
    }
  );

  return {
    patched: fixed,
    explanation: patched
      ? "Added aria-label to HTML button elements that did not expose an accessible name. Replace the placeholder with the real action label."
      : "No nameless HTML button elements found.",
    wcag: "WCAG 4.1.2 Name, Role, Value (Level A)",
    changed: patched,
  };
}

function strategyButtonName(source: string, filename: string): Omit<PatchResult, "violation_id" | "original"> {
  return isHtmlLike(filename, source) ? strategyButtonNameHtml(source) : strategyButtonNameJsx(source, filename);
}

function strategyLinkNameJsx(source: string, filename: string): Omit<PatchResult, "violation_id" | "original"> {
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

function strategyLinkNameHtml(source: string): Omit<PatchResult, "violation_id" | "original"> {
  let patched = false;
  const fixed = source.replace(
    /<a\b(?![^>]*\b(?:aria-label|aria-labelledby|title)\s*=)([^>]*)>([\s\S]*?)<\/a>/gi,
    (match, attrs, inner) => {
      const visibleText = inner.replace(/<[^>]+>/g, " ").trim();
      if (visibleText.length > 0) return match;
      patched = true;
      return `<a${attrs} aria-label="Describe this link destination">${inner}</a>`;
    }
  );

  return {
    patched: fixed,
    explanation: patched
      ? "Added aria-label to HTML link elements that did not expose an accessible name. Replace the placeholder with the real destination label."
      : "No nameless HTML link elements found.",
    wcag: "WCAG 2.4.4 Link Purpose (Level A)",
    changed: patched,
  };
}

function strategyLinkName(source: string, filename: string): Omit<PatchResult, "violation_id" | "original"> {
  return isHtmlLike(filename, source) ? strategyLinkNameHtml(source) : strategyLinkNameJsx(source, filename);
}

function strategyInputLabel(source: string, filename: string): Omit<PatchResult, "violation_id" | "original"> {
  const comment = isHtmlLike(filename, source)
    ? " <!-- loop11y: add id and associate a <label for=\"...\"> -->"
    : ' {/* loop11y: add id and associate a <label htmlFor="..."> */}';

  const lines = source.split("\n");
  let patched = false;
  const patchedLines = lines.map((line) => {
    if (/<input(?![^>]*\bid\b)/i.test(line) && !line.includes("loop11y:")) {
      patched = true;
      return line + comment;
    }
    return line;
  });

  return {
    patched: patchedLines.join("\n"),
    explanation: patched
      ? isHtmlLike(filename, source)
        ? 'Annotated HTML input elements missing an id. Each input needs a unique id and a matching <label for="...">, or use aria-labelledby to point at visible label text.'
        : 'Annotated input elements missing an id. Each input needs a unique id and a matching <label htmlFor={id}>, or use aria-labelledby to point at a visible label element.'
      : "No unlabelled input elements detected via static analysis.",
    wcag: "WCAG 1.3.1 Info and Relationships (Level A), WCAG 4.1.2 Name, Role, Value (Level A)",
    changed: patched,
  };
}

function strategyAriaLabel(source: string, filename: string): Omit<PatchResult, "violation_id" | "original"> {
  const comment = isHtmlLike(filename, source)
    ? " <!-- loop11y: add aria-label or aria-labelledby -->"
    : " {/* loop11y: add aria-label or aria-labelledby */}";

  const lines = source.split("\n");
  let patched = false;
  const patchedLines = lines.map((line) => {
    if (line.includes("onClick") && !line.includes("aria-label") && !line.includes("loop11y:")) {
      patched = true;
      return line.trimEnd() + comment;
    }
    return line;
  });

  return {
    patched: patchedLines.join("\n"),
    explanation: patched
      ? "Annotated interactive elements with click handlers that may lack accessible names. Add aria-label with a descriptive string, or ensure visible text content provides the label."
      : "No unlabelled interactive elements detected via static analysis.",
    wcag: "WCAG 4.1.2 Name, Role, Value (Level A)",
    changed: patched,
  };
}

function strategyHtmlLang(source: string): Omit<PatchResult, "violation_id" | "original"> {
  const changed = /<html(?![^>]*\blang\b)/i.test(source);
  const patched = source.replace(/<html(?![^>]*\blang\b)/i, '<html lang="en"');

  return {
    patched,
    explanation: changed
      ? 'Added lang="en" to the <html> element. Update the value if the page is not in English (for example lang="fr" or lang="ar").'
      : "No <html> element found missing a lang attribute.",
    wcag: "WCAG 3.1.1 Language of Page (Level A)",
    changed,
  };
}

function strategyColorContrast(source: string): Omit<PatchResult, "violation_id" | "original"> {
  return {
    patched: source,
    explanation:
      "Colour contrast cannot be auto-patched without design token context. Normal text requires a 4.5:1 ratio; large text requires 3:1 (WCAG AA). Use the WebAIM Contrast Checker at https://webaim.org/resources/contrastchecker/ to identify and correct failing colours.",
    wcag: "WCAG 1.4.3 Contrast Minimum (Level AA)",
    changed: false,
  };
}

function strategyHeadingOrder(source: string): Omit<PatchResult, "violation_id" | "original"> {
  return {
    patched: source,
    explanation:
      "Heading order violations require understanding the full page structure. Headings must descend sequentially (h1, h2, h3...) without skipping levels. Review the heading hierarchy and restructure accordingly.",
    wcag: "WCAG 1.3.1 Info and Relationships (Level A)",
    changed: false,
  };
}

export const PATCH_REGISTRY: Record<string, StrategyEntry> = {
  "image-alt": {
    meta: {
      id: "image-alt",
      title: "Missing image alt text",
      category: "non-text-content",
      safety: "safe-autofix",
      frameworks: ["html", "react", "nextjs", "vue", "svelte", "astro"],
      wcag: "WCAG 1.1.1 Non-text Content (Level A)",
      explanation: "Adds alt attributes to images missing them.",
    },
    strategy: strategyImageAlt,
  },
  "button-name": {
    meta: {
      id: "button-name",
      title: "Missing button accessible name",
      category: "accessible-name",
      safety: "safe-autofix",
      frameworks: ["html", "react", "nextjs", "vue", "svelte", "astro"],
      wcag: "WCAG 4.1.2 Name, Role, Value (Level A)",
      explanation: "Adds aria-label to buttons that appear to have no accessible name.",
    },
    strategy: strategyButtonName,
  },
  "link-name": {
    meta: {
      id: "link-name",
      title: "Missing link accessible name",
      category: "accessible-name",
      safety: "safe-autofix",
      frameworks: ["html", "react", "nextjs", "vue", "svelte", "astro"],
      wcag: "WCAG 2.4.4 Link Purpose (Level A)",
      explanation: "Adds aria-label to links that appear to have no accessible name.",
    },
    strategy: strategyLinkName,
  },
  label: {
    meta: {
      id: "label",
      title: "Missing form label",
      category: "forms",
      safety: "guided-fix",
      frameworks: ["html", "react", "nextjs"],
      wcag: "WCAG 1.3.1 / 4.1.2 (Level A)",
      explanation: "Adds guidance annotations for inputs that need explicit labels.",
    },
    strategy: strategyInputLabel,
  },
  "aria-label": {
    meta: {
      id: "aria-label",
      title: "Missing accessible name hint",
      category: "accessible-name",
      safety: "guided-fix",
      frameworks: ["html", "react", "nextjs"],
      wcag: "WCAG 4.1.2 Name, Role, Value (Level A)",
      explanation: "Adds guidance annotations where manual naming is still required.",
    },
    strategy: strategyAriaLabel,
  },
  "html-has-lang": {
    meta: {
      id: "html-has-lang",
      title: "Missing page language",
      category: "document",
      safety: "safe-autofix",
      frameworks: ["html", "react", "nextjs", "vue", "svelte", "astro"],
      wcag: "WCAG 3.1.1 Language of Page (Level A)",
      explanation: "Adds a lang attribute to the root html element when missing.",
    },
    strategy: strategyHtmlLang,
  },
  "color-contrast": {
    meta: {
      id: "color-contrast",
      title: "Insufficient color contrast",
      category: "visual-design",
      safety: "manual-only",
      frameworks: ["html", "react", "nextjs", "vue", "svelte", "astro"],
      wcag: "WCAG 1.4.3 Contrast Minimum (Level AA)",
      explanation: "Requires design-context changes and cannot be auto-fixed safely.",
    },
    strategy: strategyColorContrast,
  },
  "heading-order": {
    meta: {
      id: "heading-order",
      title: "Incorrect heading order",
      category: "document-structure",
      safety: "manual-only",
      frameworks: ["html", "react", "nextjs", "vue", "svelte", "astro"],
      wcag: "WCAG 1.3.1 Info and Relationships (Level A)",
      explanation: "Requires document-structure judgment and cannot be auto-fixed safely.",
    },
    strategy: strategyHeadingOrder,
  },
};

export const AUTO_FIXABLE = new Set(
  Object.values(PATCH_REGISTRY)
    .filter((entry) => entry.meta.safety === "safe-autofix")
    .map((entry) => entry.meta.id)
);

export const GUIDED_FIXABLE = new Set(
  Object.values(PATCH_REGISTRY)
    .filter((entry) => entry.meta.safety === "guided-fix")
    .map((entry) => entry.meta.id)
);

export function getAutofixMeta(violationId: string): AutofixMeta | undefined {
  return PATCH_REGISTRY[violationId]?.meta;
}

export function getAutofixCatalog(): AutofixMeta[] {
  return Object.values(PATCH_REGISTRY).map((entry) => entry.meta);
}

export function patchSource(
  source: string,
  filename: string,
  violationId: string
): PatchResult {
  const entry = PATCH_REGISTRY[violationId];
  if (!entry) {
    return {
      violation_id: violationId,
      original: source,
      patched: source,
      explanation: `No automatic patch available for "${violationId}". Manual remediation required. See: https://dequeuniversity.com/rules/axe/4.10/${violationId}`,
      wcag: "",
      changed: false,
    };
  }

  const result = entry.strategy(source, filename);
  return { violation_id: violationId, original: source, ...result };
}

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

export function patch(filePath: string, violationId: string): PatchResult {
  const source = readFileSync(filePath, "utf-8");
  const filename = filePath.replace(/.*\//, "");
  return patchSource(source, filename, violationId);
}
