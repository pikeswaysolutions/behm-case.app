import { readFileSync, writeFileSync } from 'fs';

const directorMap = {
  'John': '33333333-3333-3333-3333-333333333333',
  'Stephanie': 'f9df340e-ca6e-4547-a888-3fe65bc98e54',
  'Trevor': '22222222-2222-2222-2222-222222222222',
  'Eric': '11111111-1111-1111-1111-111111111111',
  'Chad': 'd16244f6-cd18-4492-8bbd-feada60bbbfa',
  'Katy': '260c3392-4c80-404a-9a82-5de7eeb8e324',
  'Nate': '3d37a6ce-8584-4c1f-9fb9-43d6a2232a1e',
  'Northshore': 'b8cc1ee9-f98d-4077-bf80-ca4be7adf9e1',
  'Rick': 'fdcca7f3-5bb7-4a37-949d-eb2193ae0a94'
};

const saleTypeMap = {
  'A': 'e5f6a7b8-c9d0-4e5f-2a3b-4c5d6e7f8a9b',
  'P': 'f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c',
  'I': 'a7b8c9d0-e1f2-4a5b-4c5d-6e7f8a9b0c1d'
};

const serviceTypeMap = {
  'Burial': 'afeffc36-831b-453e-be16-aa55fc649a94',
  'Cremation': 'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e',
  'Graveside': 'd4e5f6a7-b8c9-4d5e-1f2a-3b4c5d6e7f8a',
  'Memorial': 'c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f',
  'Traditional': 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'
};

function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;

  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;

  const month = parts[0].padStart(2, '0');
  const day = parts[1].padStart(2, '0');
  const year = parts[2];

  return `${year}-${month}-${day}`;
}

function escapeString(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function parseCSV(content) {
  const lines = content.split('\n');
  const headers = parseCSVLine(lines[0]);
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const values = parseCSVLine(lines[i]);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    data.push(row);
  }

  return data;
}

function processCSV() {
  const content = readFileSync('./data/behmfuneralhome(sheet1).csv', 'utf-8');
  const data = parseCSV(content);

  const header = readFileSync('./migration-header.txt', 'utf-8');

  let sql = header + '\n\n';

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const row of data) {
    try {
      const caseNumber = row['Case Number']?.toString().trim();
      const saleTypeCode = row['Sale Type']?.toString().trim().toUpperCase();
      const directorName = row['Director']?.toString().trim();
      const dateOfDeath = parseDate(row['Date of Death']);
      const firstName = row['Customer First Name']?.toString().trim();
      const lastName = row['Customer Last Name']?.toString().trim();
      const serviceTypeName = row['Service Type']?.toString().trim();
      const totalSale = parseFloat(row['Total Sales']) || 0;
      const paymentsReceived = parseFloat(row['Payments Received to date']) || 0;
      const datePIF = parseDate(row['Date PIF']);

      if (!caseNumber) {
        errors.push(`Skipping row - no case number`);
        errorCount++;
        continue;
      }

      if (!directorName) {
        errors.push(`No director for case ${caseNumber}`);
        errorCount++;
        continue;
      }

      const directorId = directorMap[directorName];
      if (!directorId) {
        errors.push(`Unknown director: "${directorName}" for case ${caseNumber}`);
        errorCount++;
        continue;
      }

      const saleTypeId = saleTypeMap[saleTypeCode];
      if (!saleTypeId && saleTypeCode) {
        errors.push(`Unknown sale type: "${saleTypeCode}" for case ${caseNumber}`);
        errorCount++;
        continue;
      }

      if (!serviceTypeName) {
        errors.push(`No service type for case ${caseNumber}`);
        errorCount++;
        continue;
      }

      const serviceTypeId = serviceTypeMap[serviceTypeName];
      if (!serviceTypeId) {
        errors.push(`Unknown service type: "${serviceTypeName}" for case ${caseNumber}`);
        errorCount++;
        continue;
      }

      if (!dateOfDeath) {
        errors.push(`Invalid date of death for case ${caseNumber}`);
        errorCount++;
        continue;
      }

      sql += `INSERT INTO cases (case_number, date_of_death, customer_first_name, customer_last_name, service_type_id, sale_type_id, director_id, date_paid_in_full, payments_received, total_sale)\n`;
      sql += `VALUES (${escapeString(caseNumber)}, '${dateOfDeath}', ${escapeString(firstName)}, ${escapeString(lastName)}, '${serviceTypeId}', ${saleTypeId ? `'${saleTypeId}'` : 'NULL'}, '${directorId}', ${datePIF ? `'${datePIF}'` : 'NULL'}, ${paymentsReceived}, ${totalSale})\n`;
      sql += `ON CONFLICT (case_number) DO NOTHING;\n\n`;

      successCount++;
    } catch (err) {
      errors.push(`Error processing row: ${err.message}`);
      errorCount++;
    }
  }

  writeFileSync('./supabase/migrations/20260129000000_import_cases_data.sql', sql);

  console.log(`\n=== Import Summary ===`);
  console.log(`Successfully processed: ${successCount} cases`);
  console.log(`Errors: ${errorCount}`);

  if (errors.length > 0 && errors.length <= 20) {
    console.log(`\nErrors:`);
    errors.forEach(err => console.log(`  - ${err}`));
  } else if (errors.length > 20) {
    console.log(`\nFirst 20 errors:`);
    errors.slice(0, 20).forEach(err => console.log(`  - ${err}`));
  }

  console.log(`\nMigration file created: ./supabase/migrations/20260129000000_import_cases_data.sql`);
}

processCSV();
