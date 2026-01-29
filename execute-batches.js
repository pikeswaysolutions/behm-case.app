import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeBatch(batchFile) {
  const sql = readFileSync(batchFile, 'utf-8');

  if (!sql.trim()) {
    return { success: true, count: 0 };
  }

  const { data, error } = await supabase.rpc('execute_sql', { query: sql });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, count: 1 };
}

async function main() {
  const batchFiles = readdirSync('.')
    .filter(f => f.startsWith('import-batch-'))
    .sort();

  console.log(`Found ${batchFiles.length} batch files to execute\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < batchFiles.length; i++) {
    const file = batchFiles[i];
    process.stdout.write(`[${i + 1}/${batchFiles.length}] Processing ${file}... `);

    try {
      const result = await executeBatch(file);

      if (result.success) {
        console.log('✓');
        successCount++;
      } else {
        console.log(`✗ ${result.error}`);
        errorCount++;
      }
    } catch (err) {
      console.log(`✗ ${err.message}`);
      errorCount++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Successfully executed: ${successCount} batches`);
  console.log(`Failed: ${errorCount} batches`);

  const { count } = await supabase
    .from('cases')
    .select('*', { count: 'exact', head: true });

  console.log(`\nTotal cases in database: ${count}`);
}

main().catch(console.error);
