import { sanitizeNumericId, escapeSqlString, sanitizeTeamAbbreviation } from '../queryUtils';

describe('sanitizeNumericId', () => {
  it('passes valid numeric IDs', () => {
    expect(sanitizeNumericId('12345')).toBe('12345');
    expect(sanitizeNumericId('0021400001')).toBe('0021400001');
    expect(sanitizeNumericId('0')).toBe('0');
  });

  it('throws on SQL injection attempt', () => {
    expect(() => sanitizeNumericId("'; DROP TABLE --")).toThrow('Invalid numeric ID');
  });

  it('throws on alphabetic input', () => {
    expect(() => sanitizeNumericId('abc')).toThrow('Invalid numeric ID');
  });

  it('throws on empty string', () => {
    expect(() => sanitizeNumericId('')).toThrow('Invalid numeric ID');
  });

  it('throws on mixed alphanumeric input', () => {
    expect(() => sanitizeNumericId('123abc')).toThrow('Invalid numeric ID');
  });
});

describe('escapeSqlString', () => {
  it('doubles single quotes', () => {
    expect(escapeSqlString("O'Brien")).toBe("O''Brien");
  });

  it('handles multiple single quotes', () => {
    expect(escapeSqlString("it's a test's case")).toBe("it''s a test''s case");
  });

  it('returns unchanged string with no quotes', () => {
    expect(escapeSqlString('hello')).toBe('hello');
  });
});

describe('sanitizeTeamAbbreviation', () => {
  it('passes valid team abbreviations', () => {
    expect(sanitizeTeamAbbreviation('LAL')).toBe('LAL');
    expect(sanitizeTeamAbbreviation('BOS')).toBe('BOS');
    expect(sanitizeTeamAbbreviation('GSW')).toBe('GSW');
  });

  it('throws on lowercase input', () => {
    expect(() => sanitizeTeamAbbreviation('la')).toThrow('Invalid team abbreviation');
  });

  it('throws on too-long input', () => {
    expect(() => sanitizeTeamAbbreviation('LAKERS')).toThrow('Invalid team abbreviation');
  });

  it('throws on input with digits', () => {
    expect(() => sanitizeTeamAbbreviation('L4L')).toThrow('Invalid team abbreviation');
  });
});
