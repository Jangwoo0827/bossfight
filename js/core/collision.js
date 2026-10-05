/* Geometry, collision and random helpers. Pure functions, no state. */
(function () {
  'use strict';
  const TAU = Math.PI * 2;

  const Geo = {
    TAU,
    clamp: (v, min, max) => (v < min ? min : v > max ? max : v),
    lerp: (a, b, t) => a + (b - a) * t,
    easeOut: (t) => 1 - (1 - t) * (1 - t),
    easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
    angle: (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax),
    angleDiff(a, b) {
      return ((((b - a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
    },
    rotateToward(current, target, maxStep) {
      const d = Geo.angleDiff(current, target);
      return current + Geo.clamp(d, -maxStep, maxStep);
    },
    rand: (a, b) => a + Math.random() * (b - a),
    randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    chance: (p) => Math.random() < p,

    circlesOverlap(ax, ay, ar, bx, by, br) {
      const dx = bx - ax, dy = by - ay, r = ar + br;
      return dx * dx + dy * dy <= r * r;
    },

    // Is a circle (px,py,pad) inside the cone centered at cx,cy?
    inCone(px, py, cx, cy, angle, arc, radius, pad = 0) {
      const d = Geo.dist(cx, cy, px, py);
      if (d > radius + pad) return false;
      if (d <= pad) return true;
      const extra = Math.asin(Geo.clamp(pad / d, 0, 1));
      return Math.abs(Geo.angleDiff(angle, Geo.angle(cx, cy, px, py))) <= arc / 2 + extra;
    },

    segDist(px, py, ax, ay, bx, by) {
      const dx = bx - ax, dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      let t = lenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0;
      t = Geo.clamp(t, 0, 1);
      return Geo.dist(px, py, ax + dx * t, ay + dy * t);
    },

    // Distance from (x,y) along angle until the arena wall (minus margin)
    rayToArena(x, y, a, margin = 0) {
      const A = BR.CONFIG.ARENA;
      const c = Math.cos(a), s = Math.sin(a);
      let t = Infinity;
      if (c > 1e-6) t = Math.min(t, (A.right - margin - x) / c);
      else if (c < -1e-6) t = Math.min(t, (A.left + margin - x) / c);
      if (s > 1e-6) t = Math.min(t, (A.bottom - margin - y) / s);
      else if (s < -1e-6) t = Math.min(t, (A.top + margin - y) / s);
      return Math.max(0, t);
    },

    clampToArena(x, y, margin = 0) {
      const A = BR.CONFIG.ARENA;
      return {
        x: Geo.clamp(x, A.left + margin, A.right - margin),
        y: Geo.clamp(y, A.top + margin, A.bottom - margin),
      };
    },

    // In-place removal of objects flagged dead (no new allocations)
    compact(list) {
      let j = 0;
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (item && !item.dead) list[j++] = item;
      }
      list.length = j;
    },
  };

  BR.Geo = Geo;
})();
