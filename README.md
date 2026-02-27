# AuditViel

AuditViel is a verifiable smart-contract audit credential platform. It lets auditors issue credentials, projects generate ZK-linked proofs, and users verify status on Polygon without exposing private audit report details.

## Repository Structure

- `frontend/` Next.js app (auditor, project, verify, admin, metrics)
- `backend/` Express API + MongoDB + on-chain verification routes
- `contracts/` Solidity contracts
- `circuits/` Circom circuits and setup scripts

## Tech Stack

- Frontend: Next.js 15, React, wagmi, ethers, Tailwind
- Backend: Node.js, Express, ethers, mongoose
- Smart Contracts: Solidity, Hardhat
- ZK: Circom, snarkjs (Groth16)

## Prerequisites

- Node.js 18+
- npm 9+
- MongoDB Atlas URI
- Polygon Amoy RPC endpoint
- Wallet private keys for deployer/admin/proof signer

## Local Setup

### 1) Install dependencies

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
cd ../circuits && npm install
```

### 2) Configure environment variables

Create these files from examples:

- `backend/.env` from `backend/.env.example`
- `frontend/.env` from `frontend/.env.example`

### 3) Start backend

```bash
cd backend
npm run dev
```

Backend default URL: `http://localhost:10000`

### 4) Start frontend

```bash
cd frontend
npm run dev
```

Frontend default URL: `http://localhost:3000`

## Build and Validation

### Frontend production build

```bash
cd frontend
npm run build
```

### Backend tests

```bash
cd backend
npm test
```

### Contracts compile

```bash
npx hardhat compile
```

### Circuits compile/setup

```bash
cd circuits
npm run compile
npm run setup
```

## Deployment

### Frontend on Vercel

Project settings:

- Root Directory: `frontend`
- Install Command: `npm install`
- Build Command: `npm run build`

Required Vercel env vars:

```env
NEXT_PUBLIC_BACKEND_URL=https://your-render-service.onrender.com
NEXT_PUBLIC_CHAIN_ID=80002
NEXT_PUBLIC_RPC_URL=https://rpc-amoy.polygon.technology
NEXT_PUBLIC_EXPLORER_URL=https://amoy.polygonscan.com
NEXT_PUBLIC_AUDITOR_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS=0x...
NEXT_PUBLIC_ZK_VERIFIER_ADDRESS=0x...
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
```

### Backend on Render

Service settings:

- Root Directory: `backend`
- Build Command: `npm ci`
- Start Command: `npm start`

Required Render env vars:

```env
NODE_ENV=production
PORT=10000
FRONTEND_URL=https://your-vercel-domain.vercel.app
NEXT_PUBLIC_WEBSITE_URL=https://your-vercel-domain.vercel.app

CHAIN_ID=80002
RPC_URL=https://rpc-amoy.polygon.technology

DEPLOYER_PRIVATE_KEY=0x...
ADMIN_PRIVATE_KEY=0x...
ADMIN_ADDRESS=0x...
PROOF_SIGNER_PRIVATE_KEY=0x...
TRUSTED_PROVER_PRIVATE_KEY=0x...
TRUSTED_PROVER_ADDRESS=0x...

AUDITOR_REGISTRY_ADDRESS=0x...
PROOF_VERIFIER_ADDRESS=0x...
ZK_VERIFIER_ADDRESS=0x...
CONTRACT_ADDRESS=0x...

MONGO_URI=mongodb+srv://...
ADMIN_JWT_SECRET=your_long_random_secret_min_32_chars
ADMIN_JWT_TTL=30m
```

## Security Notes

- Do not commit real `.env` files.
- Rotate any wallet/private key that was ever exposed.
- Keep `ADMIN_JWT_SECRET` backend-only (Render), never in frontend.

## License

MIT
