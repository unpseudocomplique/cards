import {
  applyBid,
  createBidState,
  expectedSeat,
  type Contract,
} from './bid'
import {
  callableCards,
  poigneeCards,
  poigneePrimeForTier,
  poigneeTiers,
} from './announces'
import { dealHands } from './deal'
import { mergeChienIntoHand, validateEcart } from './ecart'
import { attackSeats, isAttackSeat } from './camps'
import { legalMovesForSeat } from './legalMoves'
import { computeDealScore } from './score'
import { resolveTrick } from './trick'
import type {
  Actor,
  ApplyResult,
  GameEvent,
  GameState,
  Intent,
  PlayerCount,
} from './types'
import type { BotLevel, CardId } from './types'

export const BOT_LEVELS: BotLevel[] = ['facile', 'moyen', 'difficile']
export const DEFAULT_BOT_LEVEL: BotLevel = 'moyen'
/** A player who leaves or drops is replaced by a bot that plays as well as it can. */
export const TAKEOVER_BOT_LEVEL: BotLevel = 'difficile'

export function isBotLevel(value: unknown): value is BotLevel {
  return typeof value === 'string' && (BOT_LEVELS as string[]).includes(value)
}

function chienSize(playerCount: PlayerCount): 6 | 3 {
  return playerCount === 5 ? 3 : 6
}

/** Cards in each hand once the deal is over (after the écart). */
function handSize(playerCount: PlayerCount): number {
  return playerCount === 3 ? 24 : playerCount === 5 ? 15 : 18
}

function success(state: GameState, events: GameEvent[]): ApplyResult {
  return {
    ok: true,
    state: { ...state, version: state.version + 1 },
    events,
  }
}

function failure(
  error: Extract<ApplyResult, { ok: false }>['error'],
  reason: string,
): ApplyResult {
  return { ok: false, error, reason }
}

function findSeatByUserId(state: GameState, userId: string): number | null {
  const seat = state.seats.find(s => s.userId === userId)
  return seat?.seatId ?? null
}

function isHost(state: GameState, userId: string): boolean {
  return state.hostUserId === userId
}

function allSeatsFilled(state: GameState): boolean {
  return state.seats.every(seat => seat.userId !== null)
}

function actorSeat(state: GameState, actor: Actor): number | null {
  if (actor.seat !== undefined) {
    return actor.seat
  }
  return findSeatByUserId(state, actor.userId)
}

function seatControlsTurn(state: GameState, seat: number): boolean {
  const info = state.seats[seat]
  if (!info?.userId) {
    return false
  }
  return true
}

function requireTurnSeat(state: GameState, actor: Actor): number | ApplyResult {
  const seat = actorSeat(state, actor)
  if (seat === null) {
    return failure('UNAUTHORIZED', 'Actor has no seat at this table')
  }
  if (state.currentSeat !== seat) {
    return failure('NOT_YOUR_TURN', `Expected seat ${state.currentSeat}, got ${seat}`)
  }
  if (!seatControlsTurn(state, seat)) {
    return failure('UNAUTHORIZED', `Seat ${seat} is empty`)
  }
  return seat
}

function removeOneCard(hand: CardId[], card: CardId): CardId[] {
  const index = hand.indexOf(card)
  if (index === -1) {
    throw new Error(`Card ${card} not in hand`)
  }
  const next = [...hand]
  next.splice(index, 1)
  return next
}

function nextSeat(state: GameState, seat: number): number {
  return (seat + 1) % state.playerCount
}

function firstBidderSeat(state: GameState): number {
  return (state.dealerSeat + 1) % state.playerCount
}

function firstLeaderSeat(state: GameState): number {
  return (state.dealerSeat + 1) % state.playerCount
}

function makeRng(counter: number): () => number {
  let seed = counter + 1
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 0x100000000
  }
}

function resetDealFields(state: GameState): GameState {
  return {
    ...state,
    hands: Array.from({ length: state.playerCount }, () => [] as CardId[]),
    chien: [],
    dogShown: undefined,
    dogSeen: undefined,
    playedTricks: [],
    ecart: [],
    bidState: null,
    bid: null,
    bidSpoken: [],
    partnerSeat: undefined,
    calledKing: undefined,
    trick: [],
    pilesAttack: [],
    pilesDefense: [],
    poignees: undefined,
    ecartShownTrumps: undefined,
    excuseOwedBy: undefined,
    petitTrick: undefined,
    chelemAnnounce: undefined,
    attackTricks: 0,
    defenseTricks: 0,
    tricksWonBySeat: Array.from({ length: state.playerCount }, () => 0),
    lastTrick: null,
    lastTrickWinnerSeat: null,
    petitAuBoutCamp: undefined,
    lastDeltas: undefined,
    matchShouldEnd: undefined,
  }
}

function performDeal(
  state: GameState,
  options: { incrementDealIndex: boolean },
): {
  state: GameState
  events: GameEvent[]
} {
  let rngCounter = state.rngCounter
  let dealResult = dealHands(state.playerCount, makeRng(rngCounter))
  rngCounter++
  let attempts = 1
  const events: GameEvent[] = []

  while (dealResult.petitSecSeats.length > 0 && attempts < 10) {
    events.push({ type: 'redeal', reason: 'petit_sec' })
    dealResult = dealHands(state.playerCount, makeRng(rngCounter))
    rngCounter++
    attempts++
  }

  const bidState = createBidState(state.playerCount, firstBidderSeat(state))
  const next: GameState = {
    ...resetDealFields(state),
    phase: 'Bidding',
    rngCounter,
    dealIndex: state.dealIndex + (options.incrementDealIndex ? 1 : 0),
    hands: dealResult.hands.map(hand => [...hand]),
    chien: [...dealResult.chien],
    bidState,
    bidSpoken: [],
    currentSeat: expectedSeat(bidState),
  }

  events.push({ type: 'dealt', dealIndex: next.dealIndex })
  return { state: next, events }
}

function enterContractWon(state: GameState, seat: number, contract: Contract): GameState {
  const bid = { seat, contract }
  const base: GameState = {
    ...state,
    bid,
    bidState: null,
    bidSpoken: state.bidState?.spoken ?? state.bidSpoken,
  }

  if (contract === 'garde_sans' || contract === 'garde_contre') {
    return {
      ...base,
      phase: 'ReadyToPlay',
      currentSeat: firstLeaderSeat(state),
      trick: [],
    }
  }

  const dogEcarta: GameState = {
    ...base,
    phase: 'DogEcarta',
    currentSeat: seat,
  }
  // 5 players: the taker calls a king before the dog is turned over.
  if (state.playerCount === 5) {
    return dogEcarta
  }
  return takeDog(dogEcarta, seat)
}

/** Turn the dog face up for everyone and put it in the taker's hand. */
function takeDog(state: GameState, seat: number): GameState {
  const takerHand = mergeChienIntoHand(state.hands[seat]!, state.chien)
  const hands = state.hands.map((hand, index) => (index === seat ? takerHand : [...hand]))
  return {
    ...state,
    hands,
    dogShown: [...state.chien],
    dogSeen: [...state.chien],
    chien: [],
  }
}

/**
 * The Excuse goes back to its camp, which owes the winners a low card in
 * exchange (settled at scoring). On the last trick it is not taken back: it
 * goes to the camp winning the trick (FFT), unless it won the trick itself
 * (chelem, see `resolveCompletedTrick`).
 */
function distributeTrickCards(
  state: GameState,
  winnerSeat: number,
  lastTrick: boolean,
): Pick<GameState, 'pilesAttack' | 'pilesDefense' | 'excuseOwedBy'> {
  const pilesAttack = [...state.pilesAttack]
  const pilesDefense = [...state.pilesDefense]
  let excuseOwedBy = state.excuseOwedBy
  const winnerAttack = isAttackSeat(state, winnerSeat)

  for (const { seat, card } of state.trick) {
    let toAttack = winnerAttack
    if (card === 'excuse' && !lastTrick) {
      toAttack = isAttackSeat(state, seat)
      if (toAttack !== winnerAttack) {
        excuseOwedBy = toAttack ? 'attack' : 'defense'
      }
    }
    ;(toAttack ? pilesAttack : pilesDefense).push(card)
  }

  return { pilesAttack, pilesDefense, excuseOwedBy }
}

function allHandsEmpty(state: GameState): boolean {
  return state.hands.every(hand => hand.length === 0)
}

function resolveChelemOutcome(state: GameState): Parameters<typeof computeDealScore>[0]['chelem'] {
  const attackChelem = state.defenseTricks === 0 && state.attackTricks > 0
  const defenseChelem = state.attackTricks === 0 && state.defenseTricks > 0

  if (state.chelemAnnounce === 'announced') {
    return attackChelem ? 'announced_made' : 'announced_failed'
  }
  if (state.chelemAnnounce === 'defense') {
    return defenseChelem ? 'defense' : undefined
  }
  if (attackChelem) {
    return 'unannounced_made'
  }
  if (defenseChelem) {
    return 'defense'
  }
  return undefined
}

function scoreDeal(state: GameState): { state: GameState, events: GameEvent[] } {
  const takerSeat = state.bid!.seat
  const contract = state.bid!.contract
  const takerCards = [...state.pilesAttack]
  if (contract === 'garde_sans') {
    // Garde sans: the dog counts for the taker.
    takerCards.push(...state.chien)
  } else if (contract !== 'garde_contre') {
    takerCards.push(...state.ecart)
  }
  // Garde contre: the dog belongs to the defence, nothing to add.

  const takerPointsAdjust = state.excuseOwedBy === 'attack'
    ? -0.5
    : state.excuseOwedBy === 'defense' ? 0.5 : 0

  const poigneePrime = (state.poignees ?? [])
    .reduce((total, entry) => total + (poigneePrimeForTier(state.playerCount, entry.tier) ?? 0), 0)

  const deltas = computeDealScore({
    playerCount: state.playerCount,
    contract,
    takerSeat,
    partnerSeat: state.partnerSeat,
    takerCards,
    takerPointsAdjust,
    defenseCards: state.pilesDefense,
    poigneePrime: poigneePrime || undefined,
    petitAuBoutCamp: state.petitAuBoutCamp,
    chelem: resolveChelemOutcome(state),
  })

  const scores = state.scores.map((score, seat) => score + (deltas[seat] ?? 0))
  const events: GameEvent[] = [{ type: 'dealScored', deltas }]

  const thresholdReached =
    state.endMode === 'threshold'
    && scores.some(score => Math.abs(score) >= state.endValue)
  const dealsReached =
    state.endMode === 'deals'
    && state.dealIndex >= state.endValue

  return {
    state: {
      ...state,
      phase: 'Scoring',
      scores,
      lastDeltas: deltas,
      matchShouldEnd: thresholdReached || dealsReached,
      currentSeat: state.dealerSeat,
    },
    events,
  }
}

function handleContinue(state: GameState, actor: Actor): ApplyResult {
  if (state.phase !== 'Scoring') {
    return failure('WRONG_PHASE', 'Continue is only valid during Scoring')
  }
  if (!isHost(state, actor.userId) && actorSeat(state, actor) === null) {
    return failure('UNAUTHORIZED', 'Only seated players or the host may continue')
  }

  if (state.matchShouldEnd) {
    return success(
      {
        ...state,
        phase: 'MatchOver',
        matchShouldEnd: undefined,
      },
      [{ type: 'matchOver' }],
    )
  }

  const dealerSeat = nextSeat(state, state.dealerSeat)
  const redealt = performDeal(
    {
      ...state,
      phase: 'Dealing',
      dealerSeat,
      lastDeltas: undefined,
      matchShouldEnd: undefined,
    },
    { incrementDealIndex: true },
  )
  return success(redealt.state, redealt.events)
}

function resolvePartnerSeat(
  state: GameState,
  king: CardId,
  takerSeat: number,
): number | undefined {
  for (let seat = 0; seat < state.playerCount; seat++) {
    if (state.hands[seat]?.includes(king)) {
      return seat === takerSeat ? undefined : seat
    }
  }
  // King still in dog (garde sans/contre) or unknown → taker alone
  return undefined
}

function resolveCompletedTrick(state: GameState): ApplyResult {
  const lastTrick = allHandsEmpty(state)
  const previousTricks = state.attackTricks + state.defenseTricks
  let { winnerSeat } = resolveTrick(state.trick)

  // FFT: the Excuse played on the last trick by a camp that won every trick
  // before (chelem) wins that trick.
  const excuseEntry = state.trick.find(entry => entry.card === 'excuse')
  let excuseWonChelem = false
  if (lastTrick && excuseEntry && previousTricks > 0) {
    const campTricks = isAttackSeat(state, excuseEntry.seat) ? state.attackTricks : state.defenseTricks
    if (campTricks === previousTricks) {
      winnerSeat = excuseEntry.seat
      excuseWonChelem = true
    }
  }

  const piles = distributeTrickCards(state, winnerSeat, lastTrick)
  const events: GameEvent[] = [{ type: 'trickWon', seat: winnerSeat }]
  const attackWon = isAttackSeat(state, winnerSeat)
  const winnerCamp = attackWon ? 'attack' as const : 'defense' as const
  const petitInTrick = state.trick.some(entry => entry.card === 'trump-1')
  const tricksWonBySeat = state.tricksWonBySeat.map((count, seat) =>
    seat === winnerSeat ? count + 1 : count,
  )

  let next: GameState = {
    ...state,
    ...piles,
    trick: [],
    lastTrick: state.trick.map(entry => ({ ...entry })),
    playedTricks: [...(state.playedTricks ?? []), state.trick.map(entry => ({ ...entry }))],
    lastTrickWinnerSeat: winnerSeat,
    currentSeat: winnerSeat,
    attackTricks: state.attackTricks + (attackWon ? 1 : 0),
    defenseTricks: state.defenseTricks + (attackWon ? 0 : 1),
    tricksWonBySeat,
    petitTrick: petitInTrick ? { number: previousTricks + 1, camp: winnerCamp } : state.petitTrick,
  }

  if (lastTrick) {
    if (petitInTrick) {
      next = { ...next, petitAuBoutCamp: winnerCamp }
    }
    else if (excuseWonChelem && state.petitTrick?.number === previousTricks) {
      // Chelem with the Excuse played last: the Petit is "au bout" on the
      // second-to-last trick.
      next = { ...next, petitAuBoutCamp: state.petitTrick.camp }
    }
    next = { ...next, phase: 'Scoring' }
    const scored = scoreDeal(next)
    return success({ ...next, ...scored.state, version: state.version }, [...events, ...scored.events])
  }

  return success({ ...next, phase: 'Trick' }, events)
}

function handleJoin(state: GameState, intent: Extract<Intent, { type: 'join' }>, actor: Actor): ApplyResult {
  if (state.phase !== 'Lobby') {
    return failure('WRONG_PHASE', 'Can only join during Lobby')
  }
  if (findSeatByUserId(state, actor.userId) !== null) {
    return failure('ILLEGAL_MOVE', 'Already seated at this table')
  }
  const emptyIndex = state.seats.findIndex(seat => seat.userId === null)
  if (emptyIndex === -1) {
    return failure('TABLE_FULL', 'No empty seats')
  }

  const seats = state.seats.map((seat, index) =>
    index === emptyIndex
      ? {
          ...seat,
          userId: actor.userId,
          name: intent.name,
          connected: true,
          controlledBy: 'human' as const,
        }
      : seat,
  )

  return success(
    { ...state, seats },
    [{ type: 'joined', seat: emptyIndex, userId: actor.userId }],
  )
}

function handleAddBot(state: GameState, intent: Extract<Intent, { type: 'addBot' }>, actor: Actor): ApplyResult {
  if (state.phase !== 'Lobby') {
    return failure('WRONG_PHASE', 'Can only add bots during Lobby')
  }
  if (!isHost(state, actor.userId)) {
    return failure('UNAUTHORIZED', 'Only the host can add bots')
  }
  const emptyIndex = state.seats.findIndex(seat => seat.userId === null)
  if (emptyIndex === -1) {
    return failure('TABLE_FULL', 'No empty seats')
  }
  const botId = `bot:${emptyIndex + 1}`
  const seats = state.seats.map((seat, index) =>
    index === emptyIndex
      ? {
          ...seat,
          userId: botId,
          name: intent.name ?? `Bot ${emptyIndex + 1}`,
          connected: true,
          controlledBy: 'bot' as const,
          botLevel: isBotLevel(intent.level) ? intent.level : DEFAULT_BOT_LEVEL,
        }
      : seat,
  )
  return success({ ...state, seats }, [{ type: 'botAdded', seat: emptyIndex }])
}

function handleSetBotLevel(state: GameState, intent: Extract<Intent, { type: 'setBotLevel' }>, actor: Actor): ApplyResult {
  if (state.phase !== 'Lobby') {
    return failure('WRONG_PHASE', 'Bot level can only change in the Lobby')
  }
  if (!isHost(state, actor.userId)) {
    return failure('UNAUTHORIZED', 'Only the host can change a bot level')
  }
  const seatInfo = state.seats[intent.seat]
  if (!seatInfo || seatInfo.controlledBy !== 'bot') {
    return failure('ILLEGAL_MOVE', 'Seat is not controlled by a bot')
  }
  if (!isBotLevel(intent.level)) {
    return failure('ILLEGAL_MOVE', `Unknown bot level ${String(intent.level)}`)
  }
  const seats = state.seats.map((seat, index) =>
    index === intent.seat ? { ...seat, botLevel: intent.level } : seat,
  )
  return success({ ...state, seats }, [])
}

function handleRemoveBot(state: GameState, intent: Extract<Intent, { type: 'removeBot' }>, actor: Actor): ApplyResult {
  if (state.phase !== 'Lobby') {
    return failure('WRONG_PHASE', 'Can only remove bots during Lobby')
  }
  if (!isHost(state, actor.userId)) {
    return failure('UNAUTHORIZED', 'Only the host can remove bots')
  }
  const seatInfo = state.seats[intent.seat]
  if (!seatInfo || seatInfo.controlledBy !== 'bot') {
    return failure('ILLEGAL_MOVE', 'Seat is not controlled by a bot')
  }
  const seats = state.seats.map((seat, index) =>
    index === intent.seat
      ? {
          seatId: seat.seatId,
          userId: null,
          name: '',
          connected: false,
          controlledBy: 'human' as const,
        }
      : seat,
  )
  return success({ ...state, seats }, [{ type: 'botRemoved', seat: intent.seat }])
}

function handleStart(state: GameState, actor: Actor): ApplyResult {
  if (state.phase !== 'Lobby') {
    return failure('WRONG_PHASE', 'Can only start from Lobby')
  }
  if (!isHost(state, actor.userId)) {
    return failure('UNAUTHORIZED', 'Only the host can start the game')
  }
  if (!allSeatsFilled(state)) {
    return failure('ILLEGAL_MOVE', 'All seats must be filled before starting')
  }

  const dealing = performDeal({ ...state, phase: 'Dealing' }, { incrementDealIndex: true })
  return success(dealing.state, [{ type: 'started' }, ...dealing.events])
}

function handleBid(state: GameState, intent: Extract<Intent, { type: 'bid' }>, actor: Actor): ApplyResult {
  if (state.phase !== 'Bidding' || !state.bidState) {
    return failure('WRONG_PHASE', 'Bidding is not active')
  }
  const seatOrError = requireTurnSeat(state, actor)
  if (typeof seatOrError !== 'number') {
    return seatOrError
  }
  const seat = seatOrError

  const result = applyBid(state.bidState, seat, intent.bid)
  if (!result.ok) {
    return failure('ILLEGAL_MOVE', result.reason)
  }

  const events: GameEvent[] = [{ type: 'bidSpoken', seat, bid: intent.bid }]
  let next: GameState = {
    ...state,
    bidState: result.state,
    bidSpoken: result.state.spoken,
    currentSeat: result.outcome ? state.currentSeat : expectedSeat(result.state),
  }

  if (result.outcome?.type === 'all_pass') {
    events.push({ type: 'redeal', reason: 'all_pass' })
    const dealerSeat = nextSeat(state, state.dealerSeat)
    const redealt = performDeal(
      {
        ...next,
        phase: 'Dealing',
        dealerSeat,
      },
      { incrementDealIndex: false },
    )
    return success(redealt.state, [...events, ...redealt.events])
  }

  if (result.outcome?.type === 'won') {
    events.push({
      type: 'contractWon',
      seat: result.outcome.seat,
      contract: result.outcome.contract,
    })
    next = enterContractWon(next, result.outcome.seat, result.outcome.contract)
  }

  return success(next, events)
}

function handleCallKing(state: GameState, intent: Extract<Intent, { type: 'callKing' }>, actor: Actor): ApplyResult {
  if (state.playerCount !== 5 || !state.bid) {
    return failure('WRONG_PHASE', 'King call is only valid in 5-player contracts')
  }
  if (state.phase !== 'DogEcarta' && state.phase !== 'ReadyToPlay') {
    return failure('WRONG_PHASE', 'King call is only valid after the contract is won')
  }
  if (state.calledKing) {
    return failure('ILLEGAL_MOVE', 'King already called')
  }
  const seat = actorSeat(state, actor)
  if (seat === null) {
    return failure('UNAUTHORIZED', 'Actor has no seat at this table')
  }
  if (seat !== state.bid.seat) {
    return failure('NOT_YOUR_TURN', 'Only the taker may call a king')
  }
  if (!callableCards(state.hands[seat] ?? []).includes(intent.king)) {
    return failure('ILLEGAL_MOVE', 'Must call a king (a queen only with the 4 kings, and so on)')
  }

  // A king left in the dog means the taker plays alone (resolved before taking it).
  const partnerSeat = resolvePartnerSeat(state, intent.king, state.bid.seat)
  const called: GameState = {
    ...state,
    calledKing: intent.king,
    partnerSeat,
  }
  const dogStillHidden = state.phase === 'DogEcarta' && state.chien.length > 0
  return success(dogStillHidden ? takeDog(called, seat) : called, [])
}

function requireCalledKingIfNeeded(state: GameState): ApplyResult | null {
  if (state.playerCount === 5 && state.bid && !state.calledKing) {
    return failure('WRONG_PHASE', 'Taker must call a king before continuing')
  }
  return null
}

function handleDiscard(state: GameState, intent: Extract<Intent, { type: 'discard' }>, actor: Actor): ApplyResult {
  if (state.phase !== 'DogEcarta' || !state.bid) {
    return failure('WRONG_PHASE', 'Discard is only valid during DogEcarta')
  }
  const kingError = requireCalledKingIfNeeded(state)
  if (kingError) {
    return kingError
  }
  const seatOrError = requireTurnSeat(state, actor)
  if (typeof seatOrError !== 'number') {
    return seatOrError
  }
  const seat = seatOrError
  if (seat !== state.bid.seat) {
    return failure('NOT_YOUR_TURN', 'Only the taker may discard')
  }

  const hand = state.hands[seat]!
  const validation = validateEcart(hand, intent.cards, chienSize(state.playerCount))
  if (!validation.ok) {
    return failure('ILLEGAL_MOVE', validation.reason)
  }

  let remaining = [...hand]
  for (const card of intent.cards) {
    remaining = removeOneCard(remaining, card)
  }

  const hands = state.hands.map((current, index) => (index === seat ? remaining : [...current]))
  return success(
    {
      ...state,
      phase: 'ReadyToPlay',
      hands,
      dogShown: undefined,
      ecart: [...intent.cards],
      ecartShownTrumps: validation.shownTrumps.length > 0 ? [...validation.shownTrumps] : undefined,
      currentSeat: firstLeaderSeat(state),
      trick: [],
    },
    [{ type: 'ecartLocked', seat }],
  )
}

function handleAnnouncePoignee(
  state: GameState,
  intent: Extract<Intent, { type: 'announcePoignee' }>,
  actor: Actor,
): ApplyResult {
  // FFT: shown just before the player plays their own first card.
  if (state.phase !== 'ReadyToPlay' && state.phase !== 'Trick') {
    return failure('WRONG_PHASE', 'Poignée can only be announced before your first card')
  }
  const kingError = requireCalledKingIfNeeded(state)
  if (kingError) {
    return kingError
  }
  if (!poigneeTiers(state.playerCount).includes(intent.tier)) {
    return failure('ILLEGAL_MOVE', `Invalid poignée tier ${intent.tier} for ${state.playerCount} players`)
  }

  const seatOrError = requireTurnSeat(state, actor)
  if (typeof seatOrError !== 'number') {
    return seatOrError
  }
  const seat = seatOrError
  const hand = state.hands[seat] ?? []
  if (hand.length !== handSize(state.playerCount)) {
    return failure('ILLEGAL_MOVE', 'Poignée can only be announced before your first card')
  }
  if (state.poignees?.some(entry => entry.seat === seat)) {
    return failure('ILLEGAL_MOVE', 'You already showed a poignée')
  }
  const cards = poigneeCards(hand, intent.tier)
  if (!cards) {
    return failure('ILLEGAL_MOVE', `Need ${intent.tier} trumps for this poignée`)
  }
  const poignees = [...(state.poignees ?? []), { seat, tier: intent.tier, cards }]
  return success({ ...state, poignees }, [])
}

function handleAnnounceChelem(
  state: GameState,
  intent: Extract<Intent, { type: 'announceChelem' }>,
  actor: Actor,
): ApplyResult {
  if (state.phase !== 'ReadyToPlay') {
    return failure('WRONG_PHASE', 'Chelem can only be announced before play')
  }
  const kingError = requireCalledKingIfNeeded(state)
  if (kingError) {
    return kingError
  }
  if (state.chelemAnnounce) {
    return failure('ILLEGAL_MOVE', 'Chelem already announced')
  }

  const seat = actorSeat(state, actor)
  if (seat === null) {
    return failure('UNAUTHORIZED', 'Actor has no seat at this table')
  }

  if (intent.kind === 'announced') {
    if (!state.bid || seat !== state.bid.seat) {
      return failure('UNAUTHORIZED', 'Only the taker may announce attack chelem')
    }
  } else if (isAttackSeat(state, seat)) {
    return failure('UNAUTHORIZED', 'Only defenders may announce defense chelem')
  }

  // FFT: the player who announced a chelem leads, whoever dealt.
  const currentSeat = intent.kind === 'announced' ? seat : state.currentSeat
  return success({ ...state, chelemAnnounce: intent.kind, currentSeat }, [])
}

function handlePlayCard(state: GameState, intent: Extract<Intent, { type: 'playCard' }>, actor: Actor): ApplyResult {
  if (state.phase !== 'Trick' && state.phase !== 'ReadyToPlay') {
    return failure('WRONG_PHASE', 'Cannot play a card in this phase')
  }
  if (!state.bid) {
    return failure('WRONG_PHASE', 'No contract established')
  }
  const kingError = requireCalledKingIfNeeded(state)
  if (kingError) {
    return kingError
  }

  const seatOrError = requireTurnSeat(state, actor)
  if (typeof seatOrError !== 'number') {
    return seatOrError
  }
  const seat = seatOrError
  const moves = legalMovesForSeat(state, seat)
  if (!moves.includes(intent.card)) {
    return failure('ILLEGAL_MOVE', `Card ${intent.card} is not a legal move`)
  }

  const hands = state.hands.map((current, index) =>
    index === seat ? removeOneCard(current, intent.card) : [...current],
  )
  const trick = [...state.trick, { seat, card: intent.card }]
  const events: GameEvent[] = [{ type: 'cardPlayed', seat, card: intent.card }]

  let next: GameState = {
    ...state,
    phase: 'Trick',
    hands,
    trick,
    currentSeat: nextSeat(state, seat),
    lastTrick: null,
    lastTrickWinnerSeat: null,
  }

  if (trick.length < state.playerCount) {
    return success(next, events)
  }

  return resolveCompletedTrick(next)
}

function handleLeave(state: GameState, actor: Actor): ApplyResult {
  const seat = actorSeat(state, actor)
  if (seat === null) {
    return failure('UNAUTHORIZED', 'Actor has no seat at this table')
  }
  const seats = state.seats.map((current, index) =>
    index === seat
      ? { ...current, connected: false, controlledBy: 'bot' as const, botLevel: current.botLevel ?? TAKEOVER_BOT_LEVEL }
      : current,
  )
  return success({ ...state, seats }, [])
}

export function apply(state: GameState, intent: Intent, actor: Actor): ApplyResult {
  switch (intent.type) {
    case 'join':
      return handleJoin(state, intent, actor)
    case 'addBot':
      return handleAddBot(state, intent, actor)
    case 'removeBot':
      return handleRemoveBot(state, intent, actor)
    case 'setBotLevel':
      return handleSetBotLevel(state, intent, actor)
    case 'start':
      return handleStart(state, actor)
    case 'bid':
      return handleBid(state, intent, actor)
    case 'callKing':
      return handleCallKing(state, intent, actor)
    case 'discard':
      return handleDiscard(state, intent, actor)
    case 'announcePoignee':
      return handleAnnouncePoignee(state, intent, actor)
    case 'announceChelem':
      return handleAnnounceChelem(state, intent, actor)
    case 'playCard':
      return handlePlayCard(state, intent, actor)
    case 'continue':
      return handleContinue(state, actor)
    case 'leave':
      return handleLeave(state, actor)
    default: {
      const _exhaustive: never = intent
      return failure('ILLEGAL_MOVE', `Unknown intent ${(_exhaustive as Intent).type}`)
    }
  }
}
