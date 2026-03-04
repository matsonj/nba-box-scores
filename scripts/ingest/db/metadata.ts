// Runs metadata-generator to apply dynamic COMMENT ON statements after ingest.
// Requires `uv` and `metadata-generator` installed at ~/code/metadata_generator.

import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { logger } from '../util/logger';

const METADATA_GENERATOR_DIR = resolve(process.env.HOME || '~', 'code/metadata_generator');

export async function refreshMetadata(database: string): Promise<void> {
  logger.info('Refreshing dynamic metadata comments...');

  try {
    const output = await runCommand('uv', [
      'run', 'metadata-generator',
      '--database', database,
      'comments', 'main',
      '-x', '--refresh',
    ], METADATA_GENERATOR_DIR);

    logger.info('Metadata comments applied', { output: output.trim().split('\n').pop() });
  } catch (error) {
    // Non-fatal — metadata is nice-to-have, don't fail the pipeline
    logger.warn('Metadata refresh failed (non-fatal)', {
      error: (error as Error).message,
    });
  }
}

function runCommand(cmd: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd, timeout: 120_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`${cmd} failed: ${stderr || error.message}`));
      } else {
        resolve(stdout);
      }
    });
  });
}
