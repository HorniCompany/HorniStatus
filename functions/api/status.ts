export async function onRequest(context) {
  try {
    const { env } = context;

    if (!env.DB) {
      throw new Error("env.DB is undefined. Database binding is missing.");
    }

    // Fetch all monitors from D1
    const stmt = env.DB.prepare("SELECT * FROM monitors ORDER BY id ASC");
    const { results } = await stmt.all();

    if (!results) {
      return new Response(JSON.stringify([]), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Prepare uptime queries for all monitors
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // We can't do a join easily for aggregation in D1 perfectly efficient yet without complex queries,
    // so let's try a subquery or separate query.
    // Optimization: Get stats for all monitors in one query if possible or iterate.
    const uptimeStmt = env.DB.prepare(
      `
      SELECT monitor_id, 
             COUNT(*) as total, 
             SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count 
      FROM heartbeats 
      WHERE timestamp > ? 
      GROUP BY monitor_id
    `,
    ).bind(oneDayAgo);

    const { results: uptimeResults } = await uptimeStmt.all();
    const uptimeMap = new Map();
    if (uptimeResults) {
      uptimeResults.forEach((r) => {
        const total = r.total || 0;
        const up = r.up_count || 0;
        const pct = total > 0 ? (up / total) * 100 : 100; // Default 100 if no data? Or 0? Let's say 100 (new service)
        uptimeMap.set(r.monitor_id, pct);
      });
    }

    // Process results to look like our frontend expects
    const systems = results.map((row) => {
      // Check for stale data (dead man's switch)
      // If not seen in 90 seconds, consider DOWN
      const isStale = now - (row.last_seen || 0) > 90 * 1000;
      const finalStatus = isStale ? "down" : row.status;

      const calcUptime = uptimeMap.get(row.id);
      // If we have calculated uptime, use it. If not, and it's new, 100. If it's stale/down, maybe reflects in history.
      const uptime =
        calcUptime !== undefined ? parseFloat(calcUptime.toFixed(1)) : 100.0;

      return {
        id: row.id,
        name: row.name,
        type: row.type,
        status: finalStatus,
        uptime: uptime,
        latency: isStale ? 0 : row.latency,
        description: row.description,
      };
    });

    return new Response(JSON.stringify(systems), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
        details: err.message,
        stack: err.stack,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
}
