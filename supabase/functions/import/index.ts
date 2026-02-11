import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Auth-Token",
};

const JWT_SECRET = "behm-funeral-home-secret-key-2024";

async function verifyJWT(token: string): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;

    const encoder = new TextEncoder();
    const keyData = encoder.encode(JWT_SECRET);

    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureBytes = Uint8Array.from(atob(signature.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, signatureBytes, encoder.encode(data));

    if (!valid) return null;

    const payload = JSON.parse(atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/')));

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

async function getCurrentUser(supabase: any, token: string | null) {
  if (!token) return null;

  const payload = await verifyJWT(token);
  if (!payload || !payload.sub) return null;

  const { data: users } = await supabase
    .from("users")
    .select("*")
    .eq("id", payload.sub)
    .eq("is_active", true)
    .limit(1);

  return users && users.length > 0 ? users[0] : null;
}

function parseExcelDate(value: any): string | null {
  if (!value) return null;

  if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    return null;
  }

  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const year = date.y;
      const month = String(date.m).padStart(2, '0');
      const day = String(date.d).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  return null;
}

function parseNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authToken = req.headers.get("X-Auth-Token");
    const currentUser = await getCurrentUser(supabase, authToken);

    if (!currentUser) {
      return new Response(
        JSON.stringify({ detail: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isAdmin = currentUser.role === "admin";
    if (!isAdmin && !currentUser.can_edit_cases) {
      return new Response(
        JSON.stringify({ detail: "Permission denied. You need edit permissions to import data." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const path = url.pathname.replace("/import/", "");

    if (path === "excel" && req.method === "POST") {
      const formData = await req.formData();
      const file = formData.get("file") as File;

      if (!file) {
        return new Response(
          JSON.stringify({ detail: "No file provided" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: 'array', cellDates: false });

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });

      if (jsonData.length < 2) {
        return new Response(
          JSON.stringify({ detail: "File is empty or has no data rows" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const headers = jsonData[0] as string[];
      const rows = jsonData.slice(1);

      const columnMap: Record<string, number> = {};
      headers.forEach((header: string, index: number) => {
        if (!header) return;
        const normalized = header.toLowerCase().trim();
        if ((normalized.includes('case') && (normalized.includes('number') || normalized.includes('nbr'))) || normalized === 'case nbr') {
          columnMap.case_number = index;
        } else if (normalized.includes('sale') && normalized.includes('type')) {
          columnMap.sale_type = index;
        } else if (normalized.includes('director')) {
          columnMap.director = index;
        } else if (normalized.includes('date') && normalized.includes('death')) {
          columnMap.date_of_death = index;
        } else if (normalized.includes('customer') && normalized.includes('first')) {
          columnMap.customer_first_name = index;
        } else if (normalized.includes('customer') && (normalized.includes('last') || normalized === 'customer')) {
          columnMap.customer_last_name = index;
        } else if (normalized.includes('service') || normalized === 'service') {
          columnMap.service_type = index;
        } else if (normalized.includes('total') && normalized.includes('sale')) {
          columnMap.total_sale = index;
        } else if (normalized.includes('payment')) {
          columnMap.payments_received = index;
        } else if (normalized.includes('date') && normalized.includes('pif')) {
          columnMap.date_paid_in_full = index;
        } else if (normalized === 'ag' || normalized.includes('aging') || normalized.includes('age')) {
          columnMap.aging = index;
        }
      });

      if (columnMap.case_number === undefined) {
        return new Response(
          JSON.stringify({ detail: "Could not find 'Case Number' or 'Case Nbr' column in the file" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: existingCases } = await supabase
        .from("cases")
        .select("case_number");

      const existingCaseNumbers = new Set(
        existingCases?.map((c: any) => c.case_number) || []
      );

      const { data: allDirectors } = await supabase
        .from("directors")
        .select("id, name");

      const directorMap = new Map(
        allDirectors?.map((d: any) => [d.name.toLowerCase(), d.id]) || []
      );

      const { data: allServiceTypes } = await supabase
        .from("service_types")
        .select("id, name");

      const serviceTypeMap = new Map(
        allServiceTypes?.map((s: any) => [s.name.toLowerCase(), s.id]) || []
      );

      const { data: allSaleTypes } = await supabase
        .from("sale_types")
        .select("id, name");

      const saleTypeMap = new Map(
        allSaleTypes?.map((s: any) => [s.name.toLowerCase(), s.id]) || []
      );

      const results = {
        imported: 0,
        skipped: 0,
        errors: [] as string[],
      };

      const newDirectors: string[] = [];
      const newServiceTypes: string[] = [];
      const newSaleTypes: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i] as any[];
        if (!row || row.every(cell => !cell)) continue;

        const directorName = row[columnMap.director]?.toString().trim();
        const serviceTypeName = row[columnMap.service_type]?.toString().trim();
        const saleTypeName = row[columnMap.sale_type]?.toString().trim();

        if (directorName && !directorMap.has(directorName.toLowerCase()) && !newDirectors.includes(directorName)) {
          newDirectors.push(directorName);
        }
        if (serviceTypeName && !serviceTypeMap.has(serviceTypeName.toLowerCase()) && !newServiceTypes.includes(serviceTypeName)) {
          newServiceTypes.push(serviceTypeName);
        }
        if (saleTypeName && !saleTypeMap.has(saleTypeName.toLowerCase()) && !newSaleTypes.includes(saleTypeName)) {
          newSaleTypes.push(saleTypeName);
        }
      }

      if (newDirectors.length > 0) {
        const { data: insertedDirectors } = await supabase
          .from("directors")
          .insert(newDirectors.map(name => ({ name, is_active: true })))
          .select("id, name");

        insertedDirectors?.forEach((d: any) => {
          directorMap.set(d.name.toLowerCase(), d.id);
        });
      }

      if (newServiceTypes.length > 0) {
        const { data: insertedServiceTypes } = await supabase
          .from("service_types")
          .insert(newServiceTypes.map(name => ({ name, is_active: true })))
          .select("id, name");

        insertedServiceTypes?.forEach((s: any) => {
          serviceTypeMap.set(s.name.toLowerCase(), s.id);
        });
      }

      if (newSaleTypes.length > 0) {
        const { data: insertedSaleTypes } = await supabase
          .from("sale_types")
          .insert(newSaleTypes.map(name => ({ name, is_active: true })))
          .select("id, name");

        insertedSaleTypes?.forEach((s: any) => {
          saleTypeMap.set(s.name.toLowerCase(), s.id);
        });
      }

      const casesToInsert = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i] as any[];
        const rowNum = i + 2;

        try {
          if (!row || row.every(cell => !cell)) continue;

          const caseNumber = row[columnMap.case_number]?.toString().trim();
          if (!caseNumber) {
            results.errors.push(`Row ${rowNum}: Missing case number`);
            continue;
          }

          if (existingCaseNumbers.has(caseNumber)) {
            results.skipped++;
            continue;
          }

          const directorName = row[columnMap.director]?.toString().trim();
          const serviceTypeName = row[columnMap.service_type]?.toString().trim();
          const saleTypeName = row[columnMap.sale_type]?.toString().trim();

          if (!directorName) {
            results.errors.push(`Row ${rowNum}: Missing director name`);
            continue;
          }

          if (!serviceTypeName) {
            results.errors.push(`Row ${rowNum}: Missing service type`);
            continue;
          }

          const directorId = directorMap.get(directorName.toLowerCase());
          const serviceTypeId = serviceTypeMap.get(serviceTypeName.toLowerCase());
          const saleTypeId = saleTypeName ? saleTypeMap.get(saleTypeName.toLowerCase()) : null;

          if (!directorId || !serviceTypeId) {
            results.errors.push(`Row ${rowNum}: Could not find director or service type`);
            continue;
          }

          const dateOfDeath = parseExcelDate(row[columnMap.date_of_death]);
          if (!dateOfDeath) {
            results.errors.push(`Row ${rowNum}: Invalid date of death`);
            continue;
          }

          const customerFirstName = row[columnMap.customer_first_name]?.toString().trim() || '';
          const customerLastName = row[columnMap.customer_last_name]?.toString().trim() || '';

          if (!customerFirstName && !customerLastName) {
            results.errors.push(`Row ${rowNum}: Missing customer name`);
            continue;
          }

          casesToInsert.push({
            case_number: caseNumber,
            date_of_death: dateOfDeath,
            customer_first_name: customerFirstName,
            customer_last_name: customerLastName,
            service_type_id: serviceTypeId,
            sale_type_id: saleTypeId,
            director_id: directorId,
            date_paid_in_full: parseExcelDate(row[columnMap.date_paid_in_full]),
            payments_received: parseNumber(row[columnMap.payments_received]),
            average_age: parseNumber(row[columnMap.aging]),
            total_sale: parseNumber(row[columnMap.total_sale]),
            created_at: new Date().toISOString(),
          });

        } catch (error: any) {
          results.errors.push(`Row ${rowNum}: ${error.message}`);
        }
      }

      if (casesToInsert.length > 0) {
        const BATCH_SIZE = 500;
        for (let i = 0; i < casesToInsert.length; i += BATCH_SIZE) {
          const batch = casesToInsert.slice(i, i + BATCH_SIZE);
          const { error } = await supabase.from("cases").insert(batch);

          if (error) {
            results.errors.push(`Batch error (rows ${i + 2} to ${i + batch.length + 1}): ${error.message}`);
          } else {
            results.imported += batch.length;
          }
        }
      }

      return new Response(
        JSON.stringify(results),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ detail: "Endpoint not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Import Error:", error);
    return new Response(
      JSON.stringify({ detail: error.message || "An error occurred during import" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
