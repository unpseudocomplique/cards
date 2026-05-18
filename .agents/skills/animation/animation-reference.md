# Animation Reference — Ta Plume

> App educatif ludique : les animations doivent être **joyeuses mais pas distrayantes**.

## 1. Core Imports

```ts
import { motion, AnimatePresence } from 'motion-v'
import { LayoutGroup } from 'motion-v' // for shared layout morphing
```

## 2. Established Patterns

### 2.1 AnimatePresence + motion.div (enter/exit)

Use for any element that conditionally appears or disappears.

```vue
<AnimatePresence mode="popLayout">
  <motion.div
    v-if="visible"
    :key="stableId"
    :initial="{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }"
    :animate="{ opacity: 1, scale: 1, filter: 'blur(0px)' }"
    :exit="{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }"
    :transition="{ type: 'spring', stiffness: 400, damping: 30 }"
  >
    <!-- content -->
  </motion.div>
</AnimatePresence>
```

#### Key rules

| Rule | Why |
|------|-----|
| Always provide a **stable `:key`** (use `id`, never `index`) | Shifting indices break exit animations |
| Prefer `mode="popLayout"` on `AnimatePresence` | Prevents layout shift during removal |
| Add the `layout` prop when items reflow after siblings are added/removed | Triggers smooth FLIP-based repositioning |

### 2.2 Staggered List Animation (container + item variants)

For lists that reveal item-by-item. Perfect for word lists, student lists, error tables.

```ts
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 450, damping: 30 },
  },
}
```

```vue
<motion.div :variants="containerVariants" initial="hidden" animate="show">
  <motion.div v-for="item in items" :key="item.id" :variants="itemVariants">
    ...
  </motion.div>
</motion.div>
```

### 2.3 Shared Layout Animations (`layoutId`)

Use when an element should visually morph between two positions (e.g. tab indicator, toggle states, active card).

```vue
<motion.div layoutId="active-indicator" />
```

- Keep elements with `layoutId` **outside** `AnimatePresence` to avoid opacity conflicts.
- `LayoutGroup` isolates `layoutId` scopes for independent groups on screen.

### 2.4 Number Transitions

The project uses `@number-flow/vue` for animated number changes (scores, counts, KPIs).

```vue
<NumberFlow :value="score" :format="{ minimumFractionDigits: 1 }" />
```

## 3. Spring Presets

Reuse these for consistency across the app:

| Preset | Config | Use case |
|--------|--------|----------|
| **snappy** | `{ type: 'spring', stiffness: 400, damping: 30 }` | Default micro-interactions, toggles, pills |
| **responsive** | `{ type: 'spring', stiffness: 450, damping: 30 }` | Stagger children reveals, list items |
| **smooth** | `{ type: 'spring', stiffness: 380, damping: 24 }` | Card enter/exit, panels |
| **gentle** | `{ type: 'spring', duration: 0.55, bounce: 0.1 }` | Shared layout cards, page transitions |
| **no-bounce** | `{ type: 'spring', duration: 0.55, bounce: 0 }` | Tab content swap, modal transitions |
| **playful** | `{ type: 'spring', stiffness: 300, damping: 20, mass: 0.8 }` | Celebratory animations (score reveals, success states) |

When in doubt, start with **snappy** (`stiffness: 400, damping: 30`).

## 4. Performance Guidelines

### 4.1 Prefer Compositor-Friendly Properties

| Safe (GPU) | Expensive (CPU) |
|------------|-----------------|
| `transform` (scale, translate, rotate) | `width`, `height` |
| `opacity` | `top`, `left`, `margin` |
| `filter` (blur, brightness) | `background`, `border` |
| `clip-path` | `padding`, `font-size` |

motion-v keys like `scale`, `x`, `y`, `rotate` map to `transform` — they are GPU-accelerated.

### 4.2 Spring vs Easing

- **Prefer springs** for interactive elements (hover, tap, enter/exit).
- **Use cubic-bezier easing** for directional slides where overshoot feels wrong.
- Never use `linear` for UI transitions.

### 4.3 `will-change`

- Use sparingly. motion-v manages promotion automatically for most animations.
- Only add `will-change` if you see first-frame stutter in Safari.

## 5. UX Guidelines — Education Context

### 5.1 Subtle > Flashy

- Duration: 0.15–0.3s for micro-interactions, 0.3–0.6s for page transitions.
- Blur: 4–8px max. Scale: 0.9–1.05 range.
- Keep stagger delays small (0.03–0.08s).

### 5.2 Animate Contextually

Animate `opacity`, `scale`, and `blur` on elements when they appear/change:

```vue
<AnimatePresence mode="wait">
  <motion.div
    :key="currentState"
    :initial="{ opacity: 0, scale: 0.6, filter: 'blur(4px)' }"
    :animate="{ opacity: 1, scale: 1, filter: 'blur(0px)' }"
    :exit="{ opacity: 0, scale: 0.6, filter: 'blur(4px)' }"
    :transition="{ type: 'spring', duration: 0.3, bounce: 0 }"
  />
</AnimatePresence>
```

### 5.3 Playful Moments (Education-Specific)

Dictée module is for young students — add delight at key moments:

| Moment | Animation |
|--------|-----------|
| Word added to dictionary | Subtle scale bounce + green flash |
| Error toggled (penalizing ↔ tolerated) | Color cross-fade + icon swap with AnimatePresence |
| Score recalculated | NumberFlow animated counter |
| List of errors appearing | Staggered reveal from top |
| Dictée created successfully | Confetti-like scale+rotate on success icon |
| Heatmap cells | Fade in with stagger by row then column |

### 5.4 Gestures

Make interactive elements feel alive:

```vue
<motion.button
  :whileHover="{ scale: 1.02 }"
  :whileTap="{ scale: 0.97 }"
  :transition="{ type: 'spring', duration: 0.3, bounce: 0 }"
/>
```

### 5.5 Shadows over Borders for Animated Cards

Use `box-shadow` instead of `border` for elements that animate:

```css
.card-animated {
  box-shadow:
    0px 0px 0px 1px rgba(0, 0, 0, 0.06),
    0px 1px 2px -1px rgba(0, 0, 0, 0.06),
    0px 2px 4px 0px rgba(0, 0, 0, 0.04);
}
```

## 6. Anti-Patterns

| Don't | Why | Do Instead |
|-------|-----|------------|
| Use `index` as `:key` in animated lists | Index shifts cause cascading re-animations | Use `item.id` |
| Put `layoutId` elements inside `AnimatePresence` | Conflicts with layout morph | Keep `layoutId` outside |
| Animate `width`/`height` directly | Triggers layout & paint | Use `scale` or `clip-path` |
| Use Vue `TransitionGroup` for complex choreography | No spring support | Use `AnimatePresence` + `motion.div` |
| Set `bounce > 0.3` on springs | Cartoonish | Keep `bounce: 0–0.15` |
| Over-animate everything | Distracting for teachers who use the app daily | Reserve animations for key moments |
