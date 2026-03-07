import { getPeriodsToShow, getPeriodLabel, getPeriodPoints } from '../periodUtils';

describe('getPeriodsToShow', () => {
  it('returns 4 periods for a regulation game', () => {
    const scores = [
      { teamId: 'LAL', period: '1', points: 25 },
      { teamId: 'LAL', period: '2', points: 30 },
      { teamId: 'LAL', period: '3', points: 28 },
      { teamId: 'LAL', period: '4', points: 22 },
    ];
    expect(getPeriodsToShow(scores)).toEqual([1, 2, 3, 4]);
  });

  it('returns 5 periods for a single OT game', () => {
    const scores = [
      { teamId: 'BOS', period: '1', points: 25 },
      { teamId: 'BOS', period: '2', points: 30 },
      { teamId: 'BOS', period: '3', points: 28 },
      { teamId: 'BOS', period: '4', points: 22 },
      { teamId: 'BOS', period: '5', points: 10 },
    ];
    expect(getPeriodsToShow(scores)).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns 6 periods for a double OT game', () => {
    const scores = [
      { teamId: 'GSW', period: '6', points: 8 },
    ];
    expect(getPeriodsToShow(scores)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('returns empty array when no scores are provided', () => {
    expect(getPeriodsToShow(undefined)).toEqual([]);
  });

  it('caps at MAX_PERIODS (8)', () => {
    const scores = [
      { teamId: 'MIA', period: '10', points: 5 },
    ];
    expect(getPeriodsToShow(scores)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('returns at least 4 periods even if max period is less', () => {
    const scores = [
      { teamId: 'CHI', period: '2', points: 30 },
    ];
    expect(getPeriodsToShow(scores)).toEqual([1, 2, 3, 4]);
  });
});

describe('getPeriodLabel', () => {
  it('returns the period number for regulation periods', () => {
    expect(getPeriodLabel(1)).toBe('1');
    expect(getPeriodLabel(2)).toBe('2');
    expect(getPeriodLabel(3)).toBe('3');
    expect(getPeriodLabel(4)).toBe('4');
  });

  it('returns "OT" for first overtime', () => {
    expect(getPeriodLabel(5)).toBe('OT');
  });

  it('returns "OT2" for second overtime', () => {
    expect(getPeriodLabel(6)).toBe('OT2');
  });

  it('returns "OT3" for third overtime', () => {
    expect(getPeriodLabel(7)).toBe('OT3');
  });

  it('returns "OT4" for fourth overtime', () => {
    expect(getPeriodLabel(8)).toBe('OT4');
  });
});

describe('getPeriodPoints', () => {
  const periodScores = [
    { teamId: 'LAL', period: '1', points: 25 },
    { teamId: 'LAL', period: '2', points: 30 },
    { teamId: 'BOS', period: '1', points: 28 },
    { teamId: 'BOS', period: '2', points: 22 },
  ];

  it('returns points for a matching team and period', () => {
    expect(getPeriodPoints(periodScores, 1, 'LAL')).toBe('25');
    expect(getPeriodPoints(periodScores, 2, 'BOS')).toBe('22');
  });

  it('returns "-" when no matching score exists', () => {
    expect(getPeriodPoints(periodScores, 3, 'LAL')).toBe('-');
  });

  it('returns "-" when team does not match', () => {
    expect(getPeriodPoints(periodScores, 1, 'GSW')).toBe('-');
  });

  it('returns "-" when periodScores is undefined', () => {
    expect(getPeriodPoints(undefined, 1, 'LAL')).toBe('-');
  });
});
