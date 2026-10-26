type AnchorRect = { top: number; bottom: number; right: number };

export function positionFloatingMenu(anchor: AnchorRect, menuHeight: number, viewportWidth: number, viewportHeight: number) {
  const margin = 8;
  const gap = 6;
  const width = Math.min(192, Math.max(0, viewportWidth - margin * 2));
  const below = Math.max(0, viewportHeight - margin - anchor.bottom - gap);
  const above = Math.max(0, anchor.top - gap - margin);
  const opensBelow = menuHeight <= below || below >= above;
  const maxHeight = Math.min(opensBelow ? below : above, Math.max(0, viewportHeight - margin * 2));
  const height = Math.min(menuHeight, maxHeight);
  const top = opensBelow ? anchor.bottom + gap : anchor.top - gap - height;
  return {
    width,
    maxHeight,
    left: Math.max(margin, Math.min(anchor.right - width, viewportWidth - width - margin)),
    top: Math.max(margin, Math.min(top, viewportHeight - height - margin)),
  };
}
