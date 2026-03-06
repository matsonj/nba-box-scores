import { getNHLTeamName, nhlTeamNames, NHL_TEAM_ABBREVIATIONS } from '../teams';

describe('getNHLTeamName', () => {
  it('returns the full team name for valid abbreviations', () => {
    expect(getNHLTeamName('BOS')).toBe('Boston Bruins');
    expect(getNHLTeamName('TOR')).toBe('Toronto Maple Leafs');
    expect(getNHLTeamName('VGK')).toBe('Vegas Golden Knights');
    expect(getNHLTeamName('NYR')).toBe('New York Rangers');
  });

  it('returns the input string for unknown teams', () => {
    expect(getNHLTeamName('XYZ')).toBe('XYZ');
    expect(getNHLTeamName('')).toBe('');
  });
});

describe('NHL_TEAM_ABBREVIATIONS', () => {
  it('contains 32 NHL teams', () => {
    expect(NHL_TEAM_ABBREVIATIONS).toHaveLength(32);
  });

  it('contains all expected teams', () => {
    expect(NHL_TEAM_ABBREVIATIONS).toContain('BOS');
    expect(NHL_TEAM_ABBREVIATIONS).toContain('TOR');
    expect(NHL_TEAM_ABBREVIATIONS).toContain('VGK');
    expect(NHL_TEAM_ABBREVIATIONS).toContain('SEA');
    expect(NHL_TEAM_ABBREVIATIONS).toContain('UTA');
  });
});

describe('nhlTeamNames', () => {
  it('has an entry for every abbreviation', () => {
    for (const abbr of NHL_TEAM_ABBREVIATIONS) {
      expect(nhlTeamNames[abbr]).toBeDefined();
      expect(typeof nhlTeamNames[abbr]).toBe('string');
      expect(nhlTeamNames[abbr].length).toBeGreaterThan(0);
    }
  });
});
