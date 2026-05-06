export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { monitor_id, latency, status, secret } = await request.json();

    // Verify secret. The shared secret lives in the Cloudflare Pages env
    // (API_SECRET) so it never sits in git. If unset we fail closed.
    const VALID_SECRET = env.API_SECRET;
    if (!VALID_SECRET) {
      return new Response("Server misconfigured: API_SECRET not set", { status: 503 });
    }
    if (secret !== VALID_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Update Monitor Status
    const timestamp = Date.now();

    // 1. Update current status in 'monitors'
    await env.DB.prepare(
      "UPDATE monitors SET status = ?, latency = ?, last_seen = ? WHERE id = ?",
    )
      .bind(status, latency, timestamp, monitor_id)
      .run();

    // 2. Add entry to history 'heartbeats' (Optional: limit retention later)
    await env.DB.prepare(
      "INSERT INTO heartbeats (monitor_id, timestamp, latency, status) VALUES (?, ?, ?, ?)",
    )
      .bind(monitor_id, timestamp, latency, status)
      .run();

    return new Response(JSON.stringify({ success: true, timestamp }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
