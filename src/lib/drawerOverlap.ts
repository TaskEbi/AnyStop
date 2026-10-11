/** How far (px) the side drawer will cover this element from the right, halved: the shift that centres a target in what's left. */
export function drawerShift(el: HTMLElement | null): number {
  if (!el || window.innerWidth <= 640) return 0;
  const drawerLeft = window.innerWidth - Math.min(480, window.innerWidth);
  return Math.max(0, el.getBoundingClientRect().right - drawerLeft) / 2;
}
