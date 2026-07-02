console.log("SUPABASE_SERVICE_ROLE_KEY defined:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("Length:", process.env.SUPABASE_SERVICE_ROLE_KEY.length);
  console.log("Starts with:", process.env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 10));
}
