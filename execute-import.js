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
const statements = sqlContent.split(';\n').filter(s => s.trim());

console.log(`Executing ${statements.length} SQL statements in batches...`);

async function executeBatch(batch, batchNum) {
  const batchSQL = batch.join(';\n') + ';';

  try {
    const response = await fetch(`${envVars.VITE_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${envVars.VITE_SUPABASE_ANON_KEY}`,
        'apikey': envVars.VITE_SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ query: batchSQL })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Batch ${batchNum} failed:`, error);
      return false;
    }

    console.log(`Batch ${batchNum} completed successfully`);
    return true;
  } catch (error) {
    console.error(`Batch ${batchNum} error:`, error.message);
    return false;
  }
}

async function executeAll() {
  const batchSize = 50;
  let successful = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i += batchSize) {
    const batch = statements.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(statements.length / batchSize);

    console.log(`\nProcessing batch ${batchNum}/${totalBatches} (${batch.length} statements)...`);

    const result = await executeBatch(batch, batchNum);
    if (result) {
      successful += batch.length;
    } else {
      failed += batch.length;
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n=== Import Complete ===`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);
}

executeAll().catch(console.error);
