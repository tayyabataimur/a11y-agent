/**
 * Framework-aware patchers. Wire into the main PATCH_REGISTRY dispatch in
 * src/lib/patcher.ts by detecting the framework via filename and routing to
 * the corresponding patcher map.
 *
 * Example wiring:
 *   if (isVueFile(filename) && rule in VUE_PATCHERS) {
 *     return VUE_PATCHERS[rule](source);
 *   }
 *   if (isSvelteFile(filename) && rule in SVELTE_PATCHERS) {
 *     return SVELTE_PATCHERS[rule](source);
 *   }
 */

export { VUE_PATCHERS, isVueFile, patchVueImageAlt, patchVueButtonName, patchVueLinkName } from "./vue.js";
export { SVELTE_PATCHERS, isSvelteFile, patchSvelteImageAlt, patchSvelteButtonName, patchSvelteLinkName } from "./svelte.js";

import { VUE_PATCHERS, isVueFile } from "./vue.js";
import { SVELTE_PATCHERS, isSvelteFile } from "./svelte.js";
import type { PatchResult } from "../patcher.js";

type Patch = Omit<PatchResult, "violation_id" | "original">;

export function tryFrameworkPatch(rule: string, source: string, filename: string): Patch | null {
  if (isVueFile(filename) && rule in VUE_PATCHERS) {
    return VUE_PATCHERS[rule as keyof typeof VUE_PATCHERS](source);
  }
  if (isSvelteFile(filename) && rule in SVELTE_PATCHERS) {
    return SVELTE_PATCHERS[rule as keyof typeof SVELTE_PATCHERS](source);
  }
  return null;
}
