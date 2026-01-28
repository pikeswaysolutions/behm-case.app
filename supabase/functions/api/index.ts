import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Auth-Token",
};

const JWT_SECRET = Deno.env.get("JWT_SECRET") || "behm-funeral-home-secret-key-2024";

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

async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const pathParts = url.pathname.replace("/api/", "").split("/").filter(Boolean);
    const resource = pathParts[0];
    const resourceId = pathParts[1];

    const authToken = req.headers.get("X-Auth-Token");
    const currentUser = await getCurrentUser(supabase, authToken);

    if (!currentUser && resource !== "health") {
      return new Response(
        JSON.stringify({ message: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isAdmin = currentUser?.role === "admin";

    // DIRECTORS
    if (resource === "directors") {
      if (req.method === "GET") {
        const { data, error } = await supabase.from("directors").select("*");
        if (error) throw error;
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (req.method === "POST" && isAdmin) {
        const body = await req.json();
        const { data, error } = await supabase.from("directors").insert({
          name: body.name,
          is_active: body.is_active ?? true,
          created_at: new Date().toISOString(),
        }).select();
        if (error) throw error;
        return new Response(JSON.stringify(data[0]), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (req.method === "PUT" && resourceId && isAdmin) {
        const body = await req.json();
        const { data, error } = await supabase.from("directors").update({ name: body.name, is_active: body.is_active }).eq("id", resourceId).select();
        if (error) throw error;
        return new Response(JSON.stringify(data[0]), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (req.method === "DELETE" && resourceId && isAdmin) {
        await supabase.from("directors").update({ is_active: false }).eq("id", resourceId);
        return new Response(JSON.stringify({ message: "Director deactivated" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // SERVICE TYPES
    if (resource === "service-types") {
      if (req.method === "GET") {
        const { data, error } = await supabase.from("service_types").select("*");
        if (error) throw error;
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (req.method === "POST" && isAdmin) {
        const body = await req.json();
        const { data, error } = await supabase.from("service_types").insert({ name: body.name, is_active: body.is_active ?? true }).select();
        if (error) throw error;
        return new Response(JSON.stringify(data[0]), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (req.method === "PUT" && resourceId && isAdmin) {
        const body = await req.json();
        const { data, error } = await supabase.from("service_types").update({ name: body.name, is_active: body.is_active }).eq("id", resourceId).select();
        if (error) throw error;
        return new Response(JSON.stringify(data[0]), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (req.method === "DELETE" && resourceId && isAdmin) {
        await supabase.from("service_types").update({ is_active: false }).eq("id", resourceId);
        return new Response(JSON.stringify({ message: "Service type deactivated" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // SALE TYPES
    if (resource === "sale-types") {
      if (req.method === "GET") {
        const { data, error } = await supabase.from("sale_types").select("*");
        if (error) throw error;
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (req.method === "POST" && isAdmin) {
        const body = await req.json();
        const { data, error } = await supabase.from("sale_types").insert({ name: body.name, is_active: body.is_active ?? true }).select();
        if (error) throw error;
        return new Response(JSON.stringify(data[0]), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (req.method === "PUT" && resourceId && isAdmin) {
        const body = await req.json();
        const { data, error } = await supabase.from("sale_types").update({ name: body.name, is_active: body.is_active }).eq("id", resourceId).select();
        if (error) throw error;
        return new Response(JSON.stringify(data[0]), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (req.method === "DELETE" && resourceId && isAdmin) {
        await supabase.from("sale_types").update({ is_active: false }).eq("id", resourceId);
        return new Response(JSON.stringify({ message: "Sale type deactivated" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // CASES
    if (resource === "cases") {
      if (req.method === "GET" && !resourceId) {
        let query = supabase.from("cases_enriched").select("*");

        if (!isAdmin && currentUser.director_id) {
          query = query.eq("director_id", currentUser.director_id);
        } else if (!isAdmin) {
          return new Response(JSON.stringify([]), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const directorId = url.searchParams.get("director_id");
        const startDate = url.searchParams.get("start_date");
        const endDate = url.searchParams.get("end_date");

        if (directorId && isAdmin) query = query.eq("director_id", directorId);
        if (startDate) query = query.gte("date_of_death", startDate);
        if (endDate) query = query.lte("date_of_death", endDate);

        const { data, error } = await query;
        if (error) throw error;

        const enriched = data.map((c: any) => ({
          ...c,
          total_balance_due: (c.total_sale || 0) - (c.payments_received || 0)
        }));

        return new Response(JSON.stringify(enriched), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (req.method === "GET" && resourceId) {
        const { data, error } = await supabase.from("cases_enriched").select("*").eq("id", resourceId).limit(1);
        if (error) throw error;
        if (!data || data.length === 0) {
          return new Response(JSON.stringify({ message: "Case not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const caseData = data[0];
        if (!isAdmin && caseData.director_id !== currentUser.director_id) {
          return new Response(JSON.stringify({ message: "Access denied" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        caseData.total_balance_due = (caseData.total_sale || 0) - (caseData.payments_received || 0);
        return new Response(JSON.stringify(caseData), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (req.method === "POST") {
        if (!isAdmin && !currentUser.can_edit_cases) {
          return new Response(JSON.stringify({ message: "Permission denied" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const body = await req.json();

        const { data: existing } = await supabase.from("cases").select("id").eq("case_number", body.case_number).limit(1);
        if (existing && existing.length > 0) {
          return new Response(JSON.stringify({ message: "Case number already exists" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const { data, error } = await supabase.from("cases").insert({
          case_number: body.case_number,
          date_of_death: body.date_of_death,
          customer_first_name: body.customer_first_name,
          customer_last_name: body.customer_last_name,
          service_type_id: body.service_type_id,
          sale_type_id: body.sale_type_id,
          director_id: body.director_id,
          date_paid_in_full: body.date_paid_in_full,
          payments_received: body.payments_received || 0,
          average_age: body.average_age,
          total_sale: body.total_sale || 0,
          created_at: new Date().toISOString(),
        }).select();

        if (error) throw error;

        const { data: enriched } = await supabase.from("cases_enriched").select("*").eq("id", data[0].id).limit(1);
        const result = enriched[0];
        result.total_balance_due = (result.total_sale || 0) - (result.payments_received || 0);

        return new Response(JSON.stringify(result), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (req.method === "PUT" && resourceId) {
        const { data: existingCase } = await supabase.from("cases").select("*").eq("id", resourceId).limit(1);
        if (!existingCase || existingCase.length === 0) {
          return new Response(JSON.stringify({ message: "Case not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (!isAdmin) {
          if (existingCase[0].director_id !== currentUser.director_id) {
            return new Response(JSON.stringify({ message: "Access denied" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          if (!currentUser.can_edit_cases) {
            return new Response(JSON.stringify({ message: "Permission denied" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }

        const body = await req.json();
        const updateData: any = {};

        if (body.case_number !== undefined) updateData.case_number = body.case_number;
        if (body.date_of_death !== undefined) updateData.date_of_death = body.date_of_death;
        if (body.customer_first_name !== undefined) updateData.customer_first_name = body.customer_first_name;
        if (body.customer_last_name !== undefined) updateData.customer_last_name = body.customer_last_name;
        if (body.service_type_id !== undefined) updateData.service_type_id = body.service_type_id;
        if (body.sale_type_id !== undefined) updateData.sale_type_id = body.sale_type_id;
        if (body.director_id !== undefined) updateData.director_id = body.director_id;
        if (body.date_paid_in_full !== undefined) updateData.date_paid_in_full = body.date_paid_in_full;
        if (body.payments_received !== undefined) updateData.payments_received = body.payments_received;
        if (body.average_age !== undefined) updateData.average_age = body.average_age;
        if (body.total_sale !== undefined) updateData.total_sale = body.total_sale;

        await supabase.from("cases").update(updateData).eq("id", resourceId);

        const { data: enriched } = await supabase.from("cases_enriched").select("*").eq("id", resourceId).limit(1);
        const result = enriched[0];
        result.total_balance_due = (result.total_sale || 0) - (result.payments_received || 0);

        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (req.method === "DELETE" && resourceId && isAdmin) {
        await supabase.from("cases").delete().eq("id", resourceId);
        return new Response(JSON.stringify({ message: "Case deleted" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // USERS (Admin only)
    if (resource === "users" && isAdmin) {
      if (req.method === "GET" && !resourceId) {
        const { data, error } = await supabase.from("users").select("id, email, name, role, director_id, can_edit_cases, is_active, created_at");
        if (error) throw error;
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (req.method === "POST") {
        const body = await req.json();

        const { data: existing } = await supabase.from("users").select("id").eq("email", body.email).limit(1);
        if (existing && existing.length > 0) {
          return new Response(JSON.stringify({ message: "Email already registered" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const hashedPassword = await hashPassword(body.password);
        const { data, error } = await supabase.from("users").insert({
          email: body.email,
          name: body.name,
          role: body.role || "director",
          director_id: body.director_id,
          can_edit_cases: body.can_edit_cases ?? false,
          is_active: true,
          password_hash: hashedPassword,
          created_at: new Date().toISOString(),
        }).select("id, email, name, role, director_id, can_edit_cases, is_active, created_at");

        if (error) throw error;
        return new Response(JSON.stringify(data[0]), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (req.method === "PUT" && resourceId) {
        const body = await req.json();
        const updateData: any = {};

        if (body.name !== undefined) updateData.name = body.name;
        if (body.role !== undefined) updateData.role = body.role;
        if (body.director_id !== undefined) updateData.director_id = body.director_id;
        if (body.can_edit_cases !== undefined) updateData.can_edit_cases = body.can_edit_cases;
        if (body.is_active !== undefined) updateData.is_active = body.is_active;
        if (body.password) updateData.password_hash = await hashPassword(body.password);

        const { data, error } = await supabase.from("users").update(updateData).eq("id", resourceId).select("id, email, name, role, director_id, can_edit_cases, is_active, created_at");
        if (error) throw error;
        return new Response(JSON.stringify(data[0]), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (req.method === "DELETE" && resourceId) {
        await supabase.from("users").update({ is_active: false }).eq("id", resourceId);
        return new Response(JSON.stringify({ message: "User deactivated" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // REPORTS/DASHBOARD
    if (resource === "reports") {
      const reportType = resourceId;

      if (reportType === "dashboard" && req.method === "GET") {
        let query = supabase.from("cases_enriched").select("*");

        if (!isAdmin && currentUser.director_id) {
          query = query.eq("director_id", currentUser.director_id);
        }

        const startDate = url.searchParams.get("start_date");
        const endDate = url.searchParams.get("end_date");
        const directorId = url.searchParams.get("director_id");

        if (startDate) query = query.gte("date_of_death", startDate);
        if (endDate) query = query.lte("date_of_death", endDate);
        if (directorId && isAdmin && directorId !== "all") query = query.eq("director_id", directorId);

        const { data: cases } = await query;
        const { data: directors } = await supabase.from("directors").select("*").eq("is_active", true);

        const directorMap: Record<string, string> = {};
        directors?.forEach((d: any) => { directorMap[d.id] = d.name; });

        const directorMetrics: Record<string, any> = {};
        cases?.forEach((c: any) => {
          const did = c.director_id;
          if (!directorMetrics[did]) {
            directorMetrics[did] = {
              director_id: did,
              director_name: directorMap[did] || "Unknown",
              case_count: 0,
              total_sales: 0,
              payments_received: 0,
              total_balance_due: 0,
              ages: []
            };
          }
          const dm = directorMetrics[did];
          dm.case_count += 1;
          dm.total_sales += Number(c.total_sale || 0);
          dm.payments_received += Number(c.payments_received || 0);
          dm.total_balance_due += Number(c.total_sale || 0) - Number(c.payments_received || 0);
          if (c.average_age) dm.ages.push(Number(c.average_age));
        });

        Object.values(directorMetrics).forEach((dm: any) => {
          dm.average_age = dm.ages.length > 0 ? dm.ages.reduce((a: number, b: number) => a + b, 0) / dm.ages.length : 0;
          delete dm.ages;
        });

        const allAges = cases?.filter((c: any) => c.average_age).map((c: any) => Number(c.average_age)) || [];
        const grandTotals = {
          case_count: Object.values(directorMetrics).reduce((sum: number, dm: any) => sum + dm.case_count, 0),
          total_sales: Object.values(directorMetrics).reduce((sum: number, dm: any) => sum + dm.total_sales, 0),
          payments_received: Object.values(directorMetrics).reduce((sum: number, dm: any) => sum + dm.payments_received, 0),
          total_balance_due: Object.values(directorMetrics).reduce((sum: number, dm: any) => sum + dm.total_balance_due, 0),
          average_age: allAges.length > 0 ? allAges.reduce((a, b) => a + b, 0) / allAges.length : 0
        };

        const grouping = url.searchParams.get("grouping") || "monthly";
        const timeSeries: Record<string, any> = {};

        const getWeekEndingSunday = (date: Date): string => {
          const d = new Date(date);
          const dayOfWeek = d.getDay();
          const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
          const sunday = new Date(d);
          sunday.setDate(d.getDate() + daysUntilSunday);
          return sunday.toISOString().substring(0, 10);
        };

        const getQuarter = (date: Date): string => {
          const month = date.getMonth();
          const quarter = Math.floor(month / 3) + 1;
          return `${date.getFullYear()}-Q${quarter}`;
        };

        cases?.forEach((c: any) => {
          if (!c.date_of_death) return;

          const date = new Date(c.date_of_death);
          let period: string;

          if (grouping === "weekly") {
            period = getWeekEndingSunday(date);
          } else if (grouping === "monthly") {
            period = c.date_of_death.substring(0, 7);
          } else if (grouping === "quarterly") {
            period = getQuarter(date);
          } else {
            period = c.date_of_death.substring(0, 4);
          }

          if (!timeSeries[period]) {
            timeSeries[period] = { period, cases: 0, sales: 0, payments: 0 };
          }
          timeSeries[period].cases += 1;
          timeSeries[period].sales += Number(c.total_sale || 0);
          timeSeries[period].payments += Number(c.payments_received || 0);
        });

        return new Response(JSON.stringify({
          director_metrics: Object.values(directorMetrics),
          grand_totals: grandTotals,
          time_series: Object.values(timeSeries).sort((a: any, b: any) => a.period.localeCompare(b.period))
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (reportType === "director" && pathParts[2] && req.method === "GET") {
        const directorId = pathParts[2];

        if (!isAdmin && currentUser.director_id !== directorId) {
          return new Response(JSON.stringify({ message: "Access denied" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        let query = supabase.from("cases_enriched").select("*").eq("director_id", directorId);

        const startDate = url.searchParams.get("start_date");
        const endDate = url.searchParams.get("end_date");

        if (startDate) query = query.gte("date_of_death", startDate);
        if (endDate) query = query.lte("date_of_death", endDate);

        const { data: cases } = await query;
        const enrichedCases = cases?.map((c: any) => ({
          ...c,
          total_balance_due: (c.total_sale || 0) - (c.payments_received || 0)
        })) || [];

        const casesWithAge = enrichedCases.filter((c: any) => c.average_age);
        const metrics = {
          case_count: enrichedCases.length,
          total_sales: enrichedCases.reduce((sum: number, c: any) => sum + Number(c.total_sale || 0), 0),
          payments_received: enrichedCases.reduce((sum: number, c: any) => sum + Number(c.payments_received || 0), 0),
          total_balance_due: enrichedCases.reduce((sum: number, c: any) => sum + c.total_balance_due, 0),
          average_age: casesWithAge.length > 0 ? casesWithAge.reduce((sum: number, c: any) => sum + Number(c.average_age), 0) / casesWithAge.length : 0
        };

        return new Response(JSON.stringify({ cases: enrichedCases, metrics }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Health check
    if (resource === "health") {
      return new Response(JSON.stringify({ status: "ok" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(
      JSON.stringify({ message: "Not found or forbidden" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("API Error:", error);
    return new Response(
      JSON.stringify({ message: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
