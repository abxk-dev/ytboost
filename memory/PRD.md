# YTBoost.io - YouTube SMM Panel

## Original Problem Statement
Build a complete full-stack YouTube SMM Panel called "YTBoost.io" with automated BEP20 crypto payment detection. Features include user and admin dashboards, order management, dynamic pricing, and real-time Socket.io crypto status updates.

## Tech Stack
- **Frontend**: React 19, React Router v7, Tailwind CSS, Shadcn/UI, Socket.io-client, react-helmet-async
- **Backend**: Python FastAPI, python-socketio, Motor (async MongoDB), httpx
- **Database**: MongoDB
- **Payments**: BEP20 (BSC) USDT auto-detection via Web3/Ethers

## What's Been Implemented

### Backend (Python/FastAPI)
- User & Admin JWT authentication (httpOnly cookies, Secure + SameSite=none)
- Categories CRUD with slug auto-generation
- Services CRUD with type (Default/Refill 30d/60d/90d/Drip Feed/Custom), fulfillment method (Manual/Auto API), provider linking
- Order management with status tracking, custom data, duration, refill history
- API Providers CRUD with test connection, balance fetching
- Auto-fulfillment via external SMM panel APIs (POST to provider on order creation)
- Crypto payment sessions (BEP20 wallet generation + blockchain polling)
- Socket.io for real-time payment updates
- Admin settings & fund request management
- Public stats API endpoint
- Seed script for initial admin account, categories, services, crypto method, site settings

### Frontend (React)
- **Public Landing Page**: Home page at `/` with Hero, Services, Why Choose Us, How It Works, CTA, Footer. SEO meta tags. Live stats auto-refreshed every 30s.
- Auth pages: Login, Register
- User Dashboard: Overview, Orders (with refill button), Add Order (dynamic form by service type), Transactions, Add Funds (shows wallet address), Payment Session, Account, Change Password, API Access
- Admin Dashboard: Overview with stats, Recent Orders, Recent Payments
- Admin Categories: Full CRUD with slug field, delete confirmation with service count check
- Admin Services: Full CRUD with type badges, fulfillment method (Manual/Auto API), provider linking, info card fields
- Admin Orders: Expandable rows with service type, custom data, refill history, refill badges
- Admin API Providers: Full CRUD with test connection, balance refresh, show/hide API key
- Admin Day/Night Mode: Theme toggle (Sun/Moon) persisted to localStorage
- Admin Crypto Settings: Wallet address management
- Admin Users, User Services, Fund Requests, Site Settings

## Key API Endpoints
- Categories: GET/POST `/api/admin/categories`, PUT/DELETE `/api/admin/categories/{id}`
- Services: GET/POST `/api/admin/services`, PUT/DELETE/PATCH `/api/admin/services/{id}`
- API Providers: GET/POST `/api/admin/api-providers`, PUT/DELETE `/api/admin/api-providers/{id}`, POST `/api/admin/api-providers/test`, GET `/api/admin/api-providers/{id}/balance`
- Orders: POST `/api/orders`, POST `/api/orders/{id}/refill`
- Auth: POST `/api/auth/login`, `/api/auth/register`, POST `/api/admin/auth/login`
- Public: GET `/api/stats/public`, GET `/api/crypto/methods`

## Test Credentials
- Admin: admin@ytboost.io / Admin@123
- User: john@test.com / Test@123

## Prioritized Backlog
- **P2**: Implement actual Email Service (currently mocked/skipped per user instruction)
- **P3**: Cron job to auto-check order status from provider APIs
