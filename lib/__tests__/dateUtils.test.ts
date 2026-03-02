import { utcToLocalDate, parseGameDate } from '../dateUtils';

describe('utcToLocalDate', () => {
  it('returns a valid Date object', () => {
    const result = utcToLocalDate('2024-01-15T00:00:00');
    expect(result).toBeInstanceOf(Date);
    expect(isNaN(result.getTime())).toBe(false);
  });

  it('offsets by the local timezone so getUTCDate matches the original UTC date minus offset', () => {
    // The function shifts the timestamp so that local-time getters return the "UTC calendar date"
    // Verify the offset is applied consistently
    const input = '2024-01-15T12:00:00';
    const utcDate = new Date(input + 'Z');
    const result = utcToLocalDate(input);
    const expectedMs = utcDate.getTime() - utcDate.getTimezoneOffset() * 60000;
    expect(result.getTime()).toBe(expectedMs);
  });

  it('handles date-only strings', () => {
    const result = utcToLocalDate('2024-03-10');
    expect(result).toBeInstanceOf(Date);
    expect(isNaN(result.getTime())).toBe(false);
  });

  it('returns a valid Date for datetime strings', () => {
    const result = utcToLocalDate('2023-12-25T19:30:00');
    expect(result).toBeInstanceOf(Date);
    expect(isNaN(result.getTime())).toBe(false);
  });
});

describe('parseGameDate', () => {
  it('returns the same Date object if passed a Date', () => {
    const date = new Date('2024-01-15T00:00:00Z');
    const result = parseGameDate(date);
    expect(result).toBe(date);
  });

  it('parses a string without Z suffix by appending Z', () => {
    const result = parseGameDate('2024-01-15T00:00:00');
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe('2024-01-15T00:00:00.000Z');
  });

  it('parses a string that already has Z suffix', () => {
    const result = parseGameDate('2024-01-15T00:00:00Z');
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe('2024-01-15T00:00:00.000Z');
  });

  it('does not double-append Z', () => {
    const withZ = parseGameDate('2024-06-01T12:00:00Z');
    const withoutZ = parseGameDate('2024-06-01T12:00:00');
    expect(withZ.getTime()).toBe(withoutZ.getTime());
  });
});
