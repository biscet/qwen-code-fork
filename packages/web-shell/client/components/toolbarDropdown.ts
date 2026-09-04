export interface ToolbarDropdownItem {
  id: string;
  label: string;
  searchText?: string;
}

const TOOLBAR_LABEL_EXPANSION_HYSTERESIS_PX = 32;

export function filterToolbarDropdownItems<T extends ToolbarDropdownItem>(
  items: readonly T[],
  query: string,
): T[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [...items];
  return items.filter((item) =>
    `${item.label}\n${item.searchText ?? ''}`
      .toLocaleLowerCase()
      .includes(normalized),
  );
}

export function getToolbarItemVisibility({
  availableWidth,
  items,
}: {
  availableWidth: number;
  items: ReadonlyArray<{
    id: string;
    expansionWidth: number;
    ready?: boolean;
  }>;
}): Record<string, boolean> {
  const visibility = Object.fromEntries(
    items.map((item) => [item.id, item.ready !== false]),
  );
  let usedWidth = items.reduce(
    (total, item) => total + (visibility[item.id] ? item.expansionWidth : 0),
    0,
  );

  for (const item of items) {
    if (usedWidth <= availableWidth) break;
    if (!visibility[item.id]) continue;
    visibility[item.id] = false;
    usedWidth -= item.expansionWidth;
  }

  return visibility;
}

export function getToolbarItemVisibilityWithHysteresis({
  availableWidth,
  items,
  currentVisibility,
}: {
  availableWidth: number;
  items: ReadonlyArray<{
    id: string;
    expansionWidth: number;
    ready?: boolean;
  }>;
  currentVisibility: Readonly<Record<string, boolean>>;
}): Record<string, boolean> {
  const collapseVisibility = getToolbarItemVisibility({
    availableWidth,
    items,
  });
  const expansionVisibility = getToolbarItemVisibility({
    // Keep one compact control of slack before restoring labels. Actual and
    // offscreen measurement widths can differ enough to otherwise alternate
    // on consecutive ResizeObserver deliveries.
    availableWidth: Math.max(
      0,
      availableWidth - TOOLBAR_LABEL_EXPANSION_HYSTERESIS_PX,
    ),
    items,
  });

  return Object.fromEntries(
    items.map((item) => [
      item.id,
      currentVisibility[item.id]
        ? collapseVisibility[item.id]
        : expansionVisibility[item.id],
    ]),
  );
}

export function getToolbarExpansionBudget({
  toolbarWidth,
  leadingWidth,
  rightWidth,
  currentExpansionWidth,
  gap,
}: {
  toolbarWidth: number;
  leadingWidth: number;
  rightWidth: number;
  currentExpansionWidth: number;
  gap: number;
}): number {
  const fixedWidth = Math.max(
    0,
    leadingWidth + rightWidth - currentExpansionWidth,
  );
  return Math.max(0, toolbarWidth - fixedWidth - gap);
}

export function resolveToolbarModelLabel({
  currentModelLabel,
  lastConfirmedModelLabel,
}: {
  currentModelLabel: string;
  lastConfirmedModelLabel: string;
}): {
  modelLabel: string;
  modelLabelReady: boolean;
  nextConfirmedModelLabel: string;
} {
  const nextConfirmedModelLabel = currentModelLabel || lastConfirmedModelLabel;
  return {
    modelLabel: nextConfirmedModelLabel,
    modelLabelReady: Boolean(nextConfirmedModelLabel),
    nextConfirmedModelLabel,
  };
}
