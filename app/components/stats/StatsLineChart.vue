<script setup lang="ts">
/**
 * One series over time (cumulative points, or a rate), with a zero line, a
 * crosshair and a tooltip on hover.
 */
const props = withDefaults(defineProps<{
  points: Array<{ x: string, y: number, detail?: string }>
  height?: number
  format?: (value: number) => string
  /** Fixed range (rates 0..1); otherwise from the data with 0 included. */
  min?: number
  max?: number
  label: string
}>(), {
  height: 240,
  format: (value: number) => String(Math.round(value)),
  min: undefined,
  max: undefined
})

const box = useTemplateRef<HTMLDivElement>('box')
const { width: boxWidth } = useElementSize(box)
/** Drawn at the real pixel width, so labels keep their size on phones. */
const width = computed(() => Math.max(280, Math.round(boxWidth.value || 720)))
const pad = { top: 14, right: 12, bottom: 24, left: 46 }

const range = computed(() => {
  const values = props.points.map(point => point.y)
  let lo = props.min ?? Math.min(0, ...values)
  let hi = props.max ?? Math.max(0, ...values)
  if (hi === lo) {
    hi = lo + 1
  }
  if (props.min === undefined) {
    const margin = (hi - lo) * 0.08
    lo -= lo < 0 ? margin : 0
    hi += margin
  }
  return { lo, hi }
})

const x = (index: number) => pad.left + (props.points.length <= 1 ? 0 : (index / (props.points.length - 1)) * (width.value - pad.left - pad.right))
const y = (value: number) => pad.top + (1 - (value - range.value.lo) / (range.value.hi - range.value.lo)) * (props.height - pad.top - pad.bottom)

const path = computed(() => props.points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(point.y).toFixed(1)}`).join(' '))
const area = computed(() => props.points.length
  ? `${path.value} L${x(props.points.length - 1).toFixed(1)},${y(Math.max(range.value.lo, 0)).toFixed(1)} L${x(0).toFixed(1)},${y(Math.max(range.value.lo, 0)).toFixed(1)} Z`
  : '')

const ticks = computed(() => {
  const { lo, hi } = range.value
  return [0, 0.5, 1].map(t => lo + (hi - lo) * t)
})

const xLabels = computed(() => {
  const n = props.points.length
  if (!n) {
    return []
  }
  const picks = n < 4 ? [...Array(n).keys()] : [0, Math.round((n - 1) / 3), Math.round(((n - 1) * 2) / 3), n - 1]
  return [...new Set(picks)].map(index => ({ index, label: props.points[index]!.x }))
})

const hover = shallowRef<number | null>(null)
const svg = useTemplateRef<SVGSVGElement>('svg')

function onMove(event: PointerEvent) {
  const box = svg.value?.getBoundingClientRect()
  if (!box || !props.points.length) {
    return
  }
  const px = ((event.clientX - box.left) / box.width) * width.value
  const ratio = (px - pad.left) / (width.value - pad.left - pad.right)
  hover.value = Math.max(0, Math.min(props.points.length - 1, Math.round(ratio * (props.points.length - 1))))
}

const tip = computed(() => {
  if (hover.value === null) {
    return null
  }
  const point = props.points[hover.value]!
  return { point, left: (x(hover.value) / width.value) * 100, top: (y(point.y) / props.height) * 100 }
})
</script>

<template>
  <div
    ref="box"
    class="relative"
  >
    <svg
      ref="svg"
      :viewBox="`0 0 ${width} ${height}`"
      class="block w-full touch-none select-none"
      role="img"
      :aria-label="label"
      @pointermove="onMove"
      @pointerdown="onMove"
      @pointerleave="hover = null"
    >
      <defs>
        <linearGradient
          id="stats-area"
          x1="0"
          x2="0"
          y1="0"
          y2="1"
        >
          <stop
            offset="0"
            stop-color="#e9c77f"
            stop-opacity="0.32"
          />
          <stop
            offset="1"
            stop-color="#e9c77f"
            stop-opacity="0"
          />
        </linearGradient>
      </defs>
      <g
        v-for="tick in ticks"
        :key="tick"
      >
        <line
          :x1="pad.left"
          :x2="width - pad.right"
          :y1="y(tick)"
          :y2="y(tick)"
          stroke="#f6e7c4"
          stroke-opacity="0.1"
        />
        <text
          :x="pad.left - 8"
          :y="y(tick) + 4"
          text-anchor="end"
          class="fill-[#f6e7c4]/55 text-[11px] tabular-nums"
        >{{ format(tick) }}</text>
      </g>
      <line
        v-if="range.lo < 0 && range.hi > 0"
        :x1="pad.left"
        :x2="width - pad.right"
        :y1="y(0)"
        :y2="y(0)"
        stroke="#f6e7c4"
        stroke-opacity="0.35"
        stroke-dasharray="4 4"
      />
      <path
        :d="area"
        fill="url(#stats-area)"
      />
      <path
        :d="path"
        fill="none"
        stroke="#e9c77f"
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
      <text
        v-for="item in xLabels"
        :key="item.index"
        :x="x(item.index)"
        :y="height - 6"
        :text-anchor="item.index === 0 ? 'start' : item.index === points.length - 1 ? 'end' : 'middle'"
        class="fill-[#f6e7c4]/55 text-[11px]"
      >{{ item.label }}</text>
      <g v-if="tip && hover !== null">
        <line
          :x1="x(hover)"
          :x2="x(hover)"
          :y1="pad.top"
          :y2="height - pad.bottom"
          stroke="#f6e7c4"
          stroke-opacity="0.4"
        />
        <circle
          :cx="x(hover)"
          :cy="y(tip.point.y)"
          r="5"
          fill="#e9c77f"
          stroke="#2b190e"
          stroke-width="2"
        />
      </g>
    </svg>
    <div
      v-if="tip"
      class="table-paper pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-md px-2.5 py-1.5 text-xs whitespace-nowrap"
      :style="{ left: `${Math.min(88, Math.max(12, tip.left))}%`, top: `${tip.top}%` }"
    >
      <p class="font-bold tabular-nums">
        {{ format(tip.point.y) }}
      </p>
      <p class="text-[#3b2a18]/65">
        {{ tip.point.x }}<template v-if="tip.point.detail">
          · {{ tip.point.detail }}
        </template>
      </p>
    </div>
  </div>
</template>
