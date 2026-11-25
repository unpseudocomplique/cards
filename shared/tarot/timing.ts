/**
 * End of a deal: the last trick stays on the felt this long (cards land, the
 * table reads who took it, then it is gathered) before the deal summary
 * covers the table. The server adds it to the summary's countdown so that
 * everybody still gets the full countdown once the summary is up.
 */
export const FINAL_TRICK_PAUSE_MS = 3_800
