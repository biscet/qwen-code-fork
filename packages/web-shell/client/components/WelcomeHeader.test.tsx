import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WelcomeHeader } from './WelcomeHeader';

describe('WelcomeHeader', () => {
  it('renders the HomeCode wordmark without the legacy product mark', () => {
    const html = renderToStaticMarkup(
      <WelcomeHeader
        version="1.0.0"
        cwd="/workspace"
        currentModel="model"
        currentMode="default"
      />,
    );

    expect(html).toContain('aria-label="HomeCode"');
    expect(html).toContain('data-homecode-wordmark');
    expect(html).not.toContain('Qwen Code');
    expect(html).not.toContain('data-homecode-mark');
  });
});
