/*
 * TRAINING DUMMY — tutorial-only target. Never dies, only attacks when the
 * tutorial step asks for it (dodge / parry practice). Slow, very clear telegraphs.
 */
(function () {
  'use strict';
  const { Draw } = BR;

  class TrainingDummy extends BR.Boss {
    constructor(game, def, opts) {
      super(game, def, opts);
      this.baseSpeed = 0;
      this.recoveryByPhase = [0.2];
      this.phaseThresholds = [];
      const A = BR.CONFIG.ARENA;
      this.x = (A.left + A.right) / 2;
      this.y = (A.top + A.bottom) / 2 - 40;
      this.wobble = 0;
      this.idleTimer = 0.5;
      this.attacks = [
        { name: 'drill', weight: 1, cooldown: 0, fn: this.atkDrill },
      ];
    }

    takeDamage(amount) {
      super.takeDamage(amount);
      this.wobble = 1;
      if (this.hp < this.maxHp * 0.15) {
        this.hp = this.maxHp; // never dies...
        // ...unless you really mean it
        if (!this.secretFired && this.game.run && this.game.run.mode === 'tutorial') {
          this.secretFired = true;
          this.game.triggerSecret(this);
        }
      }
      this.game.onTutorialEvent('hit');
    }

    updateExtra(dt) {
      this.wobble = Math.max(0, this.wobble - dt * 4);
    }

    // What the dummy does depends on the current tutorial step
    *atkDrill() {
      const mode = this.game.tutorialMode();
      const p = this.player;
      if (mode === 'dodge') {
        const warn = 1.1;
        this.hazard({
          shape: 'circle', x: p.x, y: p.y, radius: 80, warn, damage: 5,
          onActivate: (h) => {
            const dodged = !h.contains(p.x, p.y, p.radius) || p.iframes > 0;
            this.game.onTutorialEvent(dodged ? 'dodge' : 'dodgeFail');
          },
        });
        yield warn + 0.8;
      } else if (mode === 'parry') {
        const warn = 1.6;
        this.chargeUp(warn, '#ff6070');
        this.hazard({ shape: 'circle', x: p.x, y: p.y, radius: 90, warn, damage: 5 });
        yield warn + 1.0;
      } else {
        yield 0.5;
      }
    }

    drawBody(ctx, time) {
      const r = this.radius;
      const tilt = Math.sin(time * 30) * this.wobble * 0.25;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(tilt);
      // Post
      ctx.fillStyle = '#5a3e22';
      ctx.fillRect(-5, -r * 0.2, 10, r * 1.4);
      // Straw body
      Draw.circle(ctx, 0, 0, r, '#c9a35a', '#5a3e22', 3);
      ctx.strokeStyle = 'rgba(90,62,34,0.6)';
      ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * r * 0.3, -r * 0.8);
        ctx.lineTo(i * r * 0.32, r * 0.8);
        ctx.stroke();
      }
      // Target rings
      Draw.circle(ctx, 0, 0, r * 0.55, null, '#c0392b', 3);
      Draw.circle(ctx, 0, 0, r * 0.22, '#c0392b');
      ctx.restore();
    }
  }

  BR.BossClasses.trainingDummy = TrainingDummy;
})();
