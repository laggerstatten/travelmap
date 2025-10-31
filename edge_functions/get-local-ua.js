import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
Deno.serve(async(req) => {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
    };
    if (req.method === "OPTIONS") {
        return new Response("ok", {
            headers: corsHeaders
        });
    }
    try {
        const body = await req.json();
        const { id_csa, id_cbsa } = body || {};
        if (!id_csa && !id_cbsa) {
            return new Response(JSON.stringify({
                error: "Missing geography IDs"
            }), {
                status: 400,
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json"
                }
            });
        }
        // connect to your Supabase project
        const supabase = createClient("https://czuldnytepaujjkjpwqi.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6dWxkbnl0ZXBhdWpqa2pwd3FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NzE0NTQsImV4cCI6MjA3NzI0NzQ1NH0.8OPIxFz3bHcxQEebxwt6j4USC-8AYjRjzPhuoxtrblo").schema("public");
        const fields = "id_ua,text_ua,val_pop_ua,id_cbsa,text_cbsa,id_csa,text_csa,longitude,latitude";
        let results = [];
        const seen = new Set();
        // --- query by CBSA ---
        if (id_cbsa) {
            const { data, error } = await supabase
                .from("urbanarea_ident")
                .select(fields)
                .eq("id_cbsa", id_cbsa);
            if (error) throw error;
            if (data && data.length) {
                data.forEach((row) => {
                    if (!seen.has(row.id_ua)) {
                        seen.add(row.id_ua);
                        results.push(row);
                    }
                });
            }
        }
        // --- query by CSA ---
        if (id_csa) {
            const { data, error } = await supabase
                .from("urbanarea_ident")
                .select(fields)
                .eq("id_csa", id_csa);
            if (error) throw error;
            if (data && data.length) {
                data.forEach((row) => {
                    if (!seen.has(row.id_ua)) {
                        seen.add(row.id_ua);
                        results.push(row);
                    }
                });
            }
        }
        // sort alphabetically
        results.sort((a, b) => a.text_ua.localeCompare(b.text_ua));
        return new Response(
            JSON.stringify({
                query: {
                    id_csa,
                    id_cbsa
                },
                count: results.length,
                results
            }), {
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json"
                }
            });
    } catch (err) {
        console.error("Error:", err);
        return new Response(JSON.stringify({
            error: err.message
        }), {
            status: 500,
            headers: {
                ...corsHeaders,
                "Content-Type": "application/json"
            }
        });
    }
});