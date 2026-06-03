import {
  fitModels,
  predictSeasonRate,
  distributeToGame,
  FEATURES,
  type ImputationModels,
} from '../imputer';
import type { PlayerSeasonAgg } from '../types';

/**
 * Build a recorded-era season aggregate whose per-36 features and steals rate are
 * exactly the supplied values (minutes fixed at 1000 so rates scale cleanly).
 */
function makeSeason(
  i: number,
  seasonYear: number,
  features: Record<string, number>,
  steals36: number,
): PlayerSeasonAgg {
  const minutes = 1000;
  const fromRate = (r: number) => (r * minutes) / 36;
  return {
    person_id: `p${i}`,
    season_year: seasonYear,
    games: 50,
    minutes,
    points: fromRate(features.pts36),
    rebounds: fromRate(features.reb36),
    assists: fromRate(features.ast36),
    steals: fromRate(steals36),
    blocks: 0,
    turnovers: 0,
    fg_attempted: fromRate(features.fga36),
    ft_attempted: fromRate(features.fta36),
    fouls: fromRate(features.pf36),
    height: 78,
    age: 27,
    pos_guard: 1,
    pos_forward: 0,
    pos_center: 0,
  };
}

function featuresFor(i: number): Record<string, number> {
  return {
    pts36: i % 7,
    reb36: i % 5,
    ast36: (i % 10) + 1,
    fga36: i % 6,
    fta36: i % 4,
    pf36: i % 3,
  };
}

describe('fitModels — coefficient recovery', () => {
  it('recovers a known linear relationship for steals', () => {
    // steals/36 = 0.5 + 0.1 * ast36 (noiseless)
    const aggs: PlayerSeasonAgg[] = [];
    for (let i = 0; i < 120; i++) {
      const f = featuresFor(i);
      aggs.push(makeSeason(i, 1973 + (i % 20), f, 0.5 + 0.1 * f.ast36));
    }

    const models = fitModels(aggs);
    const steals = models.steals;
    expect(steals).not.toBeNull();

    const intercept = steals!.coefficients[0];
    const astCoef = steals!.coefficients[1 + FEATURES.indexOf('ast36')];
    expect(intercept).toBeCloseTo(0.5, 1);
    expect(astCoef).toBeCloseTo(0.1, 1);
    expect(steals!.r2).toBeGreaterThan(0.95);
  });

  it('returns null for a target with insufficient training data', () => {
    const aggs = [makeSeason(0, 1973, featuresFor(0), 1)];
    expect(fitModels(aggs).steals).toBeNull();
  });
});

describe('fitModels — early-season weighting', () => {
  it('leans toward the earliest recorded seasons', () => {
    // Early seasons (1973) follow intercept 0.5; modern (1995) follow intercept 3.0.
    // The weighted fit should land much closer to the early intercept.
    const aggs: PlayerSeasonAgg[] = [];
    for (let i = 0; i < 60; i++) {
      const f = featuresFor(i);
      aggs.push(makeSeason(i, 1973, f, 0.5 + 0.1 * f.ast36));
    }
    for (let i = 60; i < 120; i++) {
      const f = featuresFor(i);
      aggs.push(makeSeason(i, 1995, f, 3.0 + 0.1 * f.ast36));
    }

    const models = fitModels(aggs);
    const intercept = models.steals!.coefficients[0];
    // Unweighted this would sit near 1.75 (the midpoint); weighting pulls it down.
    expect(intercept).toBeLessThan(1.5);
    expect(intercept).toBeGreaterThan(0.3);
  });
});

describe('predictSeasonRate', () => {
  const agg = makeSeason(0, 1968, featuresFor(0), 0);

  it('returns null when no model is available', () => {
    const models: ImputationModels = { steals: null, blocks: null, turnovers: null };
    expect(predictSeasonRate(models, 'steals', agg)).toBeNull();
  });

  it('clamps negative predictions to zero', () => {
    const models: ImputationModels = {
      steals: { target: 'steals', coefficients: [-5, ...new Array(FEATURES.length).fill(0)], r2: 0, nTrain: 0 },
      blocks: null,
      turnovers: null,
    };
    expect(predictSeasonRate(models, 'steals', agg)).toBe(0);
  });
});

describe('distributeToGame', () => {
  it('scales a season rate by game minutes', () => {
    expect(distributeToGame(2.0, 36)).toBe(2);
    expect(distributeToGame(2.0, 18)).toBe(1);
    expect(distributeToGame(0, 36)).toBe(0);
  });

  it('returns null when minutes are missing', () => {
    expect(distributeToGame(2.0, null)).toBeNull();
    expect(distributeToGame(2.0, 0)).toBeNull();
  });
});
