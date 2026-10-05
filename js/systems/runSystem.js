/* State of a single RUN: boss order, upgrades taken, souls earned. Reset on death. */
(function () {
  'use strict';
  const R = BR.CONFIG.RUN;
  const S = BR.CONFIG.SOUL;

  class RunSystem {
    constructor(difficulty, character, meta) {
      this.soulMult = 1 + BR.UpgradeSystem.metaValue(meta, 'fortune');
      this.rerolls = BR.UpgradeSystem.metaValue(meta, 'reroll');
      this.difficulty = difficulty || BR.DIFFICULTY_BY_ID.normal;
      this.character = character || BR.CHARACTERS[0];
      this.stage = 0;              // bosses defeated so far
      this.bossDamageTaken = 0;    // reset each fight (flawless tracking)
      this.bossStartTime = 0;
      this.defeated = [];
      this.currentBossId = null;
      this.upgrades = {};          // id -> stacks
      this.upgradeOrder = [];
      this.soulEarned = 0;
      this.time = 0;
      this.damageDealt = 0;
      this.damageTaken = 0;
    }

    get bossNumber() { return this.stage + 1; }
    get totalBosses() { return this.difficulty.bosses; }
    get isComplete() { return this.defeated.includes(R.finalBoss); }

    firstBossId() { return R.firstBoss; }

    // Knight first, final boss last; in between, choose from up to 3 random pool bosses
    nextBossOptions() {
      if (this.stage === 0) return [R.firstBoss];
      if (this.stage >= this.totalBosses - 1) return [R.finalBoss];
      const remaining = BR.BOSS_DATA
        .map((b) => b.id)
        .filter((id) => id !== R.firstBoss && id !== R.finalBoss && !this.defeated.includes(id));
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }
      const options = remaining.slice(0, R.bossChoices);
      return options.length ? options : [R.finalBoss];
    }

    // Mid-run bosses get a little tougher the later you pick them
    hpMultiplierFor(id) {
      const d = this.difficulty.hp;
      if (id === R.firstBoss || id === R.finalBoss) return d;
      return d * (1 + R.stageHpScale * Math.max(0, this.stage - 1));
    }

    damageMultiplier() { return this.difficulty.dmg; }

    recordBossDefeat(id) {
      this.defeated.push(id);
      this.stage++;
      let soul = S.perBossBase + S.perStage * this.stage;
      if (this.isComplete) soul += S.clearBonus;
      soul = Math.round(soul * this.difficulty.soul * this.soulMult);
      this.soulEarned += soul;
      return soul;
    }

    addUpgrade(upgrade) {
      this.upgrades[upgrade.id] = (this.upgrades[upgrade.id] || 0) + 1;
      if (!this.upgradeOrder.includes(upgrade.id)) this.upgradeOrder.push(upgrade.id);
    }

    buildSummary() {
      return this.upgradeOrder.map((id) => {
        const def = BR.UPGRADES.find((u) => u.id === id);
        return { id, name: def ? def.name : id, short: def ? def.short : id, stacks: this.upgrades[id] };
      });
    }
  }

  BR.RunSystem = RunSystem;
})();
