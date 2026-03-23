---
name: subscription-samurai
version: 1.0.0
description: Autonomous USDT subscription payment agent powered by Tether WDK
author: holyaustin
license: MIT
tags:
  - wdk
  - tether
  - usdt
  - ethereum
  - evm
  - subscriptions
  - autonomous-payments
  - defi
platforms:
  - openclaw
  - cursor
  - claude
  - any
---

# Subscription Samurai — WDK Agent Skill

An autonomous subscription payment agent that uses Tether WDK to manage
self-custodial EVM wallets and execute recurring USDT payments on Ethereum.

## What This Agent Can Do

| Capability | Description |
|------------|-------------|
| **Create Wallet** | Generate a BIP-39 seed phrase and derive an Ethereum address using WDK |
| **Check Balances** | Query native ETH balance and USDT ERC-20 token balance |
| **Schedule Payments** | Set up recurring USDT transfers (per-minute, hourly, daily, weekly, monthly, yearly) |
| **Execute Transfers** | Autonomously send USDT to recipient addresses on schedule |
| **Track History** | Log all transactions with status, hash, and fee information |

## WDK Integration

This agent uses `@tetherto/wdk` and `@tetherto/wdk-wallet-evm` for all
wallet and transaction operations:

```javascript
// WDK initialisation — exact docs pattern
const WDK = require('@tetherto/wdk').default;
const WalletManagerEvm = require('@tetherto/wdk-wallet-evm').default;

const wdkInstance = new WDK(seedPhrase)
  .registerWallet('ethereum', WalletManagerEvm, { provider: RPC_URL });

const account = await wdkInstance.getAccount('ethereum', 0);
const address = await account.getAddress();

// Check balances
const ethWei   = await account.getBalance();               // bigint (wei)
const usdtUnits = await account.getTokenBalance(USDT_ADDR); // bigint (base units)

// Execute USDT transfer
const result = await account.transfer({
  token: USDT_CONTRACT_ADDRESS,
  recipient: recipientAddress,
  amount: amountInBaseUnits,   // USDT has 6 decimals: 1 USDT = 1_000_000n
});
// result → { hash: string, fee: bigint }
```

## How to Use This Agent

### As a Standalone Agent (local)

```bash
git clone https://github.com/holyaustin/Subscription-Samurai
cd subscription-samurai
npm install
cp .env.local.example .env.local  # Add your RPC_URL, USDT_CONTRACT_ADDRESS
npm run dev:all                    # Starts Next.js + agent together
```

### Configure a Subscription

1. Open the app at `http://localhost:3000`
2. Click **Create Wallet** to generate your WDK self-custodial wallet
3. Fund the wallet with Sepolia ETH (for gas) and USDT
4. Add a subscription: recipient address + amount + frequency
5. Click **Start Agent** — the agent runs autonomously

### Trigger via HTTP (deployed)

The agent exposes an HTTP endpoint for external cron triggering:

```
GET https://your-app.vercel.app/api/agent/cron?secret=YOUR_CRON_SECRET
```

Set up a free cron at https://cron-job.org to call this every minute.

## Agent Architecture

```
User (UI)                    WDK Agent
   │                             │
   ├─ Create Wallet ─────────────► WDK.getRandomSeedPhrase()
   │                             │  new WDK(seed).registerWallet('ethereum', ...)
   │                             │  account.getAddress()
   │                             │
   ├─ View Balance ──────────────► account.getBalance()         (ETH)
   │                             │  account.getTokenBalance()   (USDT)
   │                             │
   ├─ Add Subscription ──────────► store.startAgent(subscriptions)
   │                             │
   │  (every N minutes/hours)    │
   │◄────────────── cron ────────► account.transfer({
   │                             │    token: USDT_ADDRESS,
   │  Transaction confirmed      │    recipient, amount
   └─────────────────────────────    })
```

## Security Notes (per WDK Agent Skills spec)

- Seed phrase is stored in `.env.local` (gitignored), never committed to version control
- Private keys never leave the server — fully self-custodial
- All transactions require explicit user setup (recipient + amount + frequency)
- The agent only executes transfers that were pre-authorised by the wallet owner

## Environment Variables

```bash
WALLET_MNEMONIC=<12-word BIP-39 seed phrase>     # Auto-generated on first wallet creation
RPC_URL=https://ethereum-sepolia-public.nodies.app
USDT_CONTRACT_ADDRESS=0xd077a400968890eacc75cdc901f0356c943e4fdb
USDT_DECIMALS=6
NEXT_PUBLIC_EXPLORER_URL=https://sepolia.etherscan.io
CRON_SECRET=<random string for securing the cron endpoint>
```

## Resources

- [WDK Documentation](https://docs.wdk.tether.io)
- [WDK EVM Wallet](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm)
- [WDK Agent Skills](https://docs.wdk.tether.io/ai/agent-skills)
- [AgentSkills Specification](https://agentskills.io/specification)
