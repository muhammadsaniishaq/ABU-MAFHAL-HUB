import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { field, value, table = "profiles", filters = {} } = await req.json();

    if (!value || !field) {
      return new Response(
        JSON.stringify({ error: "Invalid parameters" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Check availability in profiles table (admin access)
    // Prepare Query
    console.log(`Checking ${table}.${field} for value: ${value}`);
    // deno-lint-ignore no-explicit-any
    let query: any = (supabaseClient as any)
      .from(table)
      .select(field)
      .eq(field, value);

    // Apply additional filters (e.g. { document_type: 'nin' })
    if (filters && Object.keys(filters).length > 0) {
        Object.entries(filters).forEach(([key, val]) => {
            console.log(`Adding filter: ${key}=${val}`);
            query = query.eq(key, val);
        });
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
        console.error("Query Error:", error);
        throw error;
    }

    // If data exists, it's TAKEN.
    const isAvailable = !data;
    console.log(`Result: ${isAvailable ? 'Available' : 'Taken'}`);

    // Suggest usernames if taken and checking username (only for profiles)
    let suggestions: string[] = [];
    if (!isAvailable && field === 'username' && table === 'profiles') {
       const _base = value.replace(/[0-9]/g, '');
       const suffix = Math.floor(Math.random() * 1000);
       const year = new Date().getFullYear();
       suggestions = [
           `${value}${suffix}`,
           `${value}${year}`,
           `real${value}`
       ];
    }

    return new Response(
      JSON.stringify({ available: isAvailable, suggestions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
