DROP TABLE IF EXISTS monitors;
DROP TABLE IF EXISTS heartbeats;

CREATE TABLE monitors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  last_seen INTEGER, -- timestamp
  status TEXT DEFAULT 'down',
  latency INTEGER DEFAULT 0
);

CREATE TABLE heartbeats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  monitor_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  latency INTEGER,
  status TEXT
);

-- Seed Initial Monitors
INSERT INTO monitors (id, name, type, description) VALUES
  ('main', 'Main Survival', 'game', 'Основной игровой мир (1.21)'),
  ('hub', 'Lobby Hub', 'game', 'Точка входа и авторизации'),
  ('proxy', 'Velocity Proxy', 'proxy', 'DDoS защита и маршрутизация'),
  ('web', 'Website & API', 'web', 'horni.cc и API бэкенда'),
  ('db', 'HorniDB (Auth)', 'db', 'База данных игроков');
