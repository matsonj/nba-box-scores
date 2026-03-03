import { utcToLocalDate, parseGameDate } from '../dateUtils';

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
