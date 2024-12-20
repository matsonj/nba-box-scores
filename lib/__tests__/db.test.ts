import { getConnection, queryDb } from '../db';
import path from 'path';
import fs from 'fs';

describe('Database Connection', () => {
  beforeAll(() => {
    // Ensure the data directory exists
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  });

  it('should establish a database connection', async () => {
    const conn = await getConnection();
    expect(conn).toBeDefined();
  });

  it('should reuse the same connection on multiple calls', async () => {
    const conn1 = await getConnection();
    const conn2 = await getConnection();
    expect(conn1).toBe(conn2);
  });

  it('should execute a basic query', async () => {
    const result = await queryDb('SELECT 1 as value');
    expect(result).toEqual([{ value: 1 }]);
  });

  it('should handle query parameters correctly', async () => {
    const result = await queryDb('SELECT $1::INTEGER as num, $2::VARCHAR as str', [42, 'test']);
    expect(result).toEqual([{ num: 42, str: 'test' }]);
  });
});
