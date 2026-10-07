/* Boss factory: data + behaviour class -> instance. */
(function () {
  'use strict';

  BR.BossSystem = {
    // forceElite: restore a saved fight exactly (undefined = roll)
    create(id, game, run, forceElite) {
      const def = BR.BOSS_BY_ID[id];
      const Cls = BR.BossClasses[id];
      if (!def || !Cls) throw new Error(`Unknown boss: ${id}`);
      const R = BR.CONFIG.RUN;
      let elite = false;
      if (run && run.mode === 'run' && id !== R.firstBoss && id !== R.finalBoss) {
        const roll = run.rng();
        elite = forceElite !== undefined && forceElite !== null ? !!forceElite : roll < run.eliteChance;
      }
      const E = R.elite;
      const boss = new Cls(game, def, {
        hpMult: (run ? run.hpMultiplierFor(id) : 1) * (elite ? E.hp : 1),
        damageMult: (run ? run.damageMultiplier() : 1) * (elite ? E.dmg : 1) * (def.dmg || 1),
      });
      if (elite) {
        boss.elite = true;
        boss.name = `ELITE ${boss.name}`;
        boss.tempoByPhase = boss.tempoByPhase.map((t) => t * E.tempo);
        boss.tempo = boss.tempoByPhase[0];
      }
      return boss;
    },
  };
})();
