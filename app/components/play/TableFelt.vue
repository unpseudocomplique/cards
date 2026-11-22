<script setup lang="ts">
import { ambianceTheme } from '~/utils/ambianceThemes'

/**
 * The table seen from above, zoomed in: the cloth fills the screen and the
 * wood only shows in the corners. A few things lie on it: a cup, a candle
 * and the score notebook (tap it to see the scores).
 */
defineProps<{
  portrait: boolean
  short: boolean
  /** Hide the notebook (no scores yet, e.g. while loading). */
  hideNotebook?: boolean
}>()

defineEmits<{ scores: [] }>()

const { themeId } = usePlayAmbiance()
const theme = computed(() => ambianceTheme(themeId.value))

const style = computed(() => ({
  '--felt': theme.value.felt,
  '--felt-edge': theme.value.feltEdge,
  '--felt-glow': theme.value.glow,
  '--wood': theme.value.wood,
  '--wood-dark': theme.value.woodDark
}))
</script>

<template>
  <div
    class="table-room"
    :class="{ 'table-room--portrait': portrait, 'table-room--short': short }"
    :style="style"
  >
    <div class="table-cloth">
      <svg
        class="table-emblem"
        viewBox="0 0 200 200"
        aria-hidden="true"
      >
        <circle
          cx="100"
          cy="100"
          r="92"
        />
        <circle
          cx="100"
          cy="100"
          r="84"
          stroke-dasharray="2 5"
        />
        <text
          x="100"
          y="40"
        >♠</text>
        <text
          x="164"
          y="108"
        >♥</text>
        <text
          x="100"
          y="176"
        >♦</text>
        <text
          x="36"
          y="108"
        >♣</text>
        <path d="M100 62 l9 28 l29 0 l-23 17 l9 28 l-24 -17 l-24 17 l9 -28 l-23 -17 l29 0z" />
      </svg>
    </div>

    <!-- Cup of coffee on its saucer -->
    <svg
      class="table-prop table-cup"
      viewBox="0 0 120 120"
      aria-hidden="true"
    >
      <defs>
        <radialGradient
          id="cup-saucer"
          cx=".45"
          cy=".4"
        ><stop
          offset="0"
          stop-color="#fffaf0"
        /><stop
          offset=".8"
          stop-color="#e9e1d0"
        /><stop
          offset="1"
          stop-color="#b9ae98"
        /></radialGradient>
        <radialGradient
          id="cup-coffee"
          cx=".4"
          cy=".35"
        ><stop
          offset="0"
          stop-color="#8a5a32"
        /><stop
          offset=".6"
          stop-color="#4a2a14"
        /><stop
          offset="1"
          stop-color="#2a170a"
        /></radialGradient>
      </defs>
      <circle
        cx="64"
        cy="66"
        r="54"
        fill="rgba(0,0,0,.35)"
      />
      <circle
        cx="58"
        cy="60"
        r="52"
        fill="url(#cup-saucer)"
      />
      <circle
        cx="58"
        cy="60"
        r="38"
        fill="none"
        stroke="#d8cdb6"
        stroke-width="1.5"
      />
      <circle
        cx="58"
        cy="60"
        r="31"
        fill="#f7f1e4"
        stroke="#cfc3aa"
        stroke-width="2"
      />
      <path
        d="M86 52 q20 -4 20 10 q0 14 -20 10"
        fill="none"
        stroke="#f7f1e4"
        stroke-width="7"
        stroke-linecap="round"
      />
      <circle
        cx="58"
        cy="60"
        r="25"
        fill="url(#cup-coffee)"
      />
      <ellipse
        class="table-cup-shine"
        cx="52"
        cy="53"
        rx="9"
        ry="4"
        fill="rgba(255,230,190,.25)"
      />
      <rect
        x="14"
        y="88"
        width="34"
        height="5"
        rx="2.5"
        fill="#c9a463"
        transform="rotate(-28 30 90)"
      />
    </svg>

    <!-- Candle in a brass holder, with its flickering glow -->
    <div
      class="table-prop table-candle"
      aria-hidden="true"
    >
      <span class="table-candle-glow" />
      <svg viewBox="0 0 90 90">
        <defs>
          <radialGradient
            id="candle-brass"
            cx=".4"
            cy=".35"
          ><stop
            offset="0"
            stop-color="#ffe7a8"
          /><stop
            offset=".6"
            stop-color="#c9a463"
          /><stop
            offset="1"
            stop-color="#6b4a1c"
          /></radialGradient>
        </defs>
        <circle
          cx="48"
          cy="49"
          r="30"
          fill="rgba(0,0,0,.35)"
        />
        <circle
          cx="45"
          cy="45"
          r="28"
          fill="url(#candle-brass)"
        />
        <circle
          cx="45"
          cy="45"
          r="13"
          fill="#f4ecd8"
          stroke="#d9cdb2"
          stroke-width="2"
        />
        <circle
          class="table-candle-flame"
          cx="45"
          cy="45"
          r="5"
          fill="rgba(255,200,90,.6)"
        />
        <circle
          cx="45"
          cy="45"
          r="2.6"
          fill="#ffcf5a"
        />
      </svg>
    </div>

    <!-- Score notebook: lies under the cards, but a clear hit area above
         the play layer keeps it tappable even when a card covers it. -->
    <template v-if="!hideNotebook">
      <button
        type="button"
        class="table-prop table-notebook-hit"
        aria-label="Voir les scores"
        title="Scores"
        @click="$emit('scores')"
      />
      <span
        class="table-prop table-notebook"
        aria-hidden="true"
      >
        <span class="table-notebook-cover" />
        <span class="table-notebook-page">
          <span class="table-notebook-title">Scores</span>
        </span>
        <span class="table-notebook-pencil" />
      </span>
    </template>
  </div>
</template>

<style scoped>
.table-room {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 30% 20%, rgba(255, 190, 120, 0.1), transparent 60%),
    repeating-linear-gradient(97deg, rgba(0, 0, 0, 0.18) 0 2px, transparent 2px 9px, rgba(255, 255, 255, 0.025) 9px 11px, transparent 11px 23px),
    linear-gradient(160deg, var(--wood), var(--wood-dark));
}

.table-cloth {
  position: absolute;
  inset: -60px -70px -110px;
  border-radius: 46% / 40%;
  background:
    radial-gradient(ellipse at 50% 45%, var(--felt-glow), transparent 58%),
    radial-gradient(ellipse at 50% 50%, transparent 52%, var(--felt-edge) 100%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .22 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E"),
    var(--felt);
  box-shadow:
    0 0 0 5px #8a6a3a,
    0 0 0 7px #c9a463,
    0 0 0 9px #4a3018,
    0 18px 40px 12px rgba(0, 0, 0, 0.6),
    inset 0 0 70px rgba(0, 0, 0, 0.45);
}
.table-room--portrait .table-cloth {
  inset: 34px -120px -60px;
  border-radius: 50% / 40%;
}

.table-emblem {
  position: absolute;
  left: 50%;
  top: 46%;
  width: min(42vmin, 260px);
  transform: translate(-50%, -50%);
  opacity: 0.14;
  fill: none;
  stroke: #f2d79a;
  stroke-width: 1.6;
}
.table-emblem text { fill: #f2d79a; stroke: none; font-size: 22px; text-anchor: middle; }
.table-room--portrait .table-emblem { top: 44%; }

.table-prop { position: absolute; }

.table-cup { width: 112px; height: 112px; left: -40px; bottom: 26%; }
.table-room--short .table-cup { width: 96px; height: 96px; left: -38px; bottom: 30%; }
.table-room--portrait .table-cup { width: 92px; height: 92px; left: -50px; top: 46%; bottom: auto; }

.table-candle { width: 74px; height: 74px; display: none; }
.table-room--portrait .table-candle { display: block; right: -20px; top: 19%; }
.table-candle svg { position: relative; width: 100%; height: 100%; }
.table-candle-glow {
  position: absolute;
  inset: -70%;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(255, 210, 120, 0.4), rgba(255, 210, 120, 0) 65%);
  animation: candle-glow 3.2s ease-in-out infinite alternate;
}
.table-candle-flame { animation: candle-flame 1.3s ease-in-out infinite alternate; transform-origin: 45px 45px; }
@keyframes candle-glow { from { opacity: 0.75; transform: scale(0.96); } to { opacity: 1; transform: scale(1.04); } }
@keyframes candle-flame { from { transform: scale(0.85); opacity: 0.7; } to { transform: scale(1.15); opacity: 1; } }

.table-notebook,
.table-notebook-hit {
  width: 104px;
  height: 136px;
  right: -26px;
  top: -34px;
  transform: rotate(14deg);
}
.table-notebook {
  pointer-events: none;
  transition: transform 220ms cubic-bezier(.3, 1.4, .5, 1);
  z-index: 1;
}
/* Invisible, above the play layer (z-20) that covers the whole table. */
.table-notebook-hit {
  z-index: 25;
  background: transparent;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.table-notebook-hit:hover + .table-notebook,
.table-notebook-hit:focus-visible + .table-notebook { transform: rotate(10deg) translateY(4px) scale(1.04); }
.table-notebook-hit:focus-visible { outline: none; }
.table-notebook-hit:active + .table-notebook { transform: rotate(10deg) translateY(6px) scale(0.98); }
.table-room--short .table-notebook,
.table-room--short .table-notebook-hit { width: 88px; height: 116px; right: -22px; top: -30px; }
.table-room--portrait .table-notebook,
.table-room--portrait .table-notebook-hit { width: 82px; height: 108px; right: -30px; top: auto; bottom: 37%; transform: rotate(-12deg); }
.table-room--portrait .table-notebook-hit:hover + .table-notebook { transform: rotate(-8deg) translateX(-4px) scale(1.04); }
.table-room--portrait .table-notebook-hit:active + .table-notebook { transform: rotate(-8deg) translateX(-4px) scale(0.98); }
.table-notebook-cover {
  position: absolute;
  inset: 0;
  border-radius: 6px;
  background: linear-gradient(135deg, #6e3b22, #4a2414);
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.55), inset 0 0 0 2px rgba(201, 164, 99, 0.6);
}
.table-notebook-page {
  position: absolute;
  inset: 7px 7px 7px 13px;
  border-radius: 3px;
  background: repeating-linear-gradient(#fbf3df 0 11px, #c9d8e8 11px 12px);
  box-shadow: inset 3px 0 0 #e7a3a3;
}
.table-notebook-title {
  position: absolute;
  left: 10px;
  bottom: 18px;
  font: italic 700 15px 'Cormorant Garamond', Georgia, serif;
  color: #2b3d66;
}
.table-notebook-pencil {
  position: absolute;
  left: 70%;
  top: -10px;
  width: 7px;
  height: 92%;
  border-radius: 2px;
  background: linear-gradient(90deg, #e8b84a, #c4902a);
  transform: rotate(16deg);
  box-shadow: 2px 4px 6px rgba(0, 0, 0, 0.4);
}

@media (prefers-reduced-motion: reduce) {
  .table-candle-glow, .table-candle-flame { animation: none; }
}
</style>
