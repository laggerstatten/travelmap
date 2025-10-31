Got it — here’s the same content properly formatted as Markdown (ready to save as docs/supabase-edge-functions.md):

# 🧭 Writing a Supabase Edge Function That Connects to Your Database

## 1. Overview

Supabase **Edge Functions** run server-side (using Deno) and can securely interact with your project’s Postgres database via the **Supabase JavaScript client**.  
They are ideal for performing API-like logic, spatial queries, or combining data from external services.

---

## 2. Basic Structure

Each function is a self-contained JavaScript or TypeScript file.  
The entry point uses `Deno.serve()` to handle HTTP requests.

```js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // Set CORS headers for browser access
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
  };

  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    // 1️⃣ Connect to your Supabase project
    const supabase = createClient(
      "https://<PROJECT-REF>.supabase.co",
      "<YOUR-ANON-KEY>"
    ).schema("public");

    // 2️⃣ Perform queries
    const { data, error } = await supabase
      .from("your_table")
      .select("*")
      .limit(5);

    if (error) throw error;

    // 3️⃣ Return results
    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

3. Setting Up Database Access

If you’re using the dashboard editor, you can hard-code the credentials (safe for anon read operations).
If you’re deploying with the Supabase CLI, use environment variables instead:

supabase functions deploy your-function-name \
  --no-verify-jwt \
  --env SUPABASE_URL="https://<PROJECT-REF>.supabase.co" \
  --env SUPABASE_ANON_KEY="YOUR-ANON-KEY"


Then inside the function:

const supabase = createClient(
  Deno.env.get("SUPABASE_URL"),
  Deno.env.get("SUPABASE_ANON_KEY")
).schema("public");

4. Handling CORS

If your frontend calls the function directly from a browser, always include CORS headers:

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};


And handle OPTIONS requests:

if (req.method === "OPTIONS")
  return new Response("ok", { headers: corsHeaders });

5. Database Permissions (RLS)

If your table has Row Level Security (RLS) enabled (default), you must create a policy to allow the function’s anon role to read data:

alter table public.your_table enable row level security;

create policy "Allow anon read"
on public.your_table
for select
to anon
using (true);


Without this policy, the query will succeed but return 0 rows.

6. Testing the Function

From the browser console or any HTTP client:

fetch("https://<PROJECT-REF>.functions.supabase.co/your-function-name")
  .then(r => r.json())
  .then(console.log);

7. Common Issues
Symptom	Likely Cause
401 Missing authorization header	Missing anon key or disabled JWT bypass
0 rows returned	RLS policy blocking access
relation does not exist	Wrong schema or table name
Could not find table in schema cache	Tried to query a system view (e.g., pg_catalog)
✅ Summary
Step	Description
1.	Write a Deno function with Deno.serve()
2.	Connect using createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
3.	Perform .select(), .insert(), etc. as usual
4.	Add CORS headers if accessed from a web app
5.	Enable and configure RLS policies
6.	Deploy and test via functions.supabase.co

---

Would you like me to add a short section at the bottom showing how to call your specific `identify
```
