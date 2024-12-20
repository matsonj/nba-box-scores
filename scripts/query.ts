import { queryDb } from '../lib/db';

async function runQuery() {
  const query = process.argv[2];
  if (!query) {
    console.error('Please provide a query as an argument');
    process.exit(1);
  }

  try {
    const result = await queryDb(query);
    console.log(JSON.stringify(result, (_, value) => 
      typeof value === 'bigint' ? value.toString() : value
    , 2));
  } catch (error) {
    console.error('Error executing query:', error);
    process.exit(1);
  }
}

runQuery().catch(console.error);
