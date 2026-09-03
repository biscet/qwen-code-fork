import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HomeCodeLoader, HomeCodeMark, HomeCodeSpinner } from './HomeCodeBrand';

describe('HomeCode branding primitives', () => {
  it('renders the product mark and animated loader from the same geometry', () => {
    const mark = renderToStaticMarkup(<HomeCodeMark aria-label="Qwen Code" />);
    const loader = renderToStaticMarkup(
      <HomeCodeLoader aria-label="Loading Qwen Code" />,
    );

    expect(mark).toContain('data-homecode-mark');
    expect(loader).toContain('data-homecode-loader');
    expect(mark).toContain('M56.6 24.7H27.1');
    expect(loader).toContain('M56.6 24.7H27.1');
  });

  it('renders the HomeCode 4x4 spinner without corner cells', () => {
    const spinner = renderToStaticMarkup(
      <HomeCodeSpinner role="status" aria-label="Loading" />,
    );

    expect(spinner).toContain('data-homecode-spinner');
    expect(spinner.match(/<rect/g)).toHaveLength(12);
  });
});
