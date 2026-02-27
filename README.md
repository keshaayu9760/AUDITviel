# AuditViel

AuditViel is a full-stack audit verification platform:
- Auditors issue signed audit credentials
- Projects generate ZK proofs
- Verification status is recorded on-chain
- Users can verify project status from the UI

## Repository Structure

- `backend/` Express API, MongoDB integration, on-chain submit/verify routes
- `frontend/` Next.js app (auditor, project, admin, verify, metrics)
- `contracts/` Solidity contracts
- `circuits/` Circom/snarkjs proving system
- `scripts/` deployment and utility scripts
- `tests/` Hardhat and integration tests

## Tech Stack

- Backend: Node.js, Express, ethers, mongoose
- Frontend: Next.js, React, wagmi, ethers, recharts
- Smart Contracts: Solidity + Hardhat
- ZK: Circom + snarkjs (Groth16)

## Local Development

### 1. Install dependencies

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
cd ../circuits && npm install
```

### 2. Configure environment variables

- Backend template: `backend/.env.example`
- Frontend template: `frontend/.env.example`

Create:
- `backend/.env`
- `frontend/.env`

Do not commit real secrets.

### 3. Start services

Backend:
```bash
cd backend
npm run dev
```

Frontend:
```bash
cd frontend
npm run dev
```

## Build and Validation

Backend tests:
```bash
cd backend
npm test
```

Frontend production build:
```bash
cd frontend
npm run build
```

Contracts compile:
```bash
npm run compile
```

## Deployment

### Frontend (Vercel)

- Deploy the `frontend/` directory
- Build command: `npm run build`
- Output: Next.js default (`.next`)
- Configure required `NEXT_PUBLIC_*` env vars in Vercel project settings

`frontend/vercel.json` is already included.

### Backend (Render)

- Deploy the `backend/` directory as a Web Service
- Build command: `npm install`
- Start command: `npm start`
- Set all required backend env vars in Render dashboard

`backend/render.yaml` is included.

## Security and Secret Hygiene

- `.env` files are gitignored
- Only `.env.example` templates are tracked
- Generated artifacts and reports are excluded from commits
- Never commit private keys, JWT secrets, or database credentials

## License

MIT
