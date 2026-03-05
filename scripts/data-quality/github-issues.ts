#!/usr/bin/env tsx
// Creates GitHub Issues for quarantined data quality anomalies that haven't been filed yet.
// Queries data_quality_quarantine for pending records without github_issue_number,
// creates issues via `gh` CLI, then updates the quarantine with the issue number.
//
// Usage:
//   tsx scripts/data-quality/github-issues.ts
//   npm run data-quality:issues

import { execFileSync, execSync } from 'child_process';
import { MotherDuckConnection } from '../ingest/db/connection';

interface PendingRecord {
  game_id: string;
  entity_id: string;
  player_name: string;
  expected_team: string | null;
  actual_team: string;
  detection_type: string;
  details: string | null;
  game_date: string | null;
}

export interface GitHubIssuesResult {
  created: number;
  failed: number;
}

function escSql(val: string): string {
  return val.replace(/'/g, "''");
}

function buildGroupedIssueTitle(detectionType: string, count: number): string {
  return `Data Quality: ${count} ${detectionType} anomalies detected`;
}

function buildGroupedIssueBody(detectionType: string, records: PendingRecord[]): string {
  const lines = [
    '## Data Quality Alert',
    '',
    `**Detection Type**: \`${detectionType}\``,
    `**Records**: ${records.length}`,
    '',
    '### Affected Games',
    '',
    '| Game ID | Game Date | Player | Entity ID | Expected Team | Actual Team | Details |',
    '|---------|-----------|--------|-----------|---------------|-------------|---------|',
  ];

  for (const r of records) {
    const gameDate = r.game_date ?? 'unknown';
    const expected = r.expected_team ?? 'N/A';
    const details = r.details ?? '';
    lines.push(`| ${r.game_id} | ${gameDate} | ${r.player_name} | ${r.entity_id} | ${expected} | ${r.actual_team} | ${details} |`);
  }

  lines.push('', '### Resolution');
  lines.push(`Requires manual review for each record.`);
  lines.push('', '### Manual Action');
  lines.push("- Close as 'approved' if these are legitimate trades/transfers");
  lines.push("- Close as 'rejected' if these are data errors");

  return lines.join('\n');
}

function ensureLabelExists(): void {
  try {
    const result = execSync(
      'gh label list --search "data-quality" --json name --jq ".[].name"',
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();

    if (!result.split('\n').includes('data-quality')) {
      execSync(
        'gh label create "data-quality" --description "Data quality quarantine alerts" --color "d93f0b"',
        { stdio: ['pipe', 'pipe', 'pipe'] },
      );
      console.log('Created "data-quality" label.');
    }
  } catch {
    try {
      execSync(
        'gh label create "data-quality" --description "Data quality quarantine alerts" --color "d93f0b"',
        { stdio: ['pipe', 'pipe', 'pipe'] },
      );
      console.log('Created "data-quality" label.');
    } catch {
      // Label likely already exists
    }
  }
}

function createGitHubIssue(title: string, body: string): number | null {
  try {
    // Use execFileSync to avoid shell escaping issues with special characters
    const result = execFileSync(
      'gh',
      ['issue', 'create', '--title', title, '--label', 'data-quality', '--body', body],
      { encoding: 'utf-8' },
    ).trim();

    // gh issue create returns the URL, e.g. https://github.com/owner/repo/issues/42
    const match = result.match(/\/issues\/(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }

    console.warn(`Could not parse issue number from: ${result}`);
    return null;
  } catch (error) {
    console.error(`Failed to create issue: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

/**
 * Create GitHub Issues for all pending quarantine records that lack one.
 * Exported so check.ts can call it after detection + auto-resolution.
 */
export async function createIssuesForPending(db: MotherDuckConnection): Promise<GitHubIssuesResult> {
  ensureLabelExists();

  const pending = await db.query<PendingRecord>(`
    SELECT
      dqq.game_id,
      dqq.entity_id,
      dqq.player_name,
      dqq.expected_team,
      dqq.actual_team,
      dqq.detection_type,
      dqq.details,
      CAST(s.game_date AS VARCHAR) AS game_date
    FROM main.data_quality_quarantine dqq
    LEFT JOIN main.schedule s ON dqq.game_id = s.game_id
    WHERE dqq.resolution_status = 'pending'
      AND dqq.github_issue_number IS NULL
    ORDER BY dqq.created_at ASC
  `);

  if (pending.length === 0) {
    console.log('No pending quarantine records need GitHub issues.');
    return { created: 0, failed: 0 };
  }

  // Group records by detection_type — one issue per type
  const grouped = new Map<string, PendingRecord[]>();
  for (const record of pending) {
    const list = grouped.get(record.detection_type);
    if (list) {
      list.push(record);
    } else {
      grouped.set(record.detection_type, [record]);
    }
  }

  console.log(`Found ${pending.length} pending record(s) across ${grouped.size} detection type(s).\n`);

  let created = 0;
  let failed = 0;

  for (const [detectionType, records] of grouped) {
    const title = buildGroupedIssueTitle(detectionType, records.length);
    const body = buildGroupedIssueBody(detectionType, records);

    process.stdout.write(`Creating issue: ${title}...`);
    const issueNumber = createGitHubIssue(title, body);

    if (issueNumber !== null) {
      // Update all records in this group with the shared issue number
      for (const record of records) {
        await db.execute(`
          UPDATE main.data_quality_quarantine
          SET github_issue_number = ${issueNumber}
          WHERE game_id = '${escSql(record.game_id)}'
            AND entity_id = '${escSql(record.entity_id)}'
            AND detection_type = '${escSql(record.detection_type)}'
        `);
      }
      console.log(` #${issueNumber}`);
      created++;
    } else {
      console.log(' FAILED');
      failed++;
    }
  }

  console.log(`\nDone: ${created} issue(s) created (covering ${pending.length} records), ${failed} failed.`);
  return { created, failed };
}

// CLI entry point
async function main(): Promise<void> {
  const token = process.env.MOTHERDUCK_TOKEN;
  if (!token) {
    console.error('Error: MOTHERDUCK_TOKEN environment variable is required');
    process.exit(1);
  }

  const db = new MotherDuckConnection(token, 'nba_box_scores_v2');
  try {
    await db.connect();
    await createIssuesForPending(db);
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
