/** Screen-space anchors for seats relative to the play scene box. */
export function seatAnchor(
  seat: number,
  localSeat: number,
  playerCount: number,
  width: number,
  height: number,
): { x: number, y: number } {
  const rel = (seat - localSeat + playerCount) % playerCount
  if (rel === 0) {
    return { x: width * 0.5, y: height * 0.86 }
  }

  const others = playerCount - 1
  const index = rel - 1
  const t = others === 1 ? 0.5 : index / (others - 1)
  const x = width * (0.14 + t * 0.72)
  const y = height * (0.14 + Math.sin(t * Math.PI) * 0.06 + (index === 0 || index === others - 1 ? 0.1 : 0))
  return { x, y }
}

/** Won-trick piles sit on the felt, pulled inward from seat avatars/UI. */
export function wonPileAnchor(
  seat: number,
  localSeat: number,
  playerCount: number,
  width: number,
  height: number,
): { x: number, y: number } {
  const seatPos = seatAnchor(seat, localSeat, playerCount, width, height)
  const tableCenter = { x: width * 0.5, y: height * 0.42 }
  const pull = seat === localSeat ? 0.22 : 0.34
  return {
    x: seatPos.x + (tableCenter.x - seatPos.x) * pull,
    y: seatPos.y + (tableCenter.y - seatPos.y) * pull,
  }
}
