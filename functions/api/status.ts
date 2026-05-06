// GET /api/status
//
// Returns one row per monitor with:
//   - current status (with a 90s dead-man's switch on last_seen)
//   - 24h uptime % (used for the headline number)
//   - 90 daily buckets of historical uptime (used by the UptimeBars widget)
//
// All aggregations happen here in D1 so the client only needs a single fetch.

const HISTORY_DAYS = 90;
const STALE_AFTER_MS = 90 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

type Bucket = { date: string; uptime: number | null; total: number };

export async function onRequest(context) {
  try {
    const { env } = context;
    if (!env.DB) {
      throw new Error('env.DB is undefined. Database binding is missing.');
    }

    // 1. All registered monitors.
    const { results: monitors } = await env.DB
      .prepare('SELECT * FROM monitors ORDER BY id ASC')
      .all();
    if (!monitors || monitors.length === 0) {
      return jsonResponse([]);
    }

    const now = Date.now();
    const dayAgo = now - DAY_MS;
    const historyStart = now - HISTORY_DAYS * DAY_MS;

    // 2. 24h uptime for the headline number.
    const { results: uptime24 } = await env.DB
      .prepare(`
        SELECT monitor_id,
               COUNT(*) AS total,
               SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) AS up_count
          FROM heartbeats
         WHERE timestamp > ?
         GROUP BY monitor_id
      `)
      .bind(dayAgo)
      .all();
    const uptime24Map = new Map<string, number>();
    for (const r of (uptime24 ?? []) as Array<{ monitor_id: string; total: number; up_count: number }>) {
      const total = Number(r.total) || 0;
      const up = Number(r.up_count) || 0;
      if (total > 0) uptime24Map.set(r.monitor_id, (up / total) * 100);
    }

    // 3. 90-day daily buckets in one pass. SQLite gives us a stable yyyy-mm-dd
    //    via strftime which is ideal for the chart.
    const { results: dailyRows } = await env.DB
      .prepare(`
        SELECT monitor_id,
               strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch') AS day,
               COUNT(*) AS total,
               SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) AS up_count
          FROM heartbeats
         WHERE timestamp > ?
         GROUP BY monitor_id, day
      `)
      .bind(historyStart)
      .all();

    // Group rows by monitor_id for fast lookup.
    const byMonitor = new Map<string, Map<string, { total: number; up: number }>>();
    for (const r of (dailyRows ?? []) as Array<{ monitor_id: string; day: string; total: number; up_count: number }>) {
      const inner = byMonitor.get(r.monitor_id) ?? new Map();
      inner.set(r.day, { total: Number(r.total) || 0, up: Number(r.up_count) || 0 });
      byMonitor.set(r.monitor_id, inner);
    }

    // Pre-compute the list of yyyy-mm-dd labels for the last 90 days, oldest first.
    // Doing this once outside the loop keeps response generation O(n_monitors) not O(n*90).
    const dayLabels: string[] = [];
    for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
      const d = new Date(now - i * DAY_MS);
      dayLabels.push(d.toISOString().slice(0, 10)); // YYYY-MM-DD
    }

    // 4. Project everything into the response shape the frontend expects.
    const systems = (monitors as Array<{
      id: string; name: string; type: string; description: string;
      last_seen: number | null; status: string; latency: number | null;
    }>).map((row) => {
      const isStale = now - (row.last_seen || 0) > STALE_AFTER_MS;
      const status = isStale ? 'down' : row.status;

      const inner = byMonitor.get(row.id) ?? new Map();
      const history: Bucket[] = dayLabels.map((day) => {
        const bucket = inner.get(day);
        if (!bucket || bucket.total === 0) return { date: day, uptime: null, total: 0 };
        return { date: day, uptime: (bucket.up / bucket.total) * 100, total: bucket.total };
      });

      const calc24 = uptime24Map.get(row.id);
      // If we have no data at all, expose null so the UI can show "—" rather
      // than misleading 100%.
      const uptime = calc24 !== undefined ? roundTo(calc24, 2) : null;

      return {
        id: row.id,
        name: row.name,
        type: row.type,
        description: row.description,
        status,
        latency: isStale ? 0 : (row.latency ?? 0),
        uptime,
        history,
      };
    });

    return jsonResponse(systems);
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        details: (err as Error).message,
      }),
      { status: 500, headers: corsHeaders('application/json') },
    );
  }
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    headers: {
      ...corsHeaders('application/json'),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}

function corsHeaders(contentType: string): Record<string, string> {
  return {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
  };
}

function roundTo(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
