import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const body = await req.json();
    const lat = parseFloat(body.lat);
    const lng = parseFloat(body.lng);
    const radius_miles = body.radius_miles
      ? parseFloat(body.radius_miles)
      : 500;

    if (isNaN(lat) || isNaN(lng)) {
      return new Response(
        JSON.stringify({
          error: 'Missing or invalid lat/lng'
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    const supabase = createClient(
      'https://czuldnytepaujjkjpwqi.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6dWxkbnl0ZXBhdWpqa2pwd3FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NzE0NTQsImV4cCI6MjA3NzI0NzQ1NH0.8OPIxFz3bHcxQEebxwt6j4USC-8AYjRjzPhuoxtrblo'
    ).schema('public');
    const table = 'aza';
    const fields = 'aza_id,Name,City,State,CenterPointLong,CenterPointLat';

    const { data, error } = await supabase.from(table).select(fields);

    if (error) throw error;
    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({
          count: 0,
          results: []
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Compute distances (haversine)
    const R = 3958.8; // Earth radius in miles
    const results = data
      .map((r) => {
        const dLat = ((r.CenterPointLat - lat) * Math.PI) / 180;
        const dLon = ((r.CenterPointLong - lng) * Math.PI) / 180;
        const lat1 = (lat * Math.PI) / 180;
        const lat2 = (r.CenterPointLat * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance_mi = R * c;
        return {
          ...r,
          distance_mi
        };
      })
      .filter((r) => r.distance_mi <= radius_miles)
      .sort((a, b) => a.distance_mi - b.distance_mi);

    return new Response(
      JSON.stringify({
        query: {
          lat,
          lng,
          radius_miles
        },
        count: results.length,
        results
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (err) {
    console.error('Error:', err);
    return new Response(
      JSON.stringify({
        error: err.message
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});
