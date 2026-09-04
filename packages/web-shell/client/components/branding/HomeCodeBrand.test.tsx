import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  HomeCodeLoader,
  HomeCodeMark,
  HomeCodeSpinner,
  HomeCodeWordmark,
} from './HomeCodeBrand';

describe('HomeCode branding primitives', () => {
  it('renders the product mark and animated loader from the same geometry', () => {
    const mark = renderToStaticMarkup(<HomeCodeMark aria-label="HomeCode" />);
    const loader = renderToStaticMarkup(
      <HomeCodeLoader aria-label="Loading HomeCode" />,
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

  it('renders the HomeCode name as a crisp modular wordmark', () => {
    const wordmark = renderToStaticMarkup(
      <HomeCodeWordmark role="img" aria-label="HomeCode" />,
    );

    expect(wordmark).toContain('data-homecode-wordmark');
    expect(wordmark).toContain('shape-rendering="crispEdges"');
    expect(wordmark).toContain('aria-label="HomeCode"');
    expect(wordmark).not.toContain('Qwen Code');
  });
});
