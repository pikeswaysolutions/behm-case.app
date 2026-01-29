import { readdirSync, readFileSync } from 'fs';
import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://postgres.vnyaqrykqrxcbsjmnaya:' + process.env.DB_PASSWORD + '@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

const client = new Client({
  connectionString: connectionString + '?sslmode=require'
});

async function main() {
  await client.connect();
  console.log('Connected to database\n');

  const batchFiles = readdirSync('.')
    .filter(f => f.startsWith('import-batch-'))
    .sort();

  console.log(\`Found \${batchFiles.length} batch files\n\`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < batchFiles.length; i++) {
    const file = batchFiles[i];
    process.stdout.write(\`[\${i + 1}/\${batchFiles.length}] Processing \${file}... \`);

    try {
      const sql = readFileSync(file, 'utf-8');
      if (sql.trim()) {
        await client.query(sql);
        console.log('✓');
        successCount++;
      }
    } catch (err) {
      console.log(\`✗ \${err.message}\`);
      errorCount++;
    }
  }

  const result = await client.query('SELECT COUNT(*) as count FROM cases');
  
  console.log(\`\n=== Summary ===\`);
  console.log(\`Successfully executed: \${successCount} batches\`);
  console.log(\`Failed: \${errorCount} batches\`);
  console.log(\`\nTotal cases in database: \${result.rows[0].count}\`);

  await client.end();
}

main().catch(console.error);
