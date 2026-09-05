import { describe, expect, it } from 'vitest';
import { resolveAgentColor } from './agent-color';

describe('resolveAgentColor', () => {
  it('keeps a configured named or hex color', () => {
    expect(resolveAgentColor('statusline-setup', 'orange')).toEqual({
      color: '#f0883e',
      name: 'orange',
      automatic: false,
    });
    expect(resolveAgentColor('custom', '#12ABef')).toEqual({
      color: '#12abef',
      automatic: false,
    });
  });

  it('assigns a stable fallback when the color is absent or inherited', () => {
    const first = resolveAgentColor('review-agent');
    expect(resolveAgentColor('review-agent', 'inherit')).toEqual(first);
    expect(resolveAgentColor('review-agent', 'auto')).toEqual(first);
    expect(first.automatic).toBe(true);
  });
});
