/**
 * Screen-space layout of the play table, seen from above: the felt fills the
 * screen and each player sits on its edge as a round portrait (medallion).
 * The DOM overlays (trick cards, flights, reactions) all place themselves
 * from these anchors.
 */

/** Screens taller than wide (phone in portrait). */
export function isPortraitView(view: { width: number, height: number }) {
  return view.width > 0 && view.width / Math.max(1, view.height) < 0.85
}

export type TableViewport = {
  width: number
  height: number
  /** Narrow screens (see the table's isMobile). */
  mobile: boolean
}

export type ScreenPoint = { x: number, y: number }

/** Seat relative to the local player: 0 = you, then around the table (left, top, right). */
function relativeSeat(seat: number, localSeat: number, playerCount: number) {
  return (seat - localSeat + playerCount) % playerCount
}

/**
 * Medallion centres (fractions of the screen) by relative seat. Landscape and
 * desktop keep the top-centre clear for the score plaque on 5 players.
 */
const WIDE_SEATS: Record<number, Array<[number, number]>> = {
  3: [[0, 0], [0.09, 0.3], [0.91, 0.3]],
  4: [[0, 0], [0.08, 0.3], [0.5, 0.15], [0.92, 0.33]],
  5: [[0, 0], [0.08, 0.3], [0.33, 0.15], [0.67, 0.15], [0.92, 0.33]]
}
const UPRIGHT_SEATS: Record<number, Array<[number, number]>> = {
  3: [[0, 0], [0.15, 0.24], [0.85, 0.24]],
  4: [[0, 0], [0.13, 0.29], [0.5, 0.15], [0.87, 0.29]],
  5: [[0, 0], [0.13, 0.30], [0.3, 0.15], [0.7, 0.15], [0.87, 0.30]]
}

/** Diameter (px) of a player's portrait. */
export function medallionSize(view: { width: number, height: number }) {
  if (isShortView(view)) {
    return 46
  }
  if (isPortraitView(view)) {
    return 52
  }
  return view.width < 900 ? 58 : 70
}

/** Centre of a player's portrait on the edge of the felt (local: left, above the hand). */
export function seatMedallion(seat: number, localSeat: number, playerCount: number, view: TableViewport): ScreenPoint {
  const rel = relativeSeat(seat, localSeat, playerCount)
  if (rel === 0) {
    const portrait = isPortraitView(view)
    return {
      x: portrait ? Math.max(34, view.width * 0.11) : Math.max(36, view.width * 0.055),
      y: view.height * (portrait ? 0.63 : isShortView(view) ? 0.52 : 0.55)
    }
  }
  const table = isPortraitView(view) ? UPRIGHT_SEATS : WIDE_SEATS
  const [fx, fy] = table[playerCount]?.[rel] ?? [0.5, 0.2]
  const size = medallionSize(view)
  return {
    x: Math.min(view.width - size / 2 - 14, Math.max(size / 2 + 14, view.width * fx)),
    y: Math.max(size / 2 + (isShortView(view) ? 12 : 56), view.height * fy)
  }
}

/** Seat angle around the table (kept for callers that fan things per seat). */
export function seatAngle(seat: number, localSeat: number, playerCount: number) {
  const rel = relativeSeat(seat, localSeat, playerCount)
  return Math.PI / 2 + (rel / playerCount) * Math.PI * 2
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

/** A player's hand: cards leave from their portrait (local: the hand). */
export function seatAnchor(seat: number, localSeat: number, playerCount: number, view: TableViewport): ScreenPoint {
  if (seat === localSeat) {
    return localAnchor(view)
  }
  return seatMedallion(seat, localSeat, playerCount, view)
}

/** Anchor of a player's name and reactions: their portrait. */
export function seatLabelAnchor(seat: number, localSeat: number, playerCount: number, view: TableViewport): ScreenPoint {
  return seatMedallion(seat, localSeat, playerCount, view)
}

/** Won tricks are not piled on the felt any more: counts live in the player sheet. */
export function wonCountInTag(_view: { width: number, height: number }) {
  return true
}

/** Where a won trick is swept to: the winner's portrait (local: your own). */
export function wonPileAnchor(seat: number, localSeat: number, playerCount: number, view: TableViewport): ScreenPoint {
  return seatMedallion(seat, localSeat, playerCount, view)
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
  5: [[0, 0.62], [-0.66, 0.12], [-0.33, -0.56], [0.33, -0.56], [0.66, 0.12]]
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
    y
  }
}

/** Cards in front of a player lean toward them (degrees). */
export function seatTrickTilt(seat: number, localSeat: number, playerCount: number): number {
  const rel = (seat - localSeat + playerCount) % playerCount
  const offsets: Record<number, number[]> = {
    3: [0, 14, -14],
    4: [0, 12, 0, -12],
    5: [0, 16, 6, -6, -16]
  }
  return offsets[playerCount]?.[rel] ?? 0
}
