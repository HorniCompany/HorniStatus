import { useState, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Server,
  Globe,
  Database,
  RefreshCw,
} from "lucide-react";
import "./index.css";

// Types
type SystemStatus = "up" | "down" | "maintenance";

interface System {
  id: string;
  name: string;
  type: "game" | "web" | "db" | "proxy";
  status: SystemStatus;
  uptime: number; // 99.9%
  latency: number; // ms
  description: string;
}

// Fallback data if API fails
const FALLBACK_SYSTEMS: System[] = [
  {
    id: "main",
    name: "Main Survival",
    type: "game",
    status: "down",
    uptime: 0,
    latency: 0,
    description: "Основной игровой мир (1.21)",
  },
  {
    id: "hub",
    name: "Lobby Hub",
    type: "game",
    status: "down",
    uptime: 0,
    latency: 0,
    description: "Точка входа и авторизации",
  },
  {
    id: "proxy",
    name: "Velocity Proxy",
    type: "proxy",
    status: "down",
    uptime: 0,
    latency: 0,
    description: "DDoS защита и маршрутизация",
  },
  {
    id: "web",
    name: "Website & API",
    type: "web",
    status: "down",
    uptime: 0,
    latency: 0,
    description: "horni.cc и API бэкенда",
  },
  {
    id: "auth",
    name: "HorniDB (Auth)",
    type: "db",
    status: "down",
    uptime: 0,
    latency: 0,
    description: "База данных игроков",
  },
];

function StatusBadge({ status }: { status: SystemStatus }) {
  if (status === "up") {
    return (
      <div className="status-pill status-up">
        <span className="pulse" style={{ background: "currentColor" }} />
        Работает
      </div>
    );
  }
  if (status === "maintenance") {
    return (
      <div className="status-pill status-maintenance">
        <AlertTriangle size={14} />
        Техработы
      </div>
    );
  }
  return (
    <div className="status-pill status-down">
      <XCircle size={14} />
      Недоступен
    </div>
  );
}

function SystemIcon({ type }: { type: System["type"] }) {
  switch (type) {
    case "game":
      return <Server className="text-accent-primary" />;
    case "db":
      return <Database className="text-warning" />;
    case "proxy":
      return <Server className="text-success" />;
    default:
      return <Globe className="text-accent-secondary" />;
  }
}

function App() {
  const [systems, setSystems] = useState<System[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchStatus = async () => {
    setLoading(true);
    try {
      // Fetch from local Cloudflare Function (Independent of Proxy!)
      const res = await fetch("/api/status");
      if (!res.ok) throw new Error("API Failed");
      const data = await res.json();
      setSystems(data);
    } catch (e) {
      console.error("Failed to fetch status:", e);
      // Only set fallback if we have no data at all
      if (systems.length === 0) setSystems(FALLBACK_SYSTEMS);
    } finally {
      setLastUpdated(new Date());
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Auto refresh every 60s
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const allSystemsUp = systems.every((s) => s.status === "up");

  return (
    <div className="container">
      <header>
        <div className="hero-logo">Horni Status</div>
        <p style={{ color: "var(--text-muted)" }}>
          Мониторинг доступности серверов HorniMine
        </p>
      </header>

      <div style={{ textAlign: "center" }}>
        <div className={`overall-status glass-panel`}>
          {allSystemsUp ? (
            <CheckCircle2 size={32} className="text-success" />
          ) : (
            <AlertTriangle size={32} className="text-warning" />
          )}
          <div style={{ textAlign: "left" }}>
            <h2 style={{ margin: 0, fontSize: "1.25rem" }}>
              {allSystemsUp
                ? "Все системы работают штатно"
                : "Наблюдаются сбои"}
            </h2>
            <div
              style={{ fontSize: "0.85rem", opacity: 0.7, marginTop: "4px" }}
            >
              Обновлено: {lastUpdated.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>

      <div className="systems-grid">
        {systems.map((system) => (
          <div key={system.id} className="glass-card system-row">
            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <div
                style={{
                  padding: "12px",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: "12px",
                }}
              >
                <SystemIcon type={system.type} />
              </div>
              <div className="system-info">
                <h3>{system.name}</h3>
                <p>{system.description}</p>

                {/* Latency Tag */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginTop: "8px",
                    fontSize: "0.8rem",
                    color: "var(--text-muted)",
                  }}
                >
                  <div
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background:
                        system.latency < 50
                          ? "var(--success)"
                          : "var(--warning)",
                    }}
                  />
                  {system.latency}ms
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: "0.5rem",
              }}
            >
              <StatusBadge status={system.status} />
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Uptime: {system.uptime}%
              </span>
            </div>
          </div>
        ))}

        {loading && systems.length === 0 && (
          <p style={{ textAlign: "center", color: "var(--text-muted)" }}>
            Загрузка статусов...
          </p>
        )}
      </div>

      <footer
        style={{
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: "0.9rem",
          marginTop: "4rem",
        }}
      >
        <p>
          Не работает то, что должно работать?
          <br />
          Пиши в{" "}
          <a
            href="https://discord.gg/horni"
            style={{ color: "var(--accent-primary)" }}
          >
            Discord
          </a>
        </p>
        <button
          onClick={fetchStatus}
          style={{
            marginTop: "1rem",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "var(--text-muted)",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <RefreshCw size={14} className={loading ? "spin" : ""} />
          Обновить
        </button>
      </footer>
    </div>
  );
}

export default App;
