/**
 * Vue Single-File Component (.vue) accessibility patcher.
 *
 * Extracts the <template> block, applies HTML-style transforms that respect
 * Vue binding syntax (`:alt`, `v-bind:alt`, `:aria-label`), and splices the
 * patched template back into the SFC. <script> and <style> blocks are
 * untouched.
 */

import type { PatchResult } from "../patcher.js";

type Patch = Omit<PatchResult, "violation_id" | "original">;

const TEMPLATE_RE = /(<template[^>]*>)([\s\S]*?)(<\/template>)/i;

function withTemplate(source: string, transform: (tmpl: string) => { tmpl: string; changed: boolean; explanation: string; wcag: string }): Patch {
  const m = source.match(TEMPLATE_RE);
  if (!m) {
    return {
      patched: source,
      changed: false,
      explanation: "No <template> block found in Vue SFC. Patcher only modifies template markup.",
      wcag: "n/a",
    };
  }
  const inner = m[2];
  const { tmpl, changed, explanation, wcag } = transform(inner);
  if (!changed) return { patched: source, changed: false, explanation, wcag };
  const patched = source.replace(TEMPLATE_RE, `${m[1]}${tmpl}${m[3]}`);
  return { patched, changed: true, explanation, wcag };
}

function hasAttr(tag: string, attr: string): boolean {
  // matches `attr=`, `:attr=`, `v-bind:attr=`
  const re = new RegExp(`(?:\\s|^)(?::|v-bind:)?${attr}(?:\\s|=|/?>|$)`, "i");
  return re.test(tag);
}

export function patchVueImageAlt(source: string): Patch {
  return withTemplate(source, (tmpl) => {
    let changed = false;
    const out = tmpl.replace(/<img\b([^>]*?)(\/?)>/gi, (full, attrs: string, slash: string) => {
      if (hasAttr(attrs, "alt")) return full;
      changed = true;
      return `<img${attrs} alt=""${slash ? " /" : ""}>`;
    });
    return {
      tmpl: out,
      changed,
      explanation: changed
        ? 'Added alt="" to <img> elements in the Vue template. Replace with descriptive text, or keep empty for decorative images.'
        : "No <img> elements missing an alt attribute (or :alt binding) found.",
      wcag: "1.1.1",
    };
  });
}

export function patchVueButtonName(source: string): Patch {
  return withTemplate(source, (tmpl) => {
    let changed = false;
    const out = tmpl.replace(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi, (full, attrs: string, inner: string) => {
      if (hasAttr(attrs, "aria-label") || hasAttr(attrs, "aria-labelledby") || inner.replace(/<[^>]*>/g, "").trim().length > 0) {
        return full;
      }
      changed = true;
      return `<button${attrs} aria-label="TODO: describe action">${inner}</button>`;
    });
    return {
      tmpl: out,
      changed,
      explanation: changed
        ? "Added aria-label placeholder to nameless <button> elements. Replace TODO with the real action label."
        : "No nameless <button> elements found.",
      wcag: "4.1.2",
    };
  });
}

export function patchVueLinkName(source: string): Patch {
  return withTemplate(source, (tmpl) => {
    let changed = false;
    const out = tmpl.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (full, attrs: string, inner: string) => {
      if (hasAttr(attrs, "aria-label") || hasAttr(attrs, "aria-labelledby") || inner.replace(/<[^>]*>/g, "").trim().length > 0) {
        return full;
      }
      changed = true;
      return `<a${attrs} aria-label="TODO: describe destination">${inner}</a>`;
    });
    return {
      tmpl: out,
      changed,
      explanation: changed
        ? "Added aria-label placeholder to nameless <a> elements. Replace TODO with the destination."
        : "No nameless <a> elements found.",
      wcag: "2.4.4",
    };
  });
}

export const VUE_PATCHERS = {
  "image-alt": patchVueImageAlt,
  "button-name": patchVueButtonName,
  "link-name": patchVueLinkName,
} as const;

export function isVueFile(filename: string): boolean {
  return /\.vue$/i.test(filename);
}
