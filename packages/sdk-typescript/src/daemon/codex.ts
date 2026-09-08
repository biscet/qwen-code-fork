/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CodexModel {
  id: string;
  model: string;
  displayName: string;
  description: string;
  hidden: boolean;
  supportedReasoningEfforts: Array<{
    reasoningEffort: string;
    description: string;
  }>;
  defaultReasoningEffort: string;
  inputModalities: string[];
  isDefault: boolean;
}

export interface CodexRateLimitWindow {
  usedPercent: number | null;
  windowDurationMins: number | null;
  resetsAt: number | null;
}

export interface CodexRateLimitSnapshot {
  limitId: string | null;
  limitName: string | null;
  primary: CodexRateLimitWindow | null;
  secondary: CodexRateLimitWindow | null;
  credits?: {
    hasCredits: boolean;
    unlimited: boolean;
    balance: string | null;
  } | null;
  individualLimit?: {
    limit: string;
    used: string;
    remainingPercent: number;
    resetsAt: number;
  } | null;
  spendControlReached?: boolean | null;
  planType?: string | null;
  rateLimitReachedType?: string | null;
}

export interface CodexRateLimits {
  rateLimits: CodexRateLimitSnapshot;
  rateLimitsByLimitId: Record<string, CodexRateLimitSnapshot> | null;
  rateLimitResetCredits?: {
    availableCount: number;
    credits: Array<{
      id: string;
      resetType: string;
      status: string;
      grantedAt: number;
      expiresAt: number | null;
      title: string | null;
      description: string | null;
    }> | null;
  } | null;
}

export interface CodexAccountState {
  connected: boolean;
  account: {
    type: 'chatgpt';
    email: string | null;
    planType: string;
  } | null;
  login: { loginId: string; authUrl: string } | null;
  models: CodexModel[];
  limits: CodexRateLimits | null;
  error: string | null;
  updatedAt: number | null;
}

export interface CodexResetLimitsResult {
  outcome: 'reset' | 'nothingToReset' | 'noCredit' | 'alreadyRedeemed';
  state: CodexAccountState;
}
