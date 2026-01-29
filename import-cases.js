import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

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

const directorMap = {
  'Eric': '11111111-1111-1111-1111-111111111111',
  'Eric Behm': '11111111-1111-1111-1111-111111111111',
  'John': '33333333-3333-3333-3333-333333333333',
  'John Merk': '33333333-3333-3333-3333-333333333333',
  'Trevor': '22222222-2222-2222-2222-222222222222',
  'Trevor Behm': '22222222-2222-2222-2222-222222222222',
  'Stephanie': 'f9df340e-ca6e-4547-a888-3fe65bc98e54'
};

const serviceTypeMap = {
  'Cremation': 'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e',
  'Graveside': 'd4e5f6a7-b8c9-4d5e-1f2a-3b4c5d6e7f8a',
  'Memorial': 'c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f',
  'Traditional': 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'Burial': 'afeffc36-831b-453e-be16-aa55fc649a94'
};

const saleTypeMap = {
  'A': 'e5f6a7b8-c9d0-4e5f-2a3b-4c5d6e7f8a9b',
  'At-Need': 'e5f6a7b8-c9d0-4e5f-2a3b-4c5d6e7f8a9b',
  'I': 'a7b8c9d0-e1f2-4a5b-4c5d-6e7f8a9b0c1d',
  'Insurance': 'a7b8c9d0-e1f2-4a5b-4c5d-6e7f8a9b0c1d',
  'P': 'f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c',
  'Pre-Need': 'f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c'
};

function parseDate(dateStr) {
  if (!dateStr) return null;

  if (typeof dateStr === 'string' && dateStr.trim() === '') return null;

  if (typeof dateStr === 'number') {
    const date = XLSX.SSF.parse_date_code(dateStr);
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
  }

  if (typeof dateStr === 'string') {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [month, day, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  return null;
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
}

async function importData() {
  console.log('Reading Excel file...');

  const workbook = XLSX.readFile('./data/behmfuneralhome_sales_(1)_(2).xlsm');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(worksheet);

  console.log(`Found ${rawData.length} rows in Excel file`);

  const cases = [];
  const errors = [];

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];

    try {
      const caseNumber = row['Case Number'] || row['Case #'] || '';
      if (!caseNumber) {
        errors.push({ row: i + 1, error: 'Missing case number', data: row });
        continue;
      }

      const directorName = row['Director'] || '';
      const directorId = directorMap[directorName];
      if (!directorId) {
        errors.push({ row: i + 1, error: `Unknown director: ${directorName}`, data: row });
        continue;
      }

      const serviceTypeName = row['Service Type'] || '';
      const serviceTypeId = serviceTypeMap[serviceTypeName];
      if (!serviceTypeId) {
        errors.push({ row: i + 1, error: `Unknown service type: ${serviceTypeName}`, data: row });
        continue;
      }

      const saleTypeName = row['Sale Type'] || '';
      const saleTypeId = saleTypeMap[saleTypeName];
      if (!saleTypeId) {
        errors.push({ row: i + 1, error: `Unknown sale type: ${saleTypeName}`, data: row });
        continue;
      }

      const caseData = {
        case_number: caseNumber,
        date_of_death: parseDate(row['Date of Death']),
        customer_first_name: row['Customer First Name'] || '',
        customer_last_name: row['Customer Last Name'] || '',
        service_type_id: serviceTypeId,
        sale_type_id: saleTypeId,
        director_id: directorId,
        date_paid_in_full: parseDate(row['Date PIF']),
        payments_received: parseNumber(row['Payments Received to date']),
        average_age: parseNumber(row['Aging']),
        total_sale: parseNumber(row['Total Sales'])
      };

      cases.push(caseData);
    } catch (error) {
      errors.push({ row: i + 1, error: error.message, data: row });
    }
  }

  console.log(`Prepared ${cases.length} cases for import`);

  if (errors.length > 0) {
    console.log(`\nFound ${errors.length} errors:`);
    errors.slice(0, 10).forEach(err => {
      console.log(`  Row ${err.row}: ${err.error}`);
    });
    if (errors.length > 10) {
      console.log(`  ... and ${errors.length - 10} more errors`);
    }
  }

  if (cases.length === 0) {
    console.log('No valid cases to import');
    return;
  }

  console.log('\nInserting cases into database...');
  const batchSize = 100;
  let imported = 0;
  let failed = 0;

  for (let i = 0; i < cases.length; i += batchSize) {
    const batch = cases.slice(i, i + batchSize);

    try {
      const { data, error } = await supabase
        .from('cases')
        .insert(batch)
        .select();

      if (error) {
        console.error(`Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error.message);
        failed += batch.length;
      } else {
        imported += batch.length;
        console.log(`Imported batch ${Math.floor(i / batchSize) + 1} (${imported}/${cases.length})`);
      }
    } catch (error) {
      console.error(`Exception in batch ${Math.floor(i / batchSize) + 1}:`, error.message);
      failed += batch.length;
    }
  }

  console.log(`\nImport complete:`);
  console.log(`  Successfully imported: ${imported}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Errors during parsing: ${errors.length}`);
}

importData().catch(console.error);
