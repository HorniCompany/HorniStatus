# 📊 Horni Status Page

Статус-страница для проекта HorniMine.
Показывает доступность серверов (Main, Hub, Proxy), сайта и базы данных.

## 🛠 Технологии

- **Vite** + **React** (TypeScript)
- **Glassmorphism UI** (авторский стиль)
- **Lucide React** (иконки)

## 🚀 Как запустить локально

```bash
npm install
npm run dev
```

## ☁️ Деплой на Cloudflare Pages

Этот проект готов к деплою на Cloudflare Pages.

1. Зайдите в [Cloudflare Dashboard](https://dash.cloudflare.com/) -> **Workers & Pages**.
2. Нажмите **Create Application** -> **Pages** -> **Connect to Git**.
3. Выберите репозиторий `HorniStatus`.
4. **Build settings**:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Нажмите **Save & Deploy**.

### 🔧 Ручной деплой (через Wrangler)

Если вы хотите задеплоить вручную через консоль:

```bash
npm run build
npx wrangler deploy
```

_(Требуется файл `wrangler.json` с настройкой `assets` — уже включен в проект)._
