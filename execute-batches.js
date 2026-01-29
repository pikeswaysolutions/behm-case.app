import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = readFileSync('.env', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(
  envVars.VITE_SUPABASE_URL,
  envVars.VITE_SUPABASE_ANON_KEY
);

const sqlContent = readFileSync('import-cases.sql', 'utf-8');
const statements = sqlContent.split(';\n').filter(s => s.trim() && !s.trim().startsWith('/*'));

console.log(`Executing ${statements.length} SQL statements...`);

async function executeStatements() {
  let successful = 0;
  let failed = 0;
  const batchSize = 100;

  for (let i = 0; i < statements.length; i += batchSize) {
    const batch = statements.slice(i, i + batchSize);
    const batchSQL = batch.join(';\n') + ';';

    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql: batchSQL });

      if (error) {
        console.error(`Batch ${Math.floor(i / batchSize) + 1} failed:`, error.message);
        failed += batch.length;
      } else {
        successful += batch.length;
        console.log(`Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(statements.length / batchSize)} completed (${successful}/${statements.length})`);
      }
    } catch (error) {
      console.error(`Batch ${Math.floor(i / batchSize) + 1} exception:`, error.message);
      failed += batch.length;
    }

    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log(`\n=== Import Complete ===`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);

  const { data: count } = await supabase.from('cases').select('*', { count: 'exact', head: true });
  console.log(`\nTotal cases in database: ${count || 0}`);
}

executeStatements().catch(console.error);
