# Pulse Prophet — Predictive Analysis Subsystem

## Overview

Pulse Prophet is a production-grade healthcare Predictive Analysis System integrated with a Patient Management System (PMS). It performs rule-based risk scoring, patient assessment, recommendation generation, and specialist/lab-test suggestions.

## Tech Stack

- **Frontend**: React 18 + Vite + React Router DOM + Axios
- **Backend**: Node.js + Express + MongoDB (Mongoose)
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **Security**: Helmet, express-rate-limit, express-validator
- **Integration**: Admin Subsystem bridge, PMS external API

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas cluster (or local MongoDB)

### Environment Setup

1. Copy `.env.example` to `.env` in the project root.
2. Fill in real values for all variables.

```bash
# Backend
cd backend
npm install
npm run dev        # or npm start for production

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

### Default Admin Credentials (Auto-seeded)
When the server starts and no admin exists, a default admin is created:
- **Username**: `admin`
- **Password**: `Admin@1234`
- **Email**: `admin@pulseprophet.local`

## Project Structure

```
 pulse/
 ├── .env                     # Single source of truth for env vars
 ├── backend/
 │   ├── config/              # DB connection, env loader
 │   ├── controllers/         # Auth, admin, patient, assessment controllers
 │   ├── middleware/          # Auth, rate limiting, validation, error handling
 │   ├── models/              # User, Assessment schemas
 │   ├── routes/              # Express route definitions
 │   ├── services/            # Scoring, PMS integration, audit, admin bridge
 │   ├── utils/               # Helpers, validation, seed utilities
 │   └── server.js            # Entry point
 └── frontend/
     ├── src/
     │   ├── api/             # Axios client + request caching
     │   ├── components/      # Reusable UI components
     │   ├── context/         # AuthContext, ThemeContext
     │   ├── pages/           # Route-level pages
     │   └── utils/           # Normalization, password validation
     └── index.html
```

## Authentication

### Supported Login Methods
- **Email** (e.g., `user@example.com`)
- **Username** (e.g., `johndoe`)
- **Predictive subsystem admin** (`predictive_admin` via Admin Subsystem bridge)

### Auth Flow
1. Frontend sends `{ identifier, password }` to `POST /auth/login`
2. Backend resolves user by email OR username
3. `bcrypt.compare()` validates the password
4. JWT token is generated (expires in 7 days)
5. Token is stored in `localStorage` (`pp_token`)
6. Axios interceptors attach the Bearer token to every request

### Password Policy
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character
- Blacklisted common passwords are rejected

### Security Features
- Rate limiting on auth endpoints (5 login attempts per 15 min)
- Helmet security headers
- Input sanitization and trimming
- NoSQL injection prevention via Mongoose schema validation
- Dev bypass requires explicit `AUTH_DEV_BYPASS=true`
- Passwords hashed with bcrypt (cost factor 12)

## API Response Format

All endpoints now return a consistent envelope:

**Success**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "...",
  "user": { ... }
}
```

**Error**
```json
{
  "success": false,
  "message": "Invalid username/email or password"
}
```

## Recent Changes

### Medical Taxonomy & Scoring Engine Refactoring (Latest)
- Created centralized medical taxonomy (`backend/constants/clinicalTags.js`) with 100+ medically validated conditions
- Added Filipino/common Philippine health risk support with aliases (e.g., "highblood" → Hypertension)
- Implemented new scoring engine (`backend/utils/scoringEngine.js`) with fine-grained weighted scoring
- Added medical normalization helpers (`backend/utils/medicalNormalization.js`) to reject junk/free-text terms
- Replaced old category-based scoring with per-condition weights from taxonomy
- Added intelligent risk escalation rules for dangerous condition combinations (e.g., HTN + DM + Smoking)
- Created frontend medical taxonomy mirror (`frontend/src/utils/medicalTaxonomy.js`) for UI consistency
- Updated condition extraction to use new taxonomy and only show validated medical tags
- Added comprehensive documentation in `information.txt` with scoring tables and risk escalation logic
- Updated `backend/services/scoring.js` to delegate to new scoringEngine (backward compatible)
- Updated `backend/controllers/assessmentController.js` with consistent success flags in all responses

### Authentication Audit & Fixes
- Fixed 400 Bad Request on `/auth/login` caused by inconsistent login payload fields
- Fixed frontend login to always send `identifier` (supports both email and username)
- Backend login validators now accept `identifier`, `email`, or `username`
- Added `success: true/false` flag to all auth and admin API responses
- Added default admin seeding on startup if no admin exists
- Added Helmet for security headers
- Added safe development-only logging (no passwords or secrets logged)
- Fixed favicon 404 with inline SVG favicon
- Centralized error handling that never leaks stack traces or Mongo internals
- Hardened auth middleware dev bypass

### Previous Refactors
- Backend MVC refactor (controllers extracted from routes)
- Centralized environment variable loader (`backend/config/env.js`)
- Username migration for legacy accounts
- Audit logging integration with Admin Subsystem
- Password strength validation on registration and password changes

## Troubleshooting

**Login shows "Authentication failed"**
- Check that the backend server is running and reachable (`VITE_API_URL`)
- Verify MongoDB connection in backend logs
- Ensure the admin was seeded (check backend startup logs)
- Check browser DevTools Network tab for exact error message

**CORS errors**
- Set `CORS_ORIGIN` to your exact frontend URL (e.g., `http://localhost:5173`)

**MongoDB connection fails**
- Verify `MONGODB_URI` is correct
- Ensure your IP is whitelisted in MongoDB Atlas

## License

Proprietary — Pulse Prophet Healthcare Systems
