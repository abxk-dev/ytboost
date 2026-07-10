# YTBoost Serverless Deployment Guide

## Overview

This guide explains how to deploy YTBoost as a serverless application on Vercel. The backend has been converted from a persistent FastAPI server to Vercel serverless functions, and Socket.io has been replaced with polling.

## Changes Made

### Backend Changes

1. **Removed Socket.io**: Real-time updates replaced with 10-second polling
2. **Removed APScheduler**: Background jobs converted to Vercel Cron functions
3. **File uploads**: Logo/favicon now stored as base64 in MongoDB
4. **Serverless entry point**: Created `api/index.py` for Vercel Python runtime
5. **Lazy MongoDB connection**: Database connects on first request

### Frontend Changes

1. **Removed socket.io-client**: No more WebSocket dependency
2. **Updated PaymentSession**: Uses polling instead of Socket.io
3. **Updated Topbar**: Balance updates via polling
4. **Updated API config**: Uses relative URLs for same-domain deployment

### New Files

- `api/index.py` - Main serverless entry point
- `api/cron/*.py` - 7 cron job functions
- `requirements.txt` - Root dependencies for Vercel
- `.env.example` - Environment variable template

## Deployment Steps

### 1. Install Vercel CLI

```bash
npm i -g vercel
```

### 2. Login to Vercel

```bash
vercel login
```

### 3. Set Environment Variables

In Vercel dashboard or via CLI:

```bash
vercel env add MONGO_URL
vercel env add DB_NAME
vercel env add JWT_SECRET
vercel env add JWT_REFRESH_SECRET
vercel env add ADMIN_JWT_SECRET
vercel env add CRON_SECRET
vercel env add BSC_RPC_URL
vercel env add PAYMENT_SESSION_TTL_MINUTES
vercel env add PAYMENT_SESSION_GRACE_MINUTES
```

### 4. Deploy

```bash
vercel --prod
```

## Vercel Cron Jobs

The following cron jobs are configured in `vercel.json`:

| Job | Schedule | Description |
|-----|----------|-------------|
| check_payments | Every minute | Check pending BEP20 payments |
| expire_sessions | Every 5 minutes | Expire timed-out payment sessions |
| check_orders | Every 5 minutes | Check provider order statuses |
| check_health | Every 15 minutes | Check provider health |
| auto_complete | Every hour | Auto-complete old orders |
| resume_workflows | Every minute | Resume waiting workflow jobs |
| poll_suborders | Every 5 minutes | Poll workflow suborder statuses |

**Note**: Vercel Hobby plan allows 1 cron job. Pro plan allows 40. You may need to combine jobs if on Hobby plan.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| MONGO_URL | MongoDB Atlas connection string | Yes |
| DB_NAME | Database name (default: ytboost) | Yes |
| JWT_SECRET | User JWT secret | Yes |
| JWT_REFRESH_SECRET | User refresh token secret | Yes |
| ADMIN_JWT_SECRET | Admin JWT secret | Yes |
| CRON_SECRET | Cron job authentication secret | Yes |
| BSC_RPC_URL | BSC RPC endpoint | Yes |
| PAYMENT_SESSION_TTL_MINUTES | Payment session TTL (default: 120) | No |
| PAYMENT_SESSION_GRACE_MINUTES | Payment session grace period (default: 360) | No |
| CORS_ORIGINS | Allowed CORS origins | No |
| BSCSCAN_API_KEY | BscScan API key for tx verification | No |

## Limitations

1. **No real-time updates**: Payment status updates via polling (10-second intervals)
2. **Cold starts**: First request to each function may be slow
3. **Function timeout**: 10-second timeout on Vercel (may need optimization for blockchain queries)
4. **File size limits**: Base64-encoded files stored in MongoDB (logo: 2MB, favicon: 500KB)

## Testing Locally

```bash
vercel dev
```

This will start a local development server that simulates the Vercel environment.

## Monitoring

Check Vercel dashboard for:
- Function invocations
- Error rates
- Cron job execution logs

## Rollback

If needed, you can revert to the previous deployment:

```bash
vercel rollback
```
