import { getTeamName, teamNames, TEAM_ABBREVIATIONS } from '../teams';

describe('getTeamName', () => {
  it('returns the full team name for valid abbreviations', () => {
    expect(getTeamName('LAL')).toBe('Los Angeles Lakers');
    expect(getTeamName('BOS')).toBe('Boston Celtics');
    expect(getTeamName('GSW')).toBe('Golden State Warriors');
    expect(getTeamName('NYK')).toBe('New York Knicks');
  });

  it('returns the abbreviation itself for unknown teams', () => {
    expect(getTeamName('XYZ')).toBe('XYZ');
    expect(getTeamName('')).toBe('');
  });
});

describe('TEAM_ABBREVIATIONS', () => {
  it('contains 30 NBA teams', () => {
    expect(TEAM_ABBREVIATIONS).toHaveLength(30);
  });

  it('contains all expected teams', () => {
    expect(TEAM_ABBREVIATIONS).toContain('LAL');
    expect(TEAM_ABBREVIATIONS).toContain('BOS');
    expect(TEAM_ABBREVIATIONS).toContain('GSW');
  });
});

describe('teamNames', () => {
  it('has an entry for every abbreviation', () => {
    for (const abbr of TEAM_ABBREVIATIONS) {
      expect(teamNames[abbr]).toBeDefined();
      expect(typeof teamNames[abbr]).toBe('string');
      expect(teamNames[abbr].length).toBeGreaterThan(0);
    }
  });
});
