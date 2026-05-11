import type { Violation } from "../lib/axe-runner.js";

export type Grade = "A" | "B" | "C" | "D" | "F";
export type WcagLevel = "AAA" | "AA" | "A" | "Partial A" | "Non-compliant";

export interface IssueSuggestion {
  rank: number;
  violation_id: string;
  impact: Violation["impact"];
  wcag_criterion: string;
  affected_elements: number;
  headline: string;
  user_impact: string;
  suggestion: string;
  example_before: string;
  example_after: string;
  auto_fixable: boolean;
  learn_more: string;
}

export interface EvaluateSummary {
  total_checks: number;
  passed: number;
  violations: number;
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
  auto_fixable_count: number;
  incomplete: number;
}

export interface EvaluateResult {
  url: string;
  timestamp: string;
  score: number;
  grade: Grade;
  wcag_level: WcagLevel;
  summary: EvaluateSummary;
  top_issues: IssueSuggestion[];
  quick_wins: IssueSuggestion[];
  passing_checks?: string[];
  ai_summary: string;
}

import type { AuthConfig } from "./auth.js";

export interface EvaluateOptions {
  url: string;
  include_passing?: boolean;
  include_html_snippets?: boolean;
  auth?: AuthConfig;
}
