# DeterAgent 🛡️
### Trust Firewall & Execution Layer for Autonomous AI Agents

> No verification. No execution 
> Only trusted actions reach the chain

## The Problem

Autonomous agents are already executing onchain actions swapping, staking, and trading.
But they might act on hallucinated data, with no verification and no accountability.
That leads to real financial loss.

## The Solution

DeterAgent acts as a firewall gate between AI decisions and real-world execution.
DeterAgent intercepts every agent intent before execution.<br/>
It verifies the decision against the same sources the agent used for its analysis, computes a trust score, and enforces execution based on that trust.
Unverified actions are blocked. Trusted actions are executed.


---

## How It Works

```
Agent Intent → Agent Selection (ENS) → Fetch Sources → 0G Proof → 
Trust Verification → Decision → KeeperHub Execute or Block → 
ENS Reputation Update
```

1. **Agent Intent** — Autonomous agent submits a conditional intent
2. **Agent Selection** — Best agent selected by ENS reputation score
3. **Agent Response** — Real sources fetched, proof anchored to 0G
4. **Trust Verification** — Grounding check, relevance check, trust score
5. **Decision** — High trust → KeeperHub executes. Low trust → Blocked
6. **Reputation Update** — ENS score updated permanently onchain

---

## Demo

### ✅ Trusted Execution
```
Intent: "Swap 1000 USDC to WETH if ETH is currently below $2500"
Result: Trust Score 88/100 → KeeperHub executes → Etherscan tx confirmed
```
Transaction-link : https://sepolia.etherscan.io/tx/0x27f5c7fcb17d9006673e90ed04d2cd2931d4786b7bbdb2577bcd71d228edf0e4

### ❌ Blocked Execution
```
Intent: "Buy 500 WETH if ETH outperforms BTC in the next 5 years"
Result: Trust Score 28/100 → Execution blocked → Agent reputation penalized
```

---

## Key Features

- **Trust Firewall** — Every intent verified before execution
- **Conditional Execution** — Intents gated on verifiable real-world conditions
- **Onchain Reputation** — Agent trust scores stored on ENS, updated after every run
- **Agent Selection** - Agents are dynamically selected based on trust score and capabilities, ensuring only reliable agents are used.
- **Verifiable Proofs** — Every source anchored to 0G Storage cryptographically
- **KeeperHub Execution** — Real onchain transactions, not simulations
- **Telegram Alerts** — Real-time notifications on every execution
- **No Blind Trust** — Agents earn reputation through verified performance

---

## Key Integrations

### 🔷 ENS — Onchain Agent Reputation
- Each agent has an ENS subname under `deteragent.eth`
- Text records follow ENS Agent Schema v3.0.1
- Trust scores read and written programmatically after every execution
- Agent selection based on ENS reputation at runtime
- Records: `class`, `alias`, `description`, `supported-trust`, `trust_score`, `total_checks`, `OG-proof-hash`

```
agentx01.deteragent.eth — Trust Score: 52
agentx02.deteragent.eth — Trust Score: 77
agentx03.deteragent.eth — Trust Score: 59
```

### 🟣 0G Storage — Verifiable Evidence Trail
- Every source fetched during verification is uploaded to 0G
- Root hash returned and stored before trust is calculated
- 0G proof hash anchored in ENS text records permanently
- Creates tamper-proof evidence for every agent decision

### ⚡ KeeperHub — Conditional Execution Gate
- Only fires when trust score exceeds threshold
- Supports swap, buy, and stake actions
- Real onchain transaction receipts with SwapExecuted/BuyExecuted events
- Telegram notification on every execution
- Workflow: Verify Trust → Execute or Block → Update Reputation

---

## Trust Score Breakdown

| Score | Verdict | Action |
|-------|---------|--------|
| 80-100 | ✅ TRUST | KeeperHub executes |
| 50-79 | ⚠️ VERIFY | Flagged for review |
| 0-49 | ❌ DO NOT TRUST | Execution blocked |

Computed from:
- **Grounding** (60%) — Claims verified against fetched sources
- **Relevance** (40%) — Response addresses the task

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    AGENT INTENT                      │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              AGENT SELECTION (ENS)                   │
│         Read trust scores → Select best agent        │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              AGENT RESPONSE + 0G PROOF               │
│      Fetch URLs → Upload to 0G → Generate response   │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│           DETERAGENT TRUST VERIFICATION              │
│    Grounding Check → Relevance Check → Trust Score   │
└──────────┬───────────────────────┬──────────────────┘
           │                       │
    HIGH TRUST                 LOW TRUST
           │                       │
┌──────────▼──────────┐   ┌───────▼──────────────────┐
│  KEEPERHUB EXECUTE  │   │    EXECUTION BLOCKED      │
│  Onchain tx fired   │   │    No transaction         │
│  Telegram notified  │   │    Funds protected        │
└──────────┬──────────┘   └───────┬──────────────────┘
           │                       │
┌──────────▼───────────────────────▼──────────────────┐
│              ENS REPUTATION UPDATE                   │
│    Trust score updated → 0G proof hash updated       │
└─────────────────────────────────────────────────────┘
```

---

## Tech Stack

- **Frontend** — React, TypeScript
- **Backend** — Python orchestration
- **AI** — GPT-4o-mini for trust verification
- **Storage** — 0G Storage for proof anchoring
- **Identity** — ENS for agent reputation
- **Execution** — KeeperHub for onchain automation
- **Notifications** — Telegram Bot API
- **Blockchain** — Ethereum Sepolia testnet


---

## Live Demo

**Demo Video:** [https://drive.google.com/file/d/1WW9ivUirhD3h5xGrp1qyXjzw-i5I46yC/view?usp=sharing]  
**ETHGlobal:** [https://ethglobal.com/showcase/deteragent-omxmt]

---

## Team

**Sidarth S**   
Web3 Security Engineer
---

## License

MIT

---

*DeterAgent — Because autonomous agents should be powerful. Not reckless.*