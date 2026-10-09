/* State of a single RUN: boss order, upgrades taken, souls earned. Reset on death. */
(function () {
  'use strict';
  const R = BR.CONFIG.RUN;
  const S = BR.CONFIG.SOUL;

  class RunSystem {
    constructor(difficulty, character, meta) {
      this.soulMult = 1 + BR.UpgradeSystem.metaValue(meta, 'fortune');
      this.rerolls = BR.UpgradeSystem.metaValue(meta, 'reroll');
      this.rarityBoost = BR.UpgradeSystem.metaValue(meta, 'luck');
      this.relicChoices = 3 + BR.UpgradeSystem.metaValue(meta, 'relichunter');
      this.difficulty = difficulty || BR.DIFFICULTY_BY_ID.normal;
      this.character = character || BR.CHARACTERS[0];
      this.mode = 'run';           // 'run' | 'practice' | 'tutorial'
      this.rush = false;           // Boss Rush: fixed 12-boss order, no rewards
      this.rushOrder = null;
      this.rng = Math.random;      // seeded for daily runs
      this.seed = null;
      this.daily = null;           // 'YYYY-MM-DD' for daily challenge runs
      this.modifiers = [];
      this.bossHpMod = 1;
      this.noHeal = false;
      this.eliteChance = R.eliteChance + (this.difficulty.eliteBonus || 0);
      this.enemyTimeScale = 1;     // relic: Cracked Hourglass
      this.relics = [];
      this.synergies = [];
      this.relicOffered = {};
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
    get totalBosses() { return this.rush ? this.rushOrder.length : this.difficulty.bosses; }
    get isComplete() { return this.defeated.includes(R.finalBoss); }

    firstBossId() { return R.firstBoss; }

    // Knight first, final boss last; in between, choose from up to 3 random pool bosses
    nextBossOptions() {
      if (this.rush) return [this.rushOrder[Math.min(this.stage, this.rushOrder.length - 1)]];
      if (this.stage === 0) return [R.firstBoss];
      if (this.stage >= this.totalBosses - 1) return [R.finalBoss];
      const remaining = BR.BOSS_DATA
        .map((b) => b.id)
        .filter((id) => id !== R.firstBoss && id !== R.finalBoss && !this.defeated.includes(id));
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }
      // Apex (★6+) bosses only show up from the third fight, never on EASY
      const apexOk = this.stage >= 2 && this.difficulty.id !== 'easy';
      const gated = apexOk ? remaining : remaining.filter((id) => BR.BOSS_BY_ID[id].difficulty <= 5);
      const options = (gated.length >= R.bossChoices ? gated : remaining).slice(0, R.bossChoices);
      return options.length ? options : [R.finalBoss];
    }

    // Mid-run bosses get a little tougher the later you pick them
    hpMultiplierFor(id) {
      const d = this.difficulty.hp * this.bossHpMod;
      if (id === R.firstBoss || id === R.finalBoss) return d;
      return d * (1 + R.stageHpScale * Math.max(0, this.stage - 1));
    }

    damageMultiplier() { return this.difficulty.dmg; }

    recordBossDefeat(id, elite) {
      this.defeated.push(id);
      this.stage++;
      let soul = S.perBossBase + S.perStage * this.stage;
      if (this.isComplete) soul += S.clearBonus;
      const dif = (BR.BOSS_BY_ID[id] || {}).difficulty || 1;
      const apexMult = dif > 5 ? 1 + 0.25 * (dif - 5) : 1;   // APEX bosses pay more
      soul = Math.round(soul * this.difficulty.soul * this.soulMult * (elite ? R.elite.soul : 1) * apexMult);
      this.soulEarned += soul;
      return soul;
    }

    // Relics are offered after the 1st boss and right before the final boss
    shouldOfferRelic() {
      if (this.mode !== 'run' || this.rush || this.isComplete) return false;
      if (this.stage !== 1 && this.stage !== this.totalBosses - 1) return false;
      return !this.relicOffered[this.stage] && this.availableRelics().length > 0;
    }

    availableRelics() {
      return BR.RELICS.filter((r) => !r.apex && !this.relics.includes(r));
    }

    rollRelics(n) {
      this.relicOffered[this.stage] = true;
      const pool = this.availableRelics().slice();
      const out = [];
      while (out.length < n && pool.length) out.push(pool.splice(Math.floor(this.rng() * pool.length), 1)[0]);
      return out;
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
