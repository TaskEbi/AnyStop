/** Tiny colour maths for canvas drawing (CSS color-mix can't be handed to a 2D context everywhere). */

export type RGB = [number, number, number];

export function parseColor(css: string): RGB {
  const s = css.trim();
  if (s.startsWith('#')) {
    const h = s.slice(1);
    const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h.slice(0, 6);
    const n = parseInt(full, 16);
    return Number.isNaN(n) ? [128, 128, 128] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/);
  return m ? [+m[1], +m[2], +m[3]] : [128, 128, 128];
}

/** `t` of the way from a to b. */
export function mix(a: string, b: string, t: number): string {
  const x = parseColor(a);
  const y = parseColor(b);
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * t));
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
}

export function alpha(css: string, a: number): string {
  const [r, g, b] = parseColor(css);
  return `rgb(${r} ${g} ${b} / ${a})`;
}
