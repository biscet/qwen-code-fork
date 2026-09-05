/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ServeModelProviderReplacement {
  previous: { authType: string; modelId: string; baseUrl?: string };
  next: { authType: string; modelId: string; baseUrl?: string };
}
