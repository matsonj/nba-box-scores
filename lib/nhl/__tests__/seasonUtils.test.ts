import {
  getNHLSeasonYearFromDate,
  getNHLAvailableSeasons,
  formatNHLSeasonLabel,
  isNHLPlayoffGame,
  getNHLSeasonTypeFromGameId,
  NHL_GAME_ID_PREFIXES,
} from '../seasonUtils';

describe('getNHLSeasonYearFromDate', () => {
  it('returns current year for October dates', () => {
    expect(getNHLSeasonYearFromDate(new Date('2024-10-15'))).toBe(2024);
  });

  it('returns current year for December dates', () => {
    expect(getNHLSeasonYearFromDate(new Date('2024-12-25'))).toBe(2024);
  });

  it('returns previous year for January dates', () => {
    expect(getNHLSeasonYearFromDate(new Date('2025-01-10'))).toBe(2024);
  });

  it('returns previous year for June dates', () => {
    expect(getNHLSeasonYearFromDate(new Date('2025-06-15'))).toBe(2024);
  });

  it('returns previous year for August dates', () => {
    expect(getNHLSeasonYearFromDate(new Date('2025-08-01'))).toBe(2024);
  });

  it('returns previous year for September dates (season not yet started)', () => {
    expect(getNHLSeasonYearFromDate(new Date('2025-09-20'))).toBe(2024);
  });
});

describe('getNHLAvailableSeasons', () => {
  it('returns an array of season years', () => {
    const seasons = getNHLAvailableSeasons();
    expect(seasons.length).toBeGreaterThan(0);
    expect(seasons[seasons.length - 1]).toBe(2015);
  });

  it('returns seasons in descending order', () => {
    const seasons = getNHLAvailableSeasons();
    for (let i = 1; i < seasons.length; i++) {
      expect(seasons[i]).toBeLessThan(seasons[i - 1]);
    }
  });
});

describe('formatNHLSeasonLabel', () => {
  it('formats a season year correctly', () => {
    expect(formatNHLSeasonLabel(2024)).toBe('2024-25');
    expect(formatNHLSeasonLabel(2023)).toBe('2023-24');
  });

  it('handles century boundary', () => {
    expect(formatNHLSeasonLabel(2099)).toBe('2099-00');
  });

  it('pads single-digit years', () => {
    expect(formatNHLSeasonLabel(2008)).toBe('2008-09');
  });
});

describe('isNHLPlayoffGame', () => {
  it('returns true for playoff game IDs', () => {
    // Game ID format: SSSSTTGGGG where SSSS=season, TT=type, GGGG=game number
    expect(isNHLPlayoffGame('2024030101')).toBe(true);
  });

  it('returns false for regular season game IDs', () => {
    expect(isNHLPlayoffGame('2024020101')).toBe(false);
  });

  it('returns false for preseason game IDs', () => {
    expect(isNHLPlayoffGame('2024010101')).toBe(false);
  });
});

describe('getNHLSeasonTypeFromGameId', () => {
  it('returns "Preseason" for preseason games', () => {
    expect(getNHLSeasonTypeFromGameId('2024010101')).toBe('Preseason');
  });

  it('returns "Regular Season" for regular season games', () => {
    expect(getNHLSeasonTypeFromGameId('2024020101')).toBe('Regular Season');
  });

  it('returns "Playoffs" for playoff games', () => {
    expect(getNHLSeasonTypeFromGameId('2024030101')).toBe('Playoffs');
  });

  it('returns "Unknown" for unrecognized prefixes', () => {
    expect(getNHLSeasonTypeFromGameId('2024990101')).toBe('Unknown');
  });
});

describe('NHL_GAME_ID_PREFIXES', () => {
  it('has the correct prefix values', () => {
    expect(NHL_GAME_ID_PREFIXES.PRESEASON).toBe('01');
    expect(NHL_GAME_ID_PREFIXES.REGULAR_SEASON).toBe('02');
    expect(NHL_GAME_ID_PREFIXES.PLAYOFFS).toBe('03');
  });
});
