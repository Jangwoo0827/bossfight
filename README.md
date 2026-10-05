# BOSS RUSH RPG — Five Bosses

A 2D action roguelike with no regular enemies: **boss → reward → stronger build → harder boss → retry**.
It uses only HTML5, CSS and Vanilla JS with Canvas 2D. There are no external libraries, no build step and no image files.

## ▶ Play

**https://jangwoo0827.github.io/bossfight/**

Version history: [CHANGELOG.md](CHANGELOG.md) (also in-game under **PATCH NOTES**)

## Running the game

- Open `index.html` directly in a browser. It also works from `file://`, because it uses classic scripts, not ES modules.
- Or serve it from any static server, for example `python -m http.server 8765` and then http://localhost:8765
- itch.io: zip the whole folder and upload it as an HTML5 game, with `index.html` as the entry file.

## Controls

| Input | Action |
|---|---|
| WASD / arrow keys | Move |
| Mouse | Aim |
| Left click (hold) | Basic attack: close slash at full damage, plus a sword-wave projectile at 55% damage |
| SPACE (or Left Shift) | Dash: short invincibility, with an input buffer |
| Q | **Arc Lance**: a piercing lance that also clears enemy projectiles (has charges) |
| E | **Nova**: a burst around you, enemy-projectile clear, short invincibility |
| ESC | Pause |
| 1 / 2 / 3 | Pick a reward card · R: restart from the result screen |

## Modes
- **START RUN**: the main game (character + difficulty select)
- **PRACTICE**: fight any boss starting from any phase. No records or SOUL.
- **TUTORIAL**: learn movement, attacks, dashing, dodging, charging and PARRY against a training dummy in about 2 minutes. It is offered automatically before your first run.

## Controller / Mobile
- **Gamepad**: left stick to move, right stick to aim + auto-attack (or RT), A/LB dash, X/LT charge (hold), B/RB E skill, Start to pause. Use the D-pad + A in menus.
- **Touch**: left half of the screen = move stick, right half = aim + auto-attack stick, plus DASH / Q (hold) / E / pause buttons. Play in landscape.

## Characters

| Character | Basic attack (3rd/6th hit = finisher) | Q (hold to charge, release) | E |
|---|---|---|---|
| BLADEMASTER | Slash + sword wave | Arc Lance (piercing, clears bullets) | Nova: burst around you. Right before a hit lands, it **PARRIES** |
| GUNSLINGER | Rapid fire (6th shot pierces) | Rail Shot (very fast, piercing) | Smoke Roll: roll backwards + shotgun blast; a near-miss counts as a PARRY |
| IRON GUARDIAN | Hammer + shockwave (3rd hit = quake) | Earthsplitter (huge wave) | Bulwark: blocks all damage for 1s; every block is a PARRY |

PARRY: the incoming attack is cancelled, you heal 8 HP, gain 25 energy, and your E cooldown is halved.

## Difficulty

| | Bosses per run | Boss HP | Boss damage | SOUL |
|---|---|---|---|---|
| EASY | 4 | -20% | -25% | ×0.7 |
| NORMAL | 5 | base | base | ×1 |
| HARD | 7 | +20% | +20% | ×1.7 |
| NIGHTMARE | 10 | +40% | +40% | ×2.8 |

## How a run works

1. **Sword Knight** (fixed first boss: learn to read telegraphs)
2. → Then you **choose the next boss** from 3 random picks out of the 10-boss pool. The number of choices depends on the difficulty. A boss picked later has a little more HP.
3. → **Abyss Lord** is always the final boss (3 phases).
- After each boss you **pick 1 of 3** run upgrades (33 kinds: attack, survival, movement, skill, technique, special) and recover 35% HP.
- Technique upgrades: stronger finishers, shorter combos, faster charging, max-charge damage, parry healing, a damage buff after parries, and a shockwave when a dash ends.
- Special upgrades: Glass Cannon, Phoenix Feather (one revive), Aegis (a barrier per fight), lifesteal and thorns.
- **Relics**: choose 1 of 3 after the 1st boss and right before the final boss. They change the rules of the run (8 kinds: slow down boss time, burning, projectile reflection, ...).
- **Synergies**: owning two specific upgrades unlocks an evolved effect automatically (8 kinds). Reward cards show a "⚡ SYNERGY" hint when picking them would complete one.
- **SOUL** is earned per boss and kept after death. Spend it on 10 kinds of permanent upgrades in `UPGRADES` on the main menu (stats, more SOUL, reward rerolls, Head Start).

## How each boss is beaten

| Boss | Core lesson |
|---|---|
| Sword Knight | Read the cone and side-step, then punish. When his charge hits a wall he is stunned, which is your damage window. |
| Inferno Mage | A ranged zoner, so close the gap. Hugging her makes her teleport and leave an explosion. The fire ring is safe in the middle. |
| Stone Golem | Dash **through** the shockwave using dash invincibility. After a ground slam it is stuck for a long time. |
| Void Hunter | Short telegraphs and fast movement. Clones are moving lines. Punish right after a dash strike. |
| Frost Witch | During Crystal Shield she is immune: break all 3 crystals before the blizzard completes and she is stunned. Frost lanes leave only one safe row. |
| Storm Caller | A lightning lattice between pylons (2 more appear in phase 2). Storm marks hit where you stand, so keep moving. Dash through the ring after his ground slam. |
| Blood Count | While he siphons, staying far away heals him. Get inside the circle and burst him to stagger him. Clear homing bats with Q/E. |
| Western Shooter | While his gun guards the front, frontal attacks are blocked (he answers with a counter shot); flank him for 1.5x damage. The giant ricochet slug bounces around the map, so read its path. HIGH NOON in phase 2. |
| Clockwork Warden | The clock-hand beams rotate at a fixed speed, so circle along with them. REWIND strikes the path you just walked. Tick bombs go off in order. |
| Dune Wyrm | Immune while underground: the sand mound chases you, and when it stops it erupts. After it surfaces, its head is exposed. Tail Sweep is safe right next to it. |
| Dire Alpha | Not hittable during a pounce: watch the shadow and leave the landing spot. After the wall-bouncing frenzy charge, it is dizzy. |
| Abyss Lord | Checkerboard (find the safe tiles), spiral bullets, a cross beam and combos. All three phases are readable. |

## Records / achievements
`RECORDS` on the main menu: lifetime stats, best clear time per difficulty, the bestiary (kills/deaths per boss) and 22 achievements. A toast appears in game when you unlock one.

## Code structure

```
js/config.js            all tunable values (player, skills, run, shake, souls...)
js/input.js             keyboard / mouse
js/game.js              loop + state flow (menu/intro/fight/victory/reward/select/result)
js/core/                renderer (cached arenas, glow sprites), camera (shake), collision, particles, audio
js/entities/            player, boss (base: state machine + coroutine attacks), projectile, effect (Hazard etc.)
js/bosses/              one file per boss; attacks are generator functions
js/systems/             combat, boss factory, rewards, run, upgrades, save (localStorage)
js/data/                boss data, upgrade data (run + meta)
js/ui/                  canvas HUD + DOM overlays (menu, reward, boss select, result)
```

### Adding a boss
1. Add a data entry (id, hp, arena, tip...) to `BR.BOSS_DATA` in `js/data/bosses.js`.
2. Create `js/bosses/myBoss.js`: `class MyBoss extends BR.Boss`, and define the `attacks` array.
   Each attack is `{ name, weight, cooldown, minRange, maxRange, phase, fn: this.atkX }`,
   where `*atkX()` creates a telegraph with `this.hazard({...})` and then `yield`s the number of seconds to wait.
3. Register it with `BR.BossClasses.myBoss = MyBoss`, and add a `<script>` tag to `index.html`.

### Music
`js/core/music.js` generates background music procedurally with WebAudio (no files). Each arena gets its own key, scale and tempo, and the music gets more intense in later boss phases. Music and sound-effect volume are adjusted separately in Settings.

### Releasing a new version
Add a new entry at the top of `BR.PATCH_NOTES` in `js/data/patchNotes.js`. That becomes the game version, and players who haven't read it yet see a NEW badge on the main menu.

### Cache
After an update, raise the `?v=N` number on the script/CSS tags in `index.html` so browsers (and GitHub Pages) load the new files.

### Sound
`AudioManager` uses synthesized WebAudio sounds when there are no audio files.
To use real files, call `game.audio.register('hit', 'sounds/hit.wav')`. Registered files take priority.
Sound keys: `attack, hit, dash, bossHit, bossPhase, bossDeath, reward, button, ...`

### Debugging
In the browser console, `BR.game` gives access to the game state (e.g. `BR.game.boss.hp = 10`).
