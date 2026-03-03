import { getSeasonType, getSeasonYear, seasonToYear, currentSeason, seasonRange } from '../season-utils';

describe('getSeasonType', () => {
  it('identifies regular season games', () => {
    expect(getSeasonType('0022400061')).toBe('Regular Season');
    expect(getSeasonType('0022500001')).toBe('Regular Season');
  });

  it('identifies playoff games', () => {
    expect(getSeasonType('0042400101')).toBe('Playoffs');
  });

  it('identifies play-in games', () => {
    expect(getSeasonType('0052400101')).toBe('Play-In');
  });

  it('identifies all-star games', () => {
    expect(getSeasonType('0062400101')).toBe('All Star');
  });

  it('returns Unknown for unrecognized prefixes', () => {
    expect(getSeasonType('0092400101')).toBe('Unknown');
    expect(getSeasonType('abc')).toBe('Unknown');
  });
});

describe('getSeasonYear', () => {
  it('returns the same calendar year for games in Jul-Dec', () => {
    expect(getSeasonYear('2024-10-22T00:00:00Z')).toBe(2024);
    expect(getSeasonYear('2024-12-25T00:00:00Z')).toBe(2024);
    expect(getSeasonYear('2025-07-01T00:00:00Z')).toBe(2025);
  });

  it('returns the prior calendar year for games in Jan-June', () => {
    expect(getSeasonYear('2025-01-15T00:00:00Z')).toBe(2024);
    expect(getSeasonYear('2025-03-01T00:00:00Z')).toBe(2024);
    expect(getSeasonYear('2025-06-15T00:00:00Z')).toBe(2024);
  });

  it('handles date-only strings', () => {
    expect(getSeasonYear('2024-10-22')).toBe(2024);
  });
});

describe('seasonToYear', () => {
  it('extracts the start year from a season string', () => {
    expect(seasonToYear('2024-25')).toBe(2024);
    expect(seasonToYear('2020-21')).toBe(2020);
    expect(seasonToYear('1999-00')).toBe(1999);
  });

  it('throws on invalid input', () => {
    expect(() => seasonToYear('invalid')).toThrow('Invalid season string');
  });
});

describe('currentSeason', () => {
  it('returns a valid season string in YYYY-YY format', () => {
    const season = currentSeason();
    expect(season).toMatch(/^\d{4}-\d{2}$/);
  });

  it('returns a reasonable season year', () => {
    const year = seasonToYear(currentSeason());
    const now = new Date();
    const currentYear = now.getFullYear();
    // The season year should be either this year or last year
    expect(year).toBeGreaterThanOrEqual(currentYear - 1);
    expect(year).toBeLessThanOrEqual(currentYear);
  });
});

describe('seasonRange', () => {
  it('generates a range of season strings', () => {
    expect(seasonRange('2020-21', '2023-24')).toEqual([
      '2020-21', '2021-22', '2022-23', '2023-24',
    ]);
  });

  it('returns a single season when start equals end', () => {
    expect(seasonRange('2024-25', '2024-25')).toEqual(['2024-25']);
  });

  it('returns empty array when end is before start', () => {
    expect(seasonRange('2024-25', '2020-21')).toEqual([]);
  });

  it('handles century boundary correctly', () => {
    expect(seasonRange('1999-00', '2001-02')).toEqual([
      '1999-00', '2000-01', '2001-02',
    ]);
  });
});
