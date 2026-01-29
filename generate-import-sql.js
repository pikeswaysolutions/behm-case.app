import XLSX from 'xlsx';
import { writeFileSync } from 'fs';

const directorMap = {
  'Eric': '11111111-1111-1111-1111-111111111111',
  'Eric Behm': '11111111-1111-1111-1111-111111111111',
  'John': '33333333-3333-3333-3333-333333333333',
  'John Merk': '33333333-3333-3333-3333-333333333333',
  'Trevor': '22222222-2222-2222-2222-222222222222',
  'Trevor Behm': '22222222-2222-2222-2222-222222222222',
  'Stephanie': 'f9df340e-ca6e-4547-a888-3fe65bc98e54',
  'Nate': '3d37a6ce-8584-4c1f-9fb9-43d6a2232a1e',
  'Rick': 'fdcca7f3-5bb7-4a37-949d-eb2193ae0a94',
  'Katy': '260c3392-4c80-404a-9a82-5de7eeb8e324',
  'Northshore': 'b8cc1ee9-f98d-4077-bf80-ca4be7adf9e1',
  'Chad': 'd16244f6-cd18-4492-8bbd-feada60bbbfa'
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

function sqlEscape(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

console.log('Reading Excel file...');
const workbook = XLSX.readFile('./data/behmfuneralhome_sales_(1)_(2).xlsm');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rawData = XLSX.utils.sheet_to_json(worksheet);

console.log(`Found ${rawData.length} rows in Excel file`);

const sqlStatements = [];
const errors = [];

for (let i = 0; i < rawData.length; i++) {
  const row = rawData[i];

  try {
    const caseNumber = row['Case Number'] || row['Case #'] || '';
    if (!caseNumber) {
      errors.push({ row: i + 1, error: 'Missing case number' });
      continue;
    }

    const directorName = (row['Director'] || '').trim();
    const directorId = directorMap[directorName];
    if (!directorId) {
      errors.push({ row: i + 1, error: `Unknown director: ${directorName}` });
      continue;
    }

    const serviceTypeName = (row['Service Type'] || '').trim();
    if (!serviceTypeName) {
      errors.push({ row: i + 1, error: 'Missing service type' });
      continue;
    }
    const serviceTypeId = serviceTypeMap[serviceTypeName];
    if (!serviceTypeId) {
      errors.push({ row: i + 1, error: `Unknown service type: ${serviceTypeName}` });
      continue;
    }

    const saleTypeName = (row['Sale Type'] || '').trim().toUpperCase();
    const saleTypeId = saleTypeMap[saleTypeName];
    if (!saleTypeId) {
      errors.push({ row: i + 1, error: `Unknown sale type: ${saleTypeName}` });
      continue;
    }

    const dateOfDeath = parseDate(row['Date of Death']);
    if (!dateOfDeath) {
      errors.push({ row: i + 1, error: 'Invalid date of death' });
      continue;
    }

    const datePIF = parseDate(row['Date PIF']);
    const firstName = row['Customer First Name'] || '';
    const lastName = row['Customer Last Name'] || '';
    const paymentsReceived = parseNumber(row['Payments Received to date']);
    const aging = parseNumber(row['Aging']);
    const totalSale = parseNumber(row['Total Sales']);

    const sql = `INSERT INTO cases (case_number, date_of_death, customer_first_name, customer_last_name, service_type_id, sale_type_id, director_id, date_paid_in_full, payments_received, average_age, total_sale) VALUES (${sqlEscape(caseNumber)}, ${sqlEscape(dateOfDeath)}, ${sqlEscape(firstName)}, ${sqlEscape(lastName)}, ${sqlEscape(serviceTypeId)}, ${sqlEscape(saleTypeId)}, ${sqlEscape(directorId)}, ${datePIF ? sqlEscape(datePIF) : 'NULL'}, ${paymentsReceived}, ${aging || 'NULL'}, ${totalSale});`;

    sqlStatements.push(sql);
  } catch (error) {
    errors.push({ row: i + 1, error: error.message });
  }
}

console.log(`Prepared ${sqlStatements.length} SQL statements`);

if (errors.length > 0) {
  console.log(`\nFound ${errors.length} errors:`);
  errors.slice(0, 20).forEach(err => {
    console.log(`  Row ${err.row}: ${err.error}`);
  });
  if (errors.length > 20) {
    console.log(`  ... and ${errors.length - 20} more errors`);
  }
}

const fullSQL = sqlStatements.join('\n');
writeFileSync('import-cases.sql', fullSQL);
console.log('\nSQL file written to import-cases.sql');
console.log(`Total statements: ${sqlStatements.length}`);
