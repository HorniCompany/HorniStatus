export async function onRequest(context) {
  const { env } = context;

  // Fetch all monitors from D1
  const { results } = await env.DB.prepare(
    "SELECT * FROM monitors ORDER BY id ASC",
  ).all();

  // Process results to look like our frontend expects
  const systems = results.map((row) => {
    // Check for stale data (dead man's switch)
    // If not seen in 90 seconds, consider DOWN
    const isStale = Date.now() - (row.last_seen || 0) > 90 * 1000;
    const finalStatus = isStale ? "down" : row.status;

    return {
      id: row.id,
      name: row.name,
      type: row.type,
      status: finalStatus,
      uptime: 99.9, // TODO: calculate from heartbeats
      latency: isStale ? 0 : row.latency,
      description: row.description,
    };
  });

  return new Response(JSON.stringify(systems), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
