# YTBoost.io - YouTube SMM Panel

## Original Problem Statement
Build a complete full-stack YouTube SMM Panel called "YTBoost.io" with automated BEP20 crypto payment detection. Features include user and admin dashboards, order management, dynamic pricing, and real-time Socket.io crypto status updates.

## Tech Stack
- **Frontend**: React 19, React Router v7, Tailwind CSS, Shadcn/UI, Socket.io-client, react-helmet-async
- **Backend**: Python FastAPI, python-socketio, Motor (async MongoDB)
- **Database**: MongoDB
- **Payments**: BEP20 (BSC) USDT auto-detection via Web3/Ethers

## What's Been Implemented

### Backend (Python/FastAPI)
- User & Admin JWT authentication (httpOnly cookies)
- Categories & Services CRUD
- Order management with status tracking
- Crypto payment sessions (BEP20 wallet generation + blockchain polling)
- Socket.io for real-time payment updates
- Admin settings & fund request management
- Admin crypto methods CRUD (wallet address editable, reflects immediately in public API)
- Public stats API endpoint (`GET /api/stats/public`) — no auth, returns totalOrders + totalUsers
- Seed script for initial admin account, categories, services, crypto method, site settings

### Frontend (React)
- **Public Landing Page** (Feb 2026): Home page at `/` with Hero, Services, Why Choose Us, How It Works, CTA, Footer. SEO meta tags via react-helmet-async. Live stats (orders + users) auto-refreshed every 30 seconds from backend API.
- Auth pages: Login, Register
- User Dashboard: Overview, Orders, Add Order, Transactions, Add Funds (shows wallet address), Payment Session, Account, Change Password, API Access
- Admin Dashboard: Overview, Categories, Services, Orders, Users, User Services, Fund Requests, Crypto Settings (wallet address editable), Settings

### End-to-End Flows Working
1. Admin updates BSC wallet address in `/admin/crypto-settings` → reflects immediately on user Add Funds page
2. Landing page at `/` shows real-time stats (total orders, total users) from backend, auto-refreshing every 30s
3. User registration → login → add funds → place order → track order
4. Admin login → manage categories/services/orders/users/crypto settings

## Key API Endpoints
- `GET /api/stats/public` — public stats (no auth)
- `GET /api/crypto/methods` — public active payment methods (includes wallet address)
- `POST /api/auth/login`, `/api/auth/register`
- `POST /api/admin/auth/login`
- `POST /api/crypto/create-session`
- `GET /api/services`, `/api/categories`
- `PUT /api/admin/crypto-methods/{id}` — update wallet address (admin)

## Test Credentials
- Admin: admin@ytboost.io / Admin@123
- User: john@test.com / Test@123

## Prioritized Backlog
- **P2**: Implement actual Email Service (currently mocked/skipped per user instruction)
- **Note**: Backend is Python/FastAPI (user originally requested Node.js/Express) — works perfectly, no action unless user requests rewrite
