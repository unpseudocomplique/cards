import { PerspectiveCamera, Vector3 } from 'three'

/**
 * Screen-space anchors for the DOM overlays of the 3D table (names, won-trick
 * piles, card flights). They are computed by projecting the real 3D positions
 * of the salon through the same camera as TableScene, so labels sit on the
 * guests instead of floating at fixed screen percentages.
 */

/** Table camera, shared with TableScene so overlays and 3D stay aligned. */
export const TABLE_CAMERA = {
  desktop: { position: [0, 2.95, 6.05], lookAt: [0, 0.95, -0.25], fov: 42 },
  mobile: { position: [0, 3.25, 6.35], lookAt: [0, 0.85, -0.2], fov: 46 },
  /** Phone held upright: higher and further back so the whole felt fits the narrow width. */
  portrait: { position: [0, 7.4, 6.6], lookAt: [0, -0.1, 0.25], fov: 62 }
} as const satisfies Record<string, { position: readonly [number, number, number], lookAt: readonly [number, number, number], fov: number }>

/** Screens taller than wide (phone in portrait) get the overhead camera. */
export function isPortraitView(view: { width: number, height: number }) {
  return view.width > 0 && view.width / Math.max(1, view.height) < 0.85
}

export function tableCamera(view: { width: number, height: number, mobile: boolean }) {
  if (isPortraitView(view)) {
    return TABLE_CAMERA.portrait
  }
  return view.mobile ? TABLE_CAMERA.mobile : TABLE_CAMERA.desktop
}

export type TableViewport = {
  width: number
  height: number
  /** Narrow screens use the mobile camera (see TableScene's isMobile). */
  mobile: boolean
}

export type ScreenPoint = { x: number, y: number }

/* World geometry, mirrored from RoomAmbiance (guests) and OpponentStacks (hands). */
const GUEST_RADIUS = 3.22
const GUEST_X_STRETCH = 1.06
/** Just above a seated guest's head (feet at y -0.86, head ≈ 0.48). */
const LABEL_Y = 0.78
const STACK_RADIUS = 3.05
const STACK_Y = 0.1
const PILE_RADIUS = 2.35
/** Piles slide beside the guest, toward the back of the table, off the hand. */
const PILE_SWING = 0.42

/** Same seat angle as RoomAmbiance / OpponentStacks: local player faces the camera. */
export function seatAngle(seat: number, localSeat: number, playerCount: number) {
  const rel = (seat - localSeat + playerCount) % playerCount
  return Math.PI / 2 + (rel / playerCount) * Math.PI * 2
}

const camera = new PerspectiveCamera()
const point = new Vector3()

function project(view: TableViewport, world: [number, number, number]): ScreenPoint {
  const spec = tableCamera(view)
  camera.fov = spec.fov
  camera.aspect = view.width / Math.max(1, view.height)
  const [px, py, pz] = spec.position
  const [lx, ly, lz] = spec.lookAt
  camera.position.set(px, py, pz)
  camera.lookAt(lx, ly, lz)
  camera.updateMatrixWorld()
  camera.updateProjectionMatrix()
  point.set(...world).project(camera)
  return {
    x: ((point.x + 1) / 2) * view.width,
    y: ((1 - point.y) / 2) * view.height
  }
}

/** Where the local player's cards come from / tricks go to: the hand, bottom centre. */
function localAnchor(view: TableViewport): ScreenPoint {
  return { x: view.width * 0.5, y: view.height * 0.86 }
}

/** Landscape phones (matches the `short` CSS variant). */
function isShortView(view: { height: number }) {
  return view.height > 0 && view.height <= 520
}

/**
 * Height in px of the trick cards on phones, sized from the screen so a full
 * trick fits side by side; null keeps TrickOverlay's preset size.
 */
export function trickCardHeight(view: { width: number, height: number }, playerCount: number): number | null {
  // Landscape phones: little height, but still bigger than the preset.
  if (isShortView(view)) {
    return 84
  }
  if (!isPortraitView(view)) {
    return null
  }
  const ratio = 0.62
  const gap = 6
  const cardWidth = (view.width - 24 - gap * (playerCount - 1)) / playerCount
  return Math.round(Math.min(170, Math.max(96, cardWidth / ratio)))
}

/**
 * Box covered by the trick overlay (TrickOverlay centres it with a bottom
 * padding of 14vh, 18vh on narrow screens, 8vh upright, 21vh on short screens).
 */
export function trickZone(view: TableViewport, playerCount = 4) {
  const bottomPadding = isShortView(view)
    ? 0.21
    : isPortraitView(view) ? 0.08 : view.mobile ? 0.18 : 0.14
  const centerY = view.height * (1 - bottomPadding) / 2
  const cardHeight = trickCardHeight(view, playerCount)
  if (cardHeight !== null) {
    // Card + name tag under it + the tilt of the cards.
    const halfHeight = Math.round((cardHeight + 26) / 2 + 8)
    const halfWidth = isPortraitView(view) ? view.width / 2 - 12 : view.mobile ? 140 : 200
    return { centerX: view.width / 2, centerY, halfWidth, halfHeight }
  }
  const halfHeight = view.mobile ? 58 : 70
  const halfWidth = view.mobile ? 140 : 200
  return { centerX: view.width / 2, centerY, halfWidth, halfHeight }
}

/** A player's hand: their stack of cards on the table rim (local: the hand). */
export function seatAnchor(seat: number, localSeat: number, playerCount: number, view: TableViewport): ScreenPoint {
  if (seat === localSeat) {
    return localAnchor(view)
  }
  const angle = seatAngle(seat, localSeat, playerCount)
  return project(view, [Math.cos(angle) * STACK_RADIUS, STACK_Y, Math.sin(angle) * STACK_RADIUS])
}

/** Rough half-width of a name tag, to keep it clear of the trick cards and screen edges. */
const LABEL_HALF_WIDTH = 46
/** Top of the screen reserved for the HUD bar (tags hang above their anchor). */
const HUD_CLEARANCE = 96

/**
 * Name label just above an opponent's head, kept inside the screen and below
 * the HUD bar. A guest seated behind the trick cards gets the label at head
 * height beside the trick (on the side opposite their won pile) rather than
 * above it, where the "Pli pour…" bubble shows.
 */
export function seatLabelAnchor(seat: number, localSeat: number, playerCount: number, view: TableViewport): ScreenPoint {
  const angle = seatAngle(seat, localSeat, playerCount)
  const anchor = project(view, [
    Math.cos(angle) * GUEST_RADIUS * GUEST_X_STRETCH,
    LABEL_Y,
    Math.sin(angle) * GUEST_RADIUS
  ])
  const zone = trickZone(view, playerCount)
  const margin = LABEL_HALF_WIDTH + 8
  if (isPortraitView(view)) {
    // Side guests sit off screen upright: their tag is pulled in from the edge.
    anchor.x = Math.min(view.width - margin, Math.max(margin, anchor.x))
  }
  const behindTrick = Math.abs(anchor.x - zone.centerX) < zone.halfWidth
    && Math.abs(anchor.y - zone.centerY) < zone.halfHeight + 14

  let { x, y } = anchor

  if (behindTrick && isPortraitView(view)) {
    // Upright phones: the trick spans the width, so lift the tag above the cards.
    y = Math.min(anchor.y, zone.centerY - zone.halfHeight - 6)
  } else if (behindTrick) {
    const pile = feltPileAnchor(seat, localSeat, playerCount, view)
    // Keep the tag on the player's own side of the trick.
    const side = pile.x < zone.centerX ? -1 : 1
    x = zone.centerX + side * (zone.halfWidth + LABEL_HALF_WIDTH)
    y = Math.max(anchor.y, zone.centerY - zone.halfHeight + 24)
  }

  return {
    x: Math.min(view.width - margin, Math.max(margin, x)),
    y: Math.max(HUD_CLEARANCE, y)
  }
}

/** Phones (upright or landscape): no pile on the felt, the count sits in the name tag. */
export function wonCountInTag(view: { width: number, height: number }) {
  return isPortraitView(view) || isShortView(view)
}

/** Pile spot on the felt beside an opponent, toward the back of the table. */
function feltPileAnchor(seat: number, localSeat: number, playerCount: number, view: TableViewport): ScreenPoint {
  const angle = seatAngle(seat, localSeat, playerCount)
  // Swing toward negative z (away from the camera) so piles never sit on the hand.
  const swing = Math.sin(angle + PILE_SWING) < Math.sin(angle - PILE_SWING) ? PILE_SWING : -PILE_SWING
  const pileAngle = angle + swing
  return project(view, [Math.cos(pileAngle) * PILE_RADIUS, 0.02, Math.sin(pileAngle) * PILE_RADIUS])
}

/**
 * Where an opponent's won tricks go: their pile on the felt, or on phones their
 * name tag (a pile there would sit on the trick or under the hand).
 */
export function wonPileAnchor(seat: number, localSeat: number, playerCount: number, view: TableViewport): ScreenPoint {
  if (seat === localSeat) {
    return localAnchor(view)
  }
  if (wonCountInTag(view)) {
    const label = seatLabelAnchor(seat, localSeat, playerCount, view)
    return { x: label.x, y: label.y - 12 }
  }
  return feltPileAnchor(seat, localSeat, playerCount, view)
}

/**
 * How the current trick is laid out: in front of each player (upright phones,
 * desktop) or as a numbered row (landscape phones, no height to spare).
 */
export function trickLayout(view: { width: number, height: number }): 'seat' | 'row' {
  return isShortView(view) ? 'row' : 'seat'
}

/** Ring of spots around the trick centre, by seat relative to the local player. */
const SEAT_TRICK_SPOTS: Record<number, Array<[number, number]>> = {
  3: [[0, 0.62], [-0.55, -0.35], [0.55, -0.35]],
  4: [[0, 0.62], [-0.6, 0], [0, -0.62], [0.6, 0]],
  5: [[0, 0.62], [-0.66, 0.12], [-0.33, -0.56], [0.33, -0.56], [0.66, 0.12]],
}

/** Height (px) of the trick cards when each lies in front of its player. */
export function seatTrickCardHeight(view: { width: number, height: number }, playerCount: number): number {
  return trickCardHeight(view, playerCount) ?? 100
}

/** Centre (px) of the spot where a seat's card lies, in front of that player. */
export function seatTrickSpot(seat: number, localSeat: number, playerCount: number, view: TableViewport): ScreenPoint {
  const h = seatTrickCardHeight(view, playerCount)
  const w = h * 0.62
  const rel = (seat - localSeat + playerCount) % playerCount
  const zone = trickZone(view, playerCount)
  const [fx, fy] = SEAT_TRICK_SPOTS[playerCount]?.[rel] ?? [0, 0]
  let x: number
  let y: number
  if (isPortraitView(view)) {
    x = zone.centerX + fx * (view.width / 2 - w / 2 - 10)
    y = zone.centerY + h * 0.25 + fy * h * 1.4
  } else {
    x = zone.centerX + fx * Math.min(view.width / 2 - w / 2 - 10, w * 3.2)
    // Wide screens show the table lower: keep the cards on the felt.
    y = isShortView(view)
      ? zone.centerY + fy * h * 0.9
      : zone.centerY + h * 0.4 + fy * h * 1.15
  }
  return {
    x: Math.min(view.width - w / 2 - 6, Math.max(w / 2 + 6, x)),
    y,
  }
}
