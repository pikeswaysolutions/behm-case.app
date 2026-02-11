import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const url = new URL(req.url);
    const path = url.pathname.replace("/auth", "").replace("/", "");

    if (req.method === "POST" && path === "seed") {
      const { data: existingAdmin } = await supabase
        .from("users")
        .select("id, auth_id")
        .eq("email", "admin@behmfuneral.com")
        .maybeSingle();

      if (existingAdmin?.auth_id) {
        return new Response(
          JSON.stringify({ message: "Data already seeded" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const usersToSeed = [
        {
          email: "admin@behmfuneral.com",
          password: "admin123",
          name: "Administrator",
          role: "admin",
          director_id: null,
          can_edit_cases: true,
        },
        {
          email: "eric@behmfuneral.com",
          password: "director123",
          name: "Eric Behm",
          role: "director",
          director_id: "11111111-1111-1111-1111-111111111111",
          can_edit_cases: true,
        }
      ];

      for (const userData of usersToSeed) {
        const { data: existingUser } = await supabase
          .from("users")
          .select("id, auth_id")
          .eq("email", userData.email)
          .maybeSingle();

        if (existingUser?.auth_id) {
          continue;
        }

        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: userData.email,
          password: userData.password,
          email_confirm: true
        });

        if (authError) {
          console.error(`Failed to create auth user for ${userData.email}:`, authError.message);
          continue;
        }

        if (existingUser) {
          await supabase
            .from("users")
            .update({ auth_id: authData.user.id })
            .eq("id", existingUser.id);
        } else {
          await supabase.from("users").insert({
            email: userData.email,
            name: userData.name,
            role: userData.role,
            director_id: userData.director_id,
            can_edit_cases: userData.can_edit_cases,
            is_active: true,
            auth_id: authData.user.id,
            created_at: new Date().toISOString(),
          });
        }
      }

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
    console.error("Auth Error:", error);
    return new Response(
      JSON.stringify({ message: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
