export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { monitor_id, latency, status, secret } = await request.json();

    // Verify Secret
    // Note: Ideally move this to Cloudflare secret var, but for now hardcoded fallback is acceptable if Env missing
    const VALID_SECRET =
      env.API_SECRET || "qL*_=,D,cz**xu3yi~7N\~e9q5cikS`',#=7nX5@";

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
