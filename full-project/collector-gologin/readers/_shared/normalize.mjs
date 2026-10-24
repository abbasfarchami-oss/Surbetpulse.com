// Tiny shared line normaliser (quarter lines).
export const normLine = (x) => { const v = Math.round((+x || 0) * 4) / 4; return Object.is(v, -0) ? 0 : v; };
