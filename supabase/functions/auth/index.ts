import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { encode } from "https://deno.land/std@0.220.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Auth-Token",
};

const JWT_SECRET = Deno.env.get("JWT_SECRET") || "behm-funeral-home-secret-key-2024";
const JWT_EXPIRATION_HOURS = 24;

function createJWT(payload: Record<string, unknown>): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (JWT_EXPIRATION_HOURS * 60 * 60);

  const fullPayload = { ...payload, iat: now, exp };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify(fullPayload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const data = `${encodedHeader}.${encodedPayload}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(JWT_SECRET);

  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  ).then(async (key) => {
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
    const signatureArray = new Uint8Array(signature);
    const signatureBase64 = btoa(String.fromCharCode(...signatureArray)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${data}.${signatureBase64}`;
  });
}

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

async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
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
    const path = url.pathname.replace("/auth", "").replace("/", "");

    if (req.method === "POST" && path === "login") {
      const { email, password } = await req.json();

      const { data: users, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .limit(1);

      if (error || !users || users.length === 0) {
        return new Response(
          JSON.stringify({ message: "Invalid email or password" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const user = users[0];
      const validPassword = await verifyPassword(password, user.password_hash);

      if (!validPassword) {
        return new Response(
          JSON.stringify({ message: "Invalid email or password" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!user.is_active) {
        return new Response(
          JSON.stringify({ message: "Account is deactivated" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const token = await createJWT({ sub: user.id });
      const { password_hash: _, ...userWithoutPassword } = user;

      return new Response(
        JSON.stringify({ access_token: token, token_type: "bearer", user: userWithoutPassword }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "POST" && path === "register") {
      const { email, password, name, role = "director", director_id = null, can_edit_cases = false } = await req.json();

      const { data: existing } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .limit(1);

      if (existing && existing.length > 0) {
        return new Response(
          JSON.stringify({ message: "Email already registered" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const hashedPassword = await hashPassword(password);
      const newUser = {
        email,
        name,
        role,
        director_id,
        can_edit_cases,
        is_active: true,
        password_hash: hashedPassword,
        created_at: new Date().toISOString(),
      };

      const { data: insertedUsers, error } = await supabase
        .from("users")
        .insert(newUser)
        .select();

      if (error) {
        return new Response(
          JSON.stringify({ message: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const user = insertedUsers[0];
      const token = await createJWT({ sub: user.id });
      const { password_hash: _, ...userWithoutPassword } = user;

      return new Response(
        JSON.stringify({ access_token: token, token_type: "bearer", user: userWithoutPassword }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "GET" && path === "me") {
      const authToken = req.headers.get("X-Auth-Token");

      if (!authToken) {
        return new Response(
          JSON.stringify({ message: "No token provided" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const payload = await verifyJWT(authToken);

      if (!payload || !payload.sub) {
        return new Response(
          JSON.stringify({ message: "Invalid token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: users, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", payload.sub)
        .eq("is_active", true)
        .limit(1);

      if (error || !users || users.length === 0) {
        return new Response(
          JSON.stringify({ message: "User not found" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { password_hash: _, ...userWithoutPassword } = users[0];
      return new Response(
        JSON.stringify(userWithoutPassword),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "POST" && path === "seed") {
      const { data: existingAdmin } = await supabase
        .from("users")
        .select("id")
        .eq("email", "admin@behmfuneral.com")
        .limit(1);

      if (existingAdmin && existingAdmin.length > 0) {
        return new Response(
          JSON.stringify({ message: "Data already seeded" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const adminPassword = await hashPassword("admin123");
      const directorPassword = await hashPassword("director123");

      await supabase.from("users").insert([
        {
          email: "admin@behmfuneral.com",
          name: "Administrator",
          role: "admin",
          director_id: null,
          can_edit_cases: true,
          is_active: true,
          password_hash: adminPassword,
          created_at: new Date().toISOString(),
        },
        {
          email: "eric@behmfuneral.com",
          name: "Eric Behm",
          role: "director",
          director_id: "11111111-1111-1111-1111-111111111111",
          can_edit_cases: true,
          is_active: true,
          password_hash: directorPassword,
          created_at: new Date().toISOString(),
        }
      ]);

      return new Response(
        JSON.stringify({ message: "Data seeded successfully" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ message: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ message: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
