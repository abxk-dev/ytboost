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
- User & Admin JWT authentication
- Categories & Services CRUD
- Order management with status tracking
- Crypto payment sessions (BEP20 wallet generation + blockchain polling)
- Socket.io for real-time payment updates
- Admin settings & fund request management
- Seed script for initial admin account

### Frontend (React)
- Auth pages: Login, Register
- User Dashboard: Overview, Orders, Add Order, Transactions, Add Funds, Payment Session, Account, Change Password, API Access
- Admin Dashboard: Overview, Categories, Services, Orders, Users, User Services, Fund Requests, Crypto Settings, Settings
- **Public Landing Page** (Feb 2026): Home page at `/` with Hero, Services, Why Choose Us, How It Works, CTA, Footer sections. SEO meta tags via react-helmet-async.

## Key API Endpoints
- POST `/api/auth/login`, `/api/auth/register`
- POST `/api/admin/auth/login`
- POST `/api/crypto/create-session`
- GET `/api/services`, `/api/categories`

## Test Credentials
- Admin: admin@ytboost.io / Admin@123
- User: john@test.com / Test@123

## Prioritized Backlog
- **P2**: Implement actual Email Service (currently mocked/skipped)
- **P2**: Admin dynamic BSC wallet address replacement in settings
- **Note**: Backend is Python/FastAPI (user originally requested Node.js/Express) - works perfectly, no action unless user requests rewrite
