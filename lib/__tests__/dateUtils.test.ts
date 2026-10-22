import { utcToLocalDate, parseGameDate, formatDate, parseLocalDate } from '../dateUtils';

describe('utcToLocalDate', () => {
  it('returns a valid Date object', () => {
    const result = utcToLocalDate('2024-01-15T00:00:00');
    expect(result).toBeInstanceOf(Date);
    expect(isNaN(result.getTime())).toBe(false);
  });

  it('preserves the date as local time (no UTC shift)', () => {
    const result = utcToLocalDate('2025-03-01 00:00:00');
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(2); // March = 2 (0-indexed)
    expect(result.getDate()).toBe(1);
  });

  it('handles date-only strings', () => {
    const result = utcToLocalDate('2024-03-10');
    expect(result).toBeInstanceOf(Date);
    expect(isNaN(result.getTime())).toBe(false);
  });

  it('strips Z suffix to prevent UTC interpretation', () => {
    const result = utcToLocalDate('2025-03-01T00:00:00Z');
    expect(result.getDate()).toBe(1);
    expect(result.getMonth()).toBe(2);
  });

  it('returns a valid Date for datetime strings', () => {
    const result = utcToLocalDate('2023-12-25T19:30:00');
    expect(result).toBeInstanceOf(Date);
    expect(isNaN(result.getTime())).toBe(false);
  });
});

describe('parseGameDate', () => {
  it('returns the same Date object if passed a Date', () => {
    const date = new Date('2024-01-15');
    const result = parseGameDate(date);
    expect(result).toBe(date);
  });

  it('parses a string as local time (not UTC)', () => {
    const result = parseGameDate('2025-03-01 00:00:00');
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(2);
    expect(result.getDate()).toBe(1);
  });

  it('strips Z suffix to prevent UTC interpretation', () => {
    const result = parseGameDate('2025-03-01T00:00:00Z');
    expect(result.getDate()).toBe(1);
    expect(result.getMonth()).toBe(2);
  });

  it('parses with or without Z consistently', () => {
    const withZ = parseGameDate('2024-06-01T12:00:00Z');
    const withoutZ = parseGameDate('2024-06-01T12:00:00');
    expect(withZ.getTime()).toBe(withoutZ.getTime());
  });
});

describe('formatDate', () => {
  const date = new Date(2026, 9, 21); // Wednesday, Oct 21 2026 (local)

  it.each([
    ['yyyy-MM-dd', '2026-10-21'],
    ['MM-dd-yy', '10-21-26'],
    ['MM/dd', '10/21'],
    ['MMM d, yyyy', 'Oct 21, 2026'],
    ['EEEE, MMMM do', 'Wednesday, October 21st'],
  ])('formats %s', (pattern, expected) => {
    expect(formatDate(date, pattern)).toBe(expected);
  });

  it('pads single-digit months and days', () => {
    expect(formatDate(new Date(2027, 0, 5), 'MM-dd-yy')).toBe('01-05-27');
    expect(formatDate(new Date(2027, 0, 5), 'MMM d, yyyy')).toBe('Jan 5, 2027');
  });

  it.each([
    [1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'],
    [12, '12th'], [13, '13th'], [21, '21st'], [22, '22nd'], [23, '23rd'], [31, '31st'],
  ])('uses the right ordinal for day %i', (day, expected) => {
    expect(formatDate(new Date(2026, 0, day), 'do')).toBe(expected);
  });
});

describe('parseLocalDate', () => {
  it('parses yyyy-MM-dd as local midnight', () => {
    const result = parseLocalDate('2026-03-01');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2);
    expect(result.getDate()).toBe(1);
    expect(result.getHours()).toBe(0);
  });
});
