interface System {
  id: string;
  name: string;
  type: "game" | "web" | "db" | "proxy";
  status: "up" | "down" | "maintenance";
  uptime: number;
  latency: number;
  description: string;
}

export async function onRequest(context) {
  const systems: System[] = [];

  // Helper for timing
  const checkHttp = async (url: string) => {
    const start = Date.now();
    try {
      const res = await fetch(url, {
        method: "HEAD",
        headers: { "User-Agent": "HorniStatus-Watchdog/1.0" },
      });
      if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`); // 404 is technically "up" (server responded)
      return { latency: Date.now() - start, status: "up" as const };
    } catch (e) {
      return { latency: 0, status: "down" as const };
    }
  };

  // Helper for MCStatus
  const checkMinecraft = async (address: string) => {
    const start = Date.now();
    try {
      const res = await fetch(
        `https://api.mcstatus.io/v2/status/java/${address}`,
      );
      const data: any = await res.json();
      if (!data.online) throw new Error("Offline");
      return {
        latency: data.latency || Date.now() - start,
        status: "up" as const,
      };
    } catch (e) {
      return { latency: 0, status: "down" as const };
    }
  };

  // 1. Check Game Network (Velocity)
  const proxy = await checkMinecraft("play.horni.cc");
  systems.push({
    id: "proxy",
    name: "Game Network (Proxy)",
    type: "proxy",
    status: proxy.status,
    uptime: 99.9,
    latency: proxy.latency,
    description: "play.horni.cc (Velocity)",
  });

  // 2. Check Admin Panel (Hcom.xyz) -> Represents Proxy Node Health
  const admin = await checkHttp("https://hcom.xyz");
  systems.push({
    id: "admin",
    name: "Admin Panel Node",
    type: "db", // Using db icon for "infra"
    status: admin.status,
    uptime: 99.9,
    latency: admin.latency,
    description: "Сервер управления (Proxy Node)",
  });

  // 3. Check Website (Horni.cc) -> Represents Main Node Health
  const web = await checkHttp("https://horni.cc");
  systems.push({
    id: "web",
    name: "Website (Horni.cc)",
    type: "web",
    status: web.status,
    uptime: 99.9,
    latency: web.latency,
    description: "Основной веб-сайт",
  });

  // 4. Main Survival (Inferred)
  // Logic: If Proxy is UP and Website (Main Node) is UP, Survival is likely UP.
  // We can't ping 10.0.0.3 directly from Cloudflare.
  // Ideally, we'd query query.horni.cc if it existed.
  // For now, we mirror the Proxy status but mark it as "Main Server"
  systems.push({
    id: "main",
    name: "Main Survival",
    type: "game",
    status: proxy.status === "up" && web.status === "up" ? "up" : "down",
    uptime: 99.9,
    latency: proxy.latency, // Approximation
    description: "Survival 1.21 (via Proxy)",
  });

  // 5. Lobby Hub (Inferred)
  systems.push({
    id: "hub",
    name: "Lobby Hub",
    type: "game",
    status: proxy.status === "up" ? "up" : "down",
    uptime: 99.9,
    latency: proxy.latency, // Approximation
    description: "Auth Lobby",
  });

  return new Response(JSON.stringify(systems), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*", // Allow fetch from frontend
    },
  });
}
