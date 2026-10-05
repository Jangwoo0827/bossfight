/* Entry point: scale the 1280x720 stage to the window and start the game. */
(function () {
  'use strict';

  function fitStage() {
    const wrap = document.getElementById('game-wrap');
    if (!wrap) return;
    const scale = Math.min(window.innerWidth / BR.CONFIG.WIDTH, window.innerHeight / BR.CONFIG.HEIGHT);
    wrap.style.transform = `scale(${Math.max(0.1, scale)})`;
  }

  window.addEventListener('resize', fitStage);
  window.addEventListener('DOMContentLoaded', () => {
    fitStage();
    const canvas = document.getElementById('game');
    const game = new BR.Game(canvas);
    BR.game = game; // handy for debugging from the console
    game.start();
  });
})();
