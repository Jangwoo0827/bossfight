/* Rolls upgrade choices. Repeats become rarer; maxed upgrades never appear. */
(function () {
  'use strict';

  const REPEAT_FALLOFF = 0.45;

  BR.RewardSystem = {
    roll(count, taken, rng = Math.random) {
      const pool = BR.UPGRADES
        .filter((u) => (taken[u.id] || 0) < (u.maxStacks || 99))
        .map((u) => ({
          upgrade: u,
          weight: (BR.RARITY_WEIGHTS[u.rarity] || 1) * Math.pow(REPEAT_FALLOFF, taken[u.id] || 0),
        }));

      const result = [];
      const usedCategories = new Map();
      while (result.length < count && pool.length) {
        // Soft rule: avoid offering three cards of the same category
        let total = 0;
        for (const entry of pool) {
          const sameCat = usedCategories.get(entry.upgrade.category) || 0;
          entry.effective = entry.weight * (sameCat >= 2 ? 0.1 : sameCat === 1 ? 0.6 : 1);
          total += entry.effective;
        }
        let roll = rng() * total;
        let index = pool.length - 1;
        for (let i = 0; i < pool.length; i++) {
          roll -= pool[i].effective;
          if (roll <= 0) { index = i; break; }
        }
        const chosen = pool.splice(index, 1)[0].upgrade;
        usedCategories.set(chosen.category, (usedCategories.get(chosen.category) || 0) + 1);
        result.push(chosen);
      }
      return result;
    },
  };
})();
