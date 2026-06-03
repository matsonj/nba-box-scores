/**
 * Regression imputation engine for untracked-era box score stats.
 *
 * The NBA did not record steals/blocks until 1973-74 or player turnovers until
 * 1977-78. We reconstruct them by fitting, on the *recorded* era, a model that
 * predicts each stat from quantities that WERE recorded in the old era
 * (minutes, points, rebounds, assists, FGA, FTA, fouls), then applying it
 * backward. This mirrors Basketball-Reference's own documented approach of
 * estimating — rather than blanking — missing turnovers.
 *
 * Design decisions (confirmed with the user):
 *  - Grain = player-SEASON. Per-game steals/blocks are near-unpredictable; we fit
 *    and predict the stable per-36 season rate, then distribute it across games by
 *    minutes (see parser). Season/career aggregates are the trustworthy unit.
 *  - Weighted least squares, down-weighting modern seasons so the fit leans on the
 *    earliest recorded seasons (closest in style to the unrecorded era), reducing
 *    era-transfer bias.
 *  - Single best estimate + a flag (no multiple imputation). Coefficients and R²
 *    are persisted so estimates are reproducible and auditable.
 *
 * Pure module — no I/O, fully unit-testable.
 */

import {
  STEALS_BLOCKS_CUTOFF,
  TURNOVERS_CUTOFF,
  type PlayerSeasonAgg,
} from './types';

/** Targets we impute, and the season-year from which each became official. */
export type ImputableStat = 'steals' | 'blocks' | 'turnovers';

const TARGET_CUTOFF: Record<ImputableStat, number> = {
  steals: STEALS_BLOCKS_CUTOFF,
  blocks: STEALS_BLOCKS_CUTOFF,
  turnovers: TURNOVERS_CUTOFF,
};

/**
 * Feature names, in order:
 *  - six per-36 box-score rates,
 *  - height (inches) and age (years) from the bio table,
 *  - mpg (minutes per game) as a role/usage signal — high-minute starters have
 *    different steal/turnover rates than deep-bench players, which the per-36
 *    rates alone don't capture.
 *  - guard/forward/center 0/1 position flags from the bio table.
 * An intercept is prepended internally.
 */
export const FEATURES = [
  'pts36', 'reb36', 'ast36', 'fga36', 'fta36', 'pf36',
  'height', 'age', 'mpg', 'guard', 'forward', 'center',
] as const;
export type FeatureName = (typeof FEATURES)[number];

/** Minimum season minutes for a player-season to enter the training set. */
export const MIN_SEASON_MINUTES = 200;
/** Decay constant (in seasons) for the early-season weighting. */
export const WEIGHT_TAU = 8;
/** Tiny ridge term for numerical stability of the normal equations. */
const RIDGE_LAMBDA = 1e-6;

export interface ImputationModel {
  target: ImputableStat;
  /** coefficients[0] is the intercept; [1..] align with FEATURES. */
  coefficients: number[];
  r2: number;
  nTrain: number;
}

export type ImputationModels = Record<ImputableStat, ImputationModel | null>;

// ── Feature extraction ────────────────────────────────────────────────────────

/** Per-36-minute rate, guarding against zero minutes. */
function per36(total: number, minutes: number): number {
  if (minutes <= 0) return 0;
  return (total / minutes) * 36;
}

/** Build the feature vector (per-36 rates + height + age) for a season. */
function featureVector(agg: PlayerSeasonAgg): number[] {
  const m = agg.minutes;
  return [
    per36(agg.points, m),
    per36(agg.rebounds, m),
    per36(agg.assists, m),
    per36(agg.fg_attempted, m),
    per36(agg.ft_attempted, m),
    per36(agg.fouls, m),
    agg.height,
    agg.age,
    agg.games > 0 ? agg.minutes / agg.games : 0, // minutes per game (role/usage)
    agg.pos_guard,
    agg.pos_forward,
    agg.pos_center,
  ];
}

/** Per-36 value of the target stat for a recorded-era season (the training label). */
function targetRate(agg: PlayerSeasonAgg, target: ImputableStat): number {
  return per36(agg[target] ?? 0, agg.minutes);
}

/** Early-season weight: 1.0 at the cutoff, decaying for later seasons. */
function seasonWeight(seasonYear: number, cutoff: number): number {
  const dist = Math.max(0, seasonYear - cutoff);
  return Math.exp(-dist / WEIGHT_TAU);
}

// ── Linear algebra (small dense systems) ───────────────────────────────────────

/** Solve A x = b for a square matrix A via Gaussian elimination with partial pivoting. */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  // Augmented copy
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivot
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-12) {
      throw new Error('Singular matrix in OLS normal equations');
    }
    [M[col], M[pivot]] = [M[pivot], M[col]];

    // Eliminate below
    for (let r = col + 1; r < n; r++) {
      const factor = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }

  // Back-substitution
  const x = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = M[row][n];
    for (let c = row + 1; c < n; c++) sum -= M[row][c] * x[c];
    x[row] = sum / M[row][row];
  }
  return x;
}

/**
 * Weighted ridge least squares: β = (XᵀWX + λI)⁻¹ XᵀWy.
 * Rows: design matrix X (each row already includes the leading intercept term),
 * y: labels, w: per-row weights. Returns the coefficient vector.
 */
function weightedLeastSquares(X: number[][], y: number[], w: number[]): number[] {
  const p = X[0].length;
  const xtwx: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const xtwy: number[] = new Array<number>(p).fill(0);

  for (let i = 0; i < X.length; i++) {
    const wi = w[i];
    const xi = X[i];
    for (let a = 0; a < p; a++) {
      xtwy[a] += wi * xi[a] * y[i];
      for (let b = 0; b < p; b++) {
        xtwx[a][b] += wi * xi[a] * xi[b];
      }
    }
  }
  // Ridge term for invertibility (not applied to the intercept).
  for (let a = 1; a < p; a++) xtwx[a][a] += RIDGE_LAMBDA;

  return solveLinearSystem(xtwx, xtwy);
}

// ── Fitting ─────────────────────────────────────────────────────────────────

/**
 * Fit one weighted-OLS model per imputable stat from recorded-era player-seasons.
 * Seasons below MIN_SEASON_MINUTES, or before the stat's cutoff, are excluded
 * per target. Returns null for a target with insufficient training data.
 */
export function fitModels(seasonAggs: PlayerSeasonAgg[]): ImputationModels {
  const models = {} as ImputationModels;

  for (const target of ['steals', 'blocks', 'turnovers'] as ImputableStat[]) {
    const cutoff = TARGET_CUTOFF[target];
    const train = seasonAggs.filter(
      (a) =>
        a.season_year >= cutoff &&
        a.minutes >= MIN_SEASON_MINUTES &&
        a[target] != null,
    );

    // Need clearly more rows than features to fit meaningfully.
    if (train.length < (FEATURES.length + 1) * 5) {
      models[target] = null;
      continue;
    }

    const X = train.map((a) => [1, ...featureVector(a)]); // leading intercept
    const y = train.map((a) => targetRate(a, target));
    const w = train.map((a) => seasonWeight(a.season_year, cutoff));

    const coefficients = weightedLeastSquares(X, y, w);
    const r2 = weightedR2(X, y, w, coefficients);

    models[target] = { target, coefficients, r2, nTrain: train.length };
  }

  return models;
}

/** Weighted coefficient of determination for a fitted model. */
function weightedR2(X: number[][], y: number[], w: number[], coef: number[]): number {
  const wSum = w.reduce((s, wi) => s + wi, 0);
  const yMean = y.reduce((s, yi, i) => s + w[i] * yi, 0) / wSum;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < X.length; i++) {
    const yhat = dot(coef, X[i]);
    ssRes += w[i] * (y[i] - yhat) ** 2;
    ssTot += w[i] * (y[i] - yMean) ** 2;
  }
  return ssTot > 0 ? 1 - ssRes / ssTot : 0;
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// ── Prediction ────────────────────────────────────────────────────────────────

/**
 * Predict the per-36-minute rate of `target` for a pre-cutoff player-season.
 * Returns null when no model is available; clamps negative predictions to 0.
 */
export function predictSeasonRate(
  models: ImputationModels,
  target: ImputableStat,
  agg: PlayerSeasonAgg,
): number | null {
  const model = models[target];
  if (!model) return null;
  const x = [1, ...featureVector(agg)];
  return Math.max(0, dot(model.coefficients, x));
}

/**
 * Distribute a per-36 season rate to a single game by its minutes:
 * round(rate × gameMinutes / 36), clamped ≥ 0. Returns null if minutes are
 * missing (the safety-net case — the caller leaves the stat NULL).
 */
export function distributeToGame(rate36: number, gameMinutes: number | null): number | null {
  if (gameMinutes == null || gameMinutes <= 0) return null;
  return Math.max(0, Math.round((rate36 * gameMinutes) / 36));
}

// ── Persistence helper ──────────────────────────────────────────────────────

export interface ModelCoefficientRow {
  fit_id: string;
  target: string;
  feature: string;
  coefficient: number;
  r2: number;
  n_train: number;
}

/** Flatten fitted models into rows for the legacy_imputation_models table. */
export function modelsToRows(models: ImputationModels, fitId: string): ModelCoefficientRow[] {
  const rows: ModelCoefficientRow[] = [];
  const featureNames = ['intercept', ...FEATURES];
  for (const target of Object.keys(models) as ImputableStat[]) {
    const model = models[target];
    if (!model) continue;
    model.coefficients.forEach((coef, i) => {
      rows.push({
        fit_id: fitId,
        target,
        feature: featureNames[i],
        coefficient: coef,
        r2: model.r2,
        n_train: model.nTrain,
      });
    });
  }
  return rows;
}
