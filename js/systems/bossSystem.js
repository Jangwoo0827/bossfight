/* Boss factory: data + behaviour class -> instance. */
(function () {
  'use strict';

  BR.BossSystem = {
    create(id, game, run) {
      const def = BR.BOSS_BY_ID[id];
      const Cls = BR.BossClasses[id];
      if (!def || !Cls) throw new Error(`Unknown boss: ${id}`);
      return new Cls(game, def, { hpMult: run ? run.hpMultiplierFor(id) : 1, damageMult: run ? run.damageMultiplier() : 1 });
    },
  };
})();
