/**
 * Turn counter <-> date.
 *
 * `advance_turn_1008_29b4` is explicit about the rule: the year rises one a turn until
 * 1600, and from 1600 the season word alternates so the year moves every SECOND turn.
 * The switch is announced once, by the TIMECHANGE text, on the first turn of 1600.
 * `new_game_setup` starts a game at year 1492, turn 0, spring.
 *
 * This is a derived view, not a stored field -- `year`, `season` and `turnCounter` are
 * three separate words in the save and the game keeps them in step itself. An editor that
 * writes one without the others produces a save the game will happily load and then
 * display inconsistently, so `dateFromTurn` exists to keep them agreeing.
 */
export const START_YEAR = 1492;
/** From this year on, a year takes two turns. */
export const SEASON_YEAR = 1600;
/** Turns spent in the one-turn-per-year era: 1492..1599. */
export const SINGLE_SEASON_TURNS = SEASON_YEAR - START_YEAR;

export interface GameDate {
  year: number;
  /** 0 = spring, 1 = autumn. Always 0 before 1600. */
  season: 0 | 1;
}

export function dateFromTurn(turn: number): GameDate {
  if (turn < SINGLE_SEASON_TURNS) return { year: START_YEAR + turn, season: 0 };
  const after = turn - SINGLE_SEASON_TURNS;
  return { year: SEASON_YEAR + (after >> 1), season: (after & 1) as 0 | 1 };
}

export function turnFromDate(d: GameDate): number {
  if (d.year < SEASON_YEAR) return d.year - START_YEAR;
  return SINGLE_SEASON_TURNS + (d.year - SEASON_YEAR) * 2 + d.season;
}
