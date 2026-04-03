# YTBoost.io - YouTube SMM Panel PRD

## Original Problem Statement
Build a complete full-stack YouTube SMM Panel called "YTBoost.io" with automated BEP20 crypto payment detection using React + FastAPI + MongoDB.

## Architecture
- **Frontend**: React 18 + React Router v6 + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Real-time**: Socket.io for live payment status updates
- **Blockchain**: Web3.py for BEP20 USDT monitoring on BSC
- **Background Jobs**: APScheduler for blockchain polling (every 30 seconds)
- **Auth**: JWT with httpOnly cookies (separate secrets for user/admin)

## User Personas
1. **SMM Resellers**: Purchase YouTube engagement services in bulk
2. **Content Creators**: Boost their YouTube channel metrics
3. **Agencies**: Manage multiple client accounts
4. **Admin**: Manage services, users, payments, and site settings

## Core Requirements (Implemented)

### User Side
- [x] User authentication (login/register with JWT)
- [x] Dashboard with stats (balance, orders, spending)
- [x] Categories listing (6 seeded categories)
- [x] Services listing (20 seeded services)
- [x] Add New Order with category → service → link → quantity flow
- [x] Orders list with status badges and pagination
- [x] Transaction history
- [x] Add Funds with crypto (BEP20 USDT)
- [x] Live Payment Session page with QR code, countdown timer, and real-time status
- [x] Account management and password change
- [x] API access with key regeneration

### Admin Side
- [x] Separate admin authentication
- [x] Dashboard with comprehensive stats
- [x] Categories CRUD
- [x] Services CRUD with rate/min/max/type
- [x] Orders management with status updates
- [x] Users management with balance edit and ban/unban
- [x] Special Services per user assignment
- [x] Fund Requests view with approve/reject actions
- [x] Crypto Payment Methods settings
- [x] Site Settings (branding, contact, registration, maintenance)

### Crypto Payment System
- [x] Unique deposit address generation per session (ethers.js)
- [x] AES-256 encryption for private keys
- [x] Blockchain monitoring every 30 seconds
- [x] Auto-detection of USDT transfers
- [x] Auto-credit balance on confirmation
- [x] Real-time Socket.io updates
- [x] Session expiration (30 minutes)

## What's Been Implemented
- **Date**: January 2026
- Full backend API with 40+ endpoints
- Complete frontend with 20+ pages
- JWT authentication for user and admin
- MongoDB schemas for all entities
- Seed data (admin, test user, categories, services, crypto method, settings)
- BEP20 blockchain monitoring service
- Socket.io real-time payment updates
- Reseller API v2 endpoint

## Prioritized Backlog

### P0 (Critical)
- [ ] Test actual BEP20 payment on BSC testnet
- [ ] Add BSC wallet address in admin crypto settings

### P1 (Important)
- [ ] Email notifications for payments and orders
- [ ] Password reset functionality
- [ ] Order refund/cancel with balance restore
- [ ] Bulk order import (CSV)

### P2 (Nice to Have)
- [ ] Multiple currency support
- [ ] Affiliate/referral system
- [ ] API rate limiting
- [ ] Two-factor authentication
- [ ] Order analytics and reporting

## Test Credentials
- **Admin**: admin@ytboost.io / Admin@123
- **User**: john@test.com / Test@123 (Balance: $10.00)

## API Endpoints
- User Auth: POST /api/auth/login, /api/auth/register, /api/auth/logout
- Admin Auth: POST /api/admin/auth/login, /api/admin/auth/logout
- Categories: GET /api/categories, CRUD /api/admin/categories
- Services: GET /api/services, /api/services/user, CRUD /api/admin/services
- Orders: POST /api/orders, GET /api/orders, /api/admin/orders
- Crypto: POST /api/crypto/create-session, GET /api/crypto/session/:id, /api/crypto/methods
- Users: GET /api/admin/users, PUT /api/admin/users/:id/balance
- Settings: GET /api/settings, PUT /api/admin/settings
- API v2: POST /api/v2 (services, add, status, balance actions)

## Next Steps
1. Update BSC wallet address in admin crypto settings
2. Test payment flow with real USDT on BSC testnet
3. Add email service integration
4. Implement password reset flow
