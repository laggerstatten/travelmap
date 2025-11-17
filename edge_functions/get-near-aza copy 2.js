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
		const lineString = body.lineString;
		const radius_miles = body.radius_miles
			? parseFloat(body.radius_miles)
			: 500;

		const usingLine =
			lineString &&
			lineString.type === 'LineString' &&
			Array.isArray(lineString.coordinates) &&
			lineString.coordinates.length >= 2;

		if (!usingLine && (isNaN(lat) || isNaN(lng))) {
			return new Response(
				JSON.stringify({ 
					error: 'Missing or invalid lat/lng OR lineString' 
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

		// ================================
		//  DISTANCE HELPERS
		// ================================
		const R = 3958.8; // Earth radius in miles

		// Haversine
		function haversine(lat1, lon1, lat2, lon2) {
			const dLat = ((lat2 - lat1) * Math.PI) / 180;
			const dLon = ((lon2 - lon1) * Math.PI) / 180;
			const r1 = (lat1 * Math.PI) / 180;
			const r2 = (lat2 * Math.PI) / 180;
			const a =
				Math.sin(dLat / 2) ** 2 +
				Math.cos(r1) * Math.cos(r2) * Math.sin(dLon / 2) ** 2;
			const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
			return R * c;
		}

		// Convert lat/lon → pseudo-cartesian unit vector
		function toVec(lat, lon) {
			lat = (lat * Math.PI) / 180;
			lon = (lon * Math.PI) / 180;
			return [
				Math.cos(lat) * Math.cos(lon),
				Math.cos(lat) * Math.sin(lon),
				Math.sin(lat)
			];
		}

		// Point → segment distance approximation
		function pointToSegmentDistance(lat, lon, A, B) {
			const P = toVec(lat, lon);
			const A3 = toVec(A[1], A[0]);
			const B3 = toVec(B[1], B[0]);

			const AB = [B3[0] - A3[0], B3[1] - A3[1], B3[2] - A3[2]];
			const AP = [P[0] - A3[0], P[1] - A3[1], P[2] - A3[2]];

			const ab2 = AB[0] ** 2 + AB[1] ** 2 + AB[2] ** 2;
			if (ab2 === 0) return haversine(lat, lon, A[1], A[0]);

			const t = Math.max(
				0,
				Math.min(1, (AP[0] * AB[0] + AP[1] * AB[1] + AP[2] * AB[2]) / ab2)
			);

			const closest = [A3[0] + AB[0] * t, A3[1] + AB[1] * t, A3[2] + AB[2] * t];

			// convert closest point back to lat/lon
			const hyp = Math.sqrt(closest[0] ** 2 + closest[1] ** 2);
			const latC = (Math.atan2(closest[2], hyp) * 180) / Math.PI;
			const lonC = (Math.atan2(closest[1], closest[0]) * 180) / Math.PI;

			return haversine(lat, lon, latC, lonC);
		}

		function distanceToLineString(lat, lon, coords) {
			let best = Infinity;
			for (let i = 0; i < coords.length - 1; i++) {
				const segDist = pointToSegmentDistance(
					lat,
					lon,
					coords[i],
					coords[i + 1]
				);
				if (segDist < best) best = segDist;
			}
			return best;
		}

		// ================================
		//  APPLY DISTANCE MODE
		// ================================
		const coords = usingLine ? lineString.coordinates : null;
		const results = data
			.map((r) => {
				let d;

				if (usingLine) {
					// distance to route corridor
					d = distanceToLineString(
						r.CenterPointLat, r.CenterPointLong, coords);
				} else {
					// distance to single point
					d = haversine(
						lat, lng, r.CenterPointLat, r.CenterPointLong);
				}

				return {
					...r,
					distance_mi: d
				};
			})
			.filter((r) => r.distance_mi <= radius_miles)
			.sort((a, b) => a.distance_mi - b.distance_mi);

		return new Response(
			JSON.stringify({
				query: usingLine
					? { 
						lineString, 
						radius_miles 
					}
					: {
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
