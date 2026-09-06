// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebShellPortalRootContext } from '../../portalRoot';
import { HomeProductSwitcher } from './HomeProductSwitcher';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | undefined;
let container: HTMLDivElement | undefined;
let portalRoot: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  portalRoot?.remove();
  root = undefined;
  container = undefined;
  portalRoot = undefined;
});

async function renderSwitcher(product: 'homecode' | 'homechat') {
  const onProductChange = vi.fn();
  container = document.createElement('div');
  portalRoot = document.createElement('div');
  document.body.append(container, portalRoot);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <WebShellPortalRootContext.Provider value={portalRoot!}>
        <HomeProductSwitcher
          product={product}
          onProductChange={onProductChange}
        />
      </WebShellPortalRootContext.Provider>,
    );
  });
  return onProductChange;
}

describe('HomeProductSwitcher', () => {
  it('presents the two HomeCode surfaces as Harness and Chat modes', async () => {
    const onProductChange = await renderSwitcher('homecode');
    const trigger = container!.querySelector('button')!;

    expect(trigger.textContent).toContain('Harness');
    expect(trigger.getAttribute('aria-label')).toBe('Режим: Harness');

    await act(async () => {
      trigger.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, button: 0 }),
      );
      trigger.dispatchEvent(
        new MouseEvent('click', { bubbles: true, button: 0 }),
      );
    });

    const items = portalRoot!.querySelectorAll<HTMLElement>(
      '[data-slot="dropdown-menu-item"]',
    );
    expect(
      [...items].map((item) => item.querySelector('strong')?.textContent),
    ).toEqual(['Harness', 'Chat']);
    expect(
      [...items].map((item) => item.querySelector('small')?.textContent),
    ).toEqual(['Агентная разработка', 'Исследование']);

    await act(async () => {
      items[1].dispatchEvent(
        new MouseEvent('click', { bubbles: true, button: 0 }),
      );
    });
    expect(onProductChange).toHaveBeenCalledWith('homechat');
  });
});
