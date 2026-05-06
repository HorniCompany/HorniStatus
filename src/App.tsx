import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, AlertOctagon, RefreshCw } from 'lucide-react';
import './index.css';

// === Types match what /api/status returns from D1. ===

type SystemStatus = 'up' | 'down' | 'maintenance';

interface System {
  id: string;
  name: string;
  type: 'game' | 'web' | 'db' | 'proxy';
  status: SystemStatus;
  uptime: number;            // 0..100 (% over last 24h)
  latency: number;           // ms
  description: string;
}

const REFRESH_MS = 60_000;

// Demo data shown ONLY in `bun run dev` when /api/status is unreachable.
// Production reads live data from D1 - this is never used there.
const DEMO_SYSTEMS: System[] = [
  { id: 'main',  name: 'Main Survival',  type: 'game',  status: 'up',          uptime: 99.92, latency: 12, description: 'Основной игровой мир' },
  { id: 'hub',   name: 'Lobby Hub',      type: 'game',  status: 'up',          uptime: 99.85, latency: 18, description: 'Точка входа и авторизации' },
  { id: 'proxy', name: 'Velocity Proxy', type: 'proxy', status: 'up',          uptime: 99.99, latency: 4,  description: 'DDoS защита и маршрутизация' },
  { id: 'web',   name: 'Website & API',  type: 'web',   status: 'up',          uptime: 99.7,  latency: 28, description: 'horni.cc и API бэкенда' },
  { id: 'db',    name: 'HorniDB (Auth)', type: 'db',    status: 'maintenance', uptime: 98.3,  latency: 8,  description: 'База данных игроков' },
];

const App = () => {
  const [systems, setSystems] = useState<System[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [errorOnce, setErrorOnce] = useState(false);

  const fetchStatus = async (showLoader = true) => {
    if (showLoader) setRefreshing(true);
    try {
      const res = await fetch('/api/status', { cache: 'no-store' });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = (await res.json()) as System[];
      setSystems(data);
      setLastUpdated(new Date());
      setErrorOnce(false);
    } catch (err) {
      console.error('fetch /api/status failed', err);
      // Dev preview has no D1, so seed demo data so the layout is visible.
      // In production we never hit this branch unless the API is genuinely down.
      if (import.meta.env.DEV && systems.length === 0) {
        setSystems(DEMO_SYSTEMS);
        setLastUpdated(new Date());
      } else if (systems.length === 0) {
        setErrorOnce(true);
      }
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const t = setInterval(() => fetchStatus(false), REFRESH_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aggregate state for the banner.
  const downCount = systems.filter((s) => s.status === 'down').length;
  const maintCount = systems.filter((s) => s.status === 'maintenance').length;
  const tone: 'ok' | 'warn' | 'danger' =
    downCount > 0 ? 'danger' :
    maintCount > 0 ? 'warn' :
    'ok';

  const bannerHeadline =
    tone === 'ok'     ? 'Все системы работают' :
    tone === 'warn'   ? 'Плановое техобслуживание' :
                        `Проблема: ${downCount} ${plural(downCount, ['сервис', 'сервиса', 'сервисов'])} не отвечает`;

  const bannerIcon =
    tone === 'ok'     ? <CheckCircle2 size={26} strokeWidth={1.5} /> :
    tone === 'warn'   ? <AlertTriangle size={26} strokeWidth={1.5} /> :
                        <AlertOctagon size={26} strokeWidth={1.5} />;

  return (
    <div className="container">

      <header className="header">
        <h1 className="header-title">
          horni<span className="dot">·</span>status
        </h1>
        <p className="header-subtitle">
          Доступность серверов и сервисов HorniMine
        </p>
      </header>

      {errorOnce && (
        <div className="error-banner">
          Не удалось загрузить статусы. Пробую снова через минуту...
        </div>
      )}

      {!errorOnce && systems.length === 0 && (
        <div className="loading">
          {refreshing ? 'Загрузка статусов...' : 'Ожидаю данные...'}
        </div>
      )}

      {systems.length > 0 && (
        <>
          <section className={`overall is-${tone}`}>
            <div className="overall-icon">{bannerIcon}</div>
            <div className="overall-text">
              <h2 className="overall-headline">{bannerHeadline}</h2>
              <div className="overall-meta">
                {lastUpdated
                  ? `обновлено ${formatTime(lastUpdated)} · автообновление каждую минуту`
                  : 'собираю данные...'}
              </div>
            </div>
          </section>

          <section className="systems" aria-label="Список сервисов">
            {systems.map((s) => <SystemRow key={s.id} system={s} />)}
          </section>
        </>
      )}

      <footer className="footer">
        <p>
          Что-то лежит, а тут зелёное?<br />
          Пиши в <a href="https://discord.gg/Zw3tQkCSZN" target="_blank" rel="noopener noreferrer">Discord</a>
          {' '}или на <a href="mailto:op@horni.cc">op@horni.cc</a>
        </p>
        <button
          className={`refresh-btn ${refreshing ? 'spinning' : ''}`}
          onClick={() => fetchStatus()}
          disabled={refreshing}
          type="button"
        >
          <RefreshCw size={14} strokeWidth={1.5} />
          {refreshing ? 'обновляю' : 'обновить'}
        </button>
      </footer>
    </div>
  );
};

function SystemRow({ system }: { system: System }) {
  const cls = `system is-${system.status === 'up' ? 'up' : system.status === 'maintenance' ? 'maintenance' : 'down'}`;
  return (
    <article className={cls}>
      <div className="system-dot" aria-hidden="true" />
      <div className="system-info">
        <div className="system-name">{system.name}</div>
        <div className="system-desc">{system.description}</div>
      </div>
      <div className="system-meta">
        <span className="system-status">{statusLabel(system.status)}</span>
        <span className="system-uptime">
          {system.status === 'up' ? `${system.latency} ms` : '—'}
          {' · '}
          uptime {formatUptime(system.uptime)}
        </span>
      </div>
    </article>
  );
}

function statusLabel(s: SystemStatus): string {
  switch (s) {
    case 'up':          return 'работает';
    case 'down':        return 'не отвечает';
    case 'maintenance': return 'техработы';
  }
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatUptime(pct: number): string {
  if (!Number.isFinite(pct)) return '—';
  // Three-significant-digits-ish: 99.9% / 100% / 87% / 0%
  if (pct >= 99.95) return '100%';
  if (pct >= 10)    return `${pct.toFixed(1)}%`;
  return `${pct.toFixed(0)}%`;
}

function plural(n: number, forms: [string, string, string]): string {
  const mod10  = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

export default App;
