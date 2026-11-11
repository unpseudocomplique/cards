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
  mobile: { position: [0, 3.25, 6.35], lookAt: [0, 0.85, -0.2], fov: 46 }
} as const satisfies Record<string, { position: readonly [number, number, number], lookAt: readonly [number, number, number], fov: number }>

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
  const spec = view.mobile ? TABLE_CAMERA.mobile : TABLE_CAMERA.desktop
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

/**
 * Box covered by the trick overlay (TrickOverlay centres it with a bottom
 * padding of 14vh, 18vh on narrow screens).
 */
export function trickZone(view: TableViewport) {
  const centerY = view.height * (view.mobile ? 0.41 : 0.43)
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
  const zone = trickZone(view)
  const behindTrick = Math.abs(anchor.x - zone.centerX) < zone.halfWidth
    && Math.abs(anchor.y - zone.centerY) < zone.halfHeight + 14

  let { x, y } = anchor

  if (behindTrick) {
    const pile = wonPileAnchor(seat, localSeat, playerCount, view)
    const side = pile.x < zone.centerX ? 1 : -1
    x = zone.centerX + side * (zone.halfWidth + LABEL_HALF_WIDTH)
    y = Math.max(anchor.y, zone.centerY - zone.halfHeight + 24)
  }

  const margin = LABEL_HALF_WIDTH + 8

  return {
    x: Math.min(view.width - margin, Math.max(margin, x)),
    y: Math.max(HUD_CLEARANCE, y)
  }
}

/** Won-trick pile on the felt beside an opponent, toward the back of the table. */
export function wonPileAnchor(seat: number, localSeat: number, playerCount: number, view: TableViewport): ScreenPoint {
  if (seat === localSeat) {
    return localAnchor(view)
  }
  const angle = seatAngle(seat, localSeat, playerCount)
  // Swing toward negative z (away from the camera) so piles never sit on the hand.
  const swing = Math.sin(angle + PILE_SWING) < Math.sin(angle - PILE_SWING) ? PILE_SWING : -PILE_SWING
  const pileAngle = angle + swing
  return project(view, [Math.cos(pileAngle) * PILE_RADIUS, 0.02, Math.sin(pileAngle) * PILE_RADIUS])
}
