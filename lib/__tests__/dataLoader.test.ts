import { DataLoader } from '../dataLoader';

// Mock the MotherDuckContext module
jest.mock('../MotherDuckContext', () => ({
  useMotherDuckClientState: jest.fn(),
}));

describe('DataLoader', () => {
  let mockEvaluateQuery: jest.Mock;
  let loader: DataLoader;

  beforeEach(() => {
    mockEvaluateQuery = jest.fn().mockResolvedValue({ data: { toRows: () => [] } });
    loader = new DataLoader(mockEvaluateQuery);
  });

  describe('waitForWasm', () => {
    it('executes a simple query to verify wasm readiness', async () => {
      await loader.waitForWasm();
      expect(mockEvaluateQuery).toHaveBeenCalledWith('SELECT 1');
    });

    it('throws if the query fails', async () => {
      mockEvaluateQuery.mockRejectedValueOnce(new Error('Wasm not ready'));
      await expect(loader.waitForWasm()).rejects.toThrow('Wasm not ready');
    });
  });

  describe('loadEssentialTables', () => {
    it('creates three temp tables', async () => {
      await loader.loadEssentialTables();
      expect(mockEvaluateQuery).toHaveBeenCalledTimes(3);
      // Verify each call creates a temp table
      const calls = mockEvaluateQuery.mock.calls.map((c: [string]) => c[0]);
      expect(calls[0]).toContain('CREATE TEMP TABLE IF NOT EXISTS temp_schedule');
      expect(calls[1]).toContain('CREATE TEMP TABLE IF NOT EXISTS temp_box_scores');
      expect(calls[2]).toContain('CREATE TEMP TABLE IF NOT EXISTS temp_team_stats');
    });

    it('does not run duplicate loads when called concurrently', async () => {
      const p1 = loader.loadEssentialTables();
      const p2 = loader.loadEssentialTables();
      await Promise.all([p1, p2]);
      // Should only create tables once (3 queries total)
      expect(mockEvaluateQuery).toHaveBeenCalledTimes(3);
    });

    it('propagates errors from query execution', async () => {
      mockEvaluateQuery.mockRejectedValueOnce(new Error('Query failed'));
      await expect(loader.loadEssentialTables()).rejects.toThrow('Query failed');
    });
  });

  describe('createDynamicTable', () => {
    it('checks essential tables exist before creating dynamic table', async () => {
      await loader.createDynamicTable();
      // 3 checks + 1 dynamic table creation
      expect(mockEvaluateQuery).toHaveBeenCalledTimes(4);
      const calls = mockEvaluateQuery.mock.calls.map((c: [string]) => c[0]);
      expect(calls[0]).toContain('SELECT 1 FROM temp_schedule LIMIT 1');
      expect(calls[1]).toContain('SELECT 1 FROM temp_box_scores LIMIT 1');
      expect(calls[2]).toContain('SELECT 1 FROM temp_team_stats LIMIT 1');
      expect(calls[3]).toContain('CREATE OR REPLACE TEMP TABLE temp_dynamic_stats');
    });

    it('loads essential tables if check fails, then creates dynamic table', async () => {
      // First call (SELECT 1 FROM temp_schedule) fails
      mockEvaluateQuery.mockRejectedValueOnce(new Error('Table not found'));
      await loader.createDynamicTable();
      // 1 failed check + 3 essential table loads + 1 dynamic table creation
      expect(mockEvaluateQuery).toHaveBeenCalledTimes(5);
    });
  });
});
