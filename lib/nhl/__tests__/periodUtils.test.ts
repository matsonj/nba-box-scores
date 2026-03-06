import {
  getNHLPeriodsToShow,
  getNHLPeriodLabel,
  getNHLPeriodPoints,
  NHL_REGULAR_PERIODS,
  NHL_MAX_PERIODS,
} from '../periodUtils';

describe('getNHLPeriodsToShow', () => {
  it('returns 3 periods for a regulation game', () => {
    const scores = [
      { teamId: 'BOS', period: '1', points: 2 },
      { teamId: 'BOS', period: '2', points: 1 },
      { teamId: 'BOS', period: '3', points: 0 },
    ];
    expect(getNHLPeriodsToShow(scores)).toEqual([1, 2, 3]);
  });

  it('returns 4 periods for an OT game', () => {
    const scores = [
      { teamId: 'TOR', period: '1', points: 1 },
      { teamId: 'TOR', period: '2', points: 0 },
      { teamId: 'TOR', period: '3', points: 2 },
      { teamId: 'TOR', period: '4', points: 1 },
    ];
    expect(getNHLPeriodsToShow(scores)).toEqual([1, 2, 3, 4]);
  });

  it('returns 5 periods for a shootout game', () => {
    const scores = [
      { teamId: 'VGK', period: '5', points: 1 },
    ];
    expect(getNHLPeriodsToShow(scores)).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns 3 periods when no scores are provided', () => {
    expect(getNHLPeriodsToShow(undefined)).toEqual([1, 2, 3]);
  });

  it('caps at NHL_MAX_PERIODS (5)', () => {
    const scores = [
      { teamId: 'MTL', period: '7', points: 1 },
    ];
    expect(getNHLPeriodsToShow(scores)).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns at least 3 periods even if max period is less', () => {
    const scores = [
      { teamId: 'CHI', period: '2', points: 3 },
    ];
    expect(getNHLPeriodsToShow(scores)).toEqual([1, 2, 3]);
  });

  it('respects custom regularPeriods and maxPeriods', () => {
    const scores = [
      { teamId: 'EDM', period: '6', points: 1 },
    ];
    // Playoff-style: allow more OT periods
    expect(getNHLPeriodsToShow(scores, 3, 7)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('getNHLPeriodLabel', () => {
  it('returns ordinal labels for regulation periods', () => {
    expect(getNHLPeriodLabel(1)).toBe('1st');
    expect(getNHLPeriodLabel(2)).toBe('2nd');
    expect(getNHLPeriodLabel(3)).toBe('3rd');
  });

  it('returns "OT" for period 4 in regular season', () => {
    expect(getNHLPeriodLabel(4)).toBe('OT');
  });

  it('returns "SO" for period 5 in regular season', () => {
    expect(getNHLPeriodLabel(5)).toBe('SO');
  });

  it('returns "OT" for period 4 in playoffs', () => {
    expect(getNHLPeriodLabel(4, true)).toBe('OT');
  });

  it('returns "OT2" for period 5 in playoffs', () => {
    expect(getNHLPeriodLabel(5, true)).toBe('OT2');
  });

  it('returns "OT3" for period 6 in playoffs', () => {
    expect(getNHLPeriodLabel(6, true)).toBe('OT3');
  });

  it('accepts string period values', () => {
    expect(getNHLPeriodLabel('1')).toBe('1st');
    expect(getNHLPeriodLabel('4')).toBe('OT');
    expect(getNHLPeriodLabel('5')).toBe('SO');
  });
});

describe('getNHLPeriodPoints', () => {
  const periodScores = [
    { teamId: 'BOS', period: '1', points: 2 },
    { teamId: 'BOS', period: '2', points: 0 },
    { teamId: 'TOR', period: '1', points: 1 },
    { teamId: 'TOR', period: '2', points: 3 },
  ];

  it('returns points for a matching team and period', () => {
    expect(getNHLPeriodPoints(periodScores, 1, 'BOS')).toBe('2');
    expect(getNHLPeriodPoints(periodScores, 2, 'TOR')).toBe('3');
  });

  it('returns "-" when no matching score exists', () => {
    expect(getNHLPeriodPoints(periodScores, 3, 'BOS')).toBe('-');
  });

  it('returns "-" when team does not match', () => {
    expect(getNHLPeriodPoints(periodScores, 1, 'VGK')).toBe('-');
  });

  it('returns "-" when periodScores is undefined', () => {
    expect(getNHLPeriodPoints(undefined, 1, 'BOS')).toBe('-');
  });
});

describe('NHL period constants', () => {
  it('has correct values', () => {
    expect(NHL_REGULAR_PERIODS).toBe(3);
    expect(NHL_MAX_PERIODS).toBe(5);
  });
});
