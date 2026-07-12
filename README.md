# Casino Jackpot

A full-stack slot-machine application developed as part of a technical home assignment.

The server is implemented with NestJS and TypeScript. Game sessions are stored in a managed Upstash Redis database so multiple API instances can share the same state.

The Angular client has not yet been implemented.

---

## Assignment Coverage

The server currently supports the required game lifecycle:

* A new session starts with 10 credits.
* Every roll costs 1 credit.
* A winning roll requires three identical symbols.
* Rewards are calculated and stored by the server.
* The house reroll rules are applied according to the player's current balance.
* Session state is stored on the server.
* Cash-out closes the session and prevents duplicate payouts.
* Multiple API instances coordinate through Redis.
* Simultaneous mutations for the same session are rejected using a distributed lock.

The server remains authoritative over all game outcomes, rewards, balances, and session state.

---

## Technology Stack

### Server

* NestJS
* TypeScript
* Jest
* REST API

### Infrastructure

* Upstash Redis
* Upstash TypeScript REST SDK
* HTTPS-secured Redis communication
* Environment-based configuration
* Redis key expiration

### Client

Not implemented yet.

---

## Design Process

### REST Instead of WebSockets

The application uses REST because every game action follows a request-response flow:

1. Create a session.
2. Retrieve a session.
3. Roll.
4. Cash out.

The server does not need to push unsolicited events to the client.

The slot animation is a client-side presentation concern and does not require a persistent WebSocket connection.

WebSockets would become useful for features such as multiplayer games, live leaderboards, shared jackpots, or server-pushed events.

### Redis Instead of Process Memory

A local in-memory store would only work reliably with one NestJS instance.

With multiple instances, each process would have separate memory, so a session created by one instance might not exist on another.

Redis provides shared state:

```text
Client
  |
  v
Load Balancer
  |
  +-- NestJS Instance A --+
  |                       |
  +-- NestJS Instance B --+--> Upstash Redis
```

Redis was selected because sessions are:

* Temporary
* Small
* Frequently updated
* Shared between API instances
* Suitable for automatic expiration

### No Relational Database

The assignment does not define authentication, persistent user accounts, transaction history, or balances that survive between sessions.

Redis is therefore sufficient for the current scope.

A relational database such as PostgreSQL would be appropriate if persistent accounts, auditing, or financial history were later required.

---

## Assumptions

The implementation uses the following interpretations:

* The cheating tier is based on the player's balance at the beginning of the roll.
* A roll always costs 1 credit, including winning rolls.
* Only one house reroll is allowed.
* The second result is accepted even when it is another win.
* Cash-out closes the anonymous session and returns its remaining credits.
* No persistent user account is created.
* Sessions expire after a configurable period.
* Reading a session does not refresh its expiration.
* The server lock lasts only while a mutation request is being processed.
* The future client animation does not control server locking.

---

## Server Architecture

The server separates the game rules from Redis and HTTP concerns:

```text
Controller
    |
    v
SessionsService
    |
    +--> GameEngineService
    |
    v
SessionRepository
    |
    v
RedisSessionRepository
    |
    v
Upstash Redis
```

### Game Engine

The game engine is responsible for:

* Generating symbols
* Detecting winning combinations
* Calculating rewards
* Deducting the roll cost
* Applying the house reroll probabilities

Randomness is accessed through an injectable `RandomSource`.

The production implementation uses Node.js cryptographic randomness. Tests use mocked randomness so game outcomes are deterministic.

### Session Repository

The session service depends on a repository abstraction rather than directly depending on Redis.

The Redis repository handles:

* Session creation
* Session retrieval
* Atomic roll commits
* Atomic cash-out
* Mutation locks
* Session expiration

---

## Game Session

A session contains data similar to:

```typescript
enum GameSessionStatus {
  Active = 'active',
  CashedOut = 'cashed-out',
}

interface GameSession {
  id: string;
  credits: number;
  status: GameSessionStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  cashedOutAt?: string;
  cashedOutCredits?: number;
}
```

Redis session keys use this format:

```text
casino:session:<sessionId>
```

Mutation locks use:

```text
casino:session-mutation-lock:<sessionId>
```

The default session TTL is 24 hours.

---

## Concurrency and Locking

All session mutations use a shared Redis lock.

The same lock is used for:

* Roll versus roll
* Roll versus cash-out
* Cash-out versus cash-out

### Lock Flow

1. Generate a unique lock token.
2. Attempt to create the Redis lock with `NX`.
3. Add an expiration with `PX`.
4. Reject the request with `409 Conflict` when the lock already exists.
5. Process the mutation when the lock is acquired.
6. Release the lock in a `finally` block.
7. Delete the lock only when its stored token matches the current request's token.

Because the lock is stored in Redis, it works across multiple NestJS instances.

Different sessions use different lock keys and do not block one another.

### Why Session Versions Are Also Kept

The distributed lock coordinates requests, while the version protects against stale writes.

The version remains useful when:

* A lock expires before a slow request finishes.
* Another code path modifies the session.
* A deployment contains different application versions.
* A mutation accidentally bypasses the lock.

Roll commits only succeed when the stored version matches the expected version.

Automatic retries are not performed. A version conflict is returned as an error because the request was already processed under a session lock.

---

## Redis Atomic Operations

Roll commits and cash-out use Redis Lua scripts.

The scripts validate and update the session as one atomic Redis operation.

This prevents another request from changing the session between validation and persistence.

The roll script validates:

* The session exists.
* The session is active.
* Credits are available.
* The version matches.
* The new balance is valid.

The cash-out script:

* Confirms that the session exists and is active.
* Records the payout.
* Sets the active balance to zero.
* Closes the session.
* Increments the version.
* Preserves the remaining TTL.

A separate script safely releases mutation locks using the unique lock token.

---

## API Routes

The API uses `/api` as its global prefix.

### Health Check

```http
GET /api/alive
```

Returns:

```typescript
interface AliveResponse {
  status: 'ok';
  redis: 'connected';
  service: string;
}
```

Example:

```json
{
  "status": "ok",
  "redis": "connected",
  "service": "casino-jackpot-api"
}
```

The application also checks Redis during startup and does not begin listening when Redis is unavailable.

---

### Create Session

```http
POST /api/sessions
```

Returns:

```typescript
interface CreateSessionResponse {
  sessionId: string;
  credits: number;
  status: GameSessionStatus.Active;
}
```

Example:

```json
{
  "sessionId": "7ed1903b-4839-4323-b673-11ebf984ea2d",
  "credits": 10,
  "status": "active"
}
```

---

### Get Session

```http
GET /api/sessions/:sessionId
```

Returns:

```typescript
interface GetSessionResponse {
  sessionId: string;
  credits: number;
  status: GameSessionStatus;
  createdAt: string;
  updatedAt: string;
  cashedOutAt?: string;
  cashedOutCredits?: number;
}
```

---

### Roll

```http
POST /api/sessions/:sessionId/roll
```

Returns:

```typescript
interface RollSessionResponse {
  sessionId: string;
  symbols: [SlotSymbol, SlotSymbol, SlotSymbol];
  won: boolean;
  reward: number;
  credits: number;
}
```

Example:

```json
{
  "sessionId": "7ed1903b-4839-4323-b673-11ebf984ea2d",
  "symbols": ["C", "L", "O"],
  "won": false,
  "reward": 0,
  "credits": 9
}
```

The response does not reveal whether the house performed a reroll.

---

### Cash Out

```http
POST /api/sessions/:sessionId/cash-out
```

Returns:

```typescript
interface CashOutSessionResponse {
  sessionId: string;
  cashedOutCredits: number;
  status: GameSessionStatus.CashedOut;
}
```

Example:

```json
{
  "sessionId": "7ed1903b-4839-4323-b673-11ebf984ea2d",
  "cashedOutCredits": 19,
  "status": "cashed-out"
}
```

---

## Route Map

| Method | Route                               | Purpose                          |
| ------ | ----------------------------------- | -------------------------------- |
| `GET`  | `/api/alive`                        | Check API and Redis availability |
| `POST` | `/api/sessions`                     | Create a game session            |
| `GET`  | `/api/sessions/:sessionId`          | Retrieve a session               |
| `POST` | `/api/sessions/:sessionId/roll`     | Perform a roll                   |
| `POST` | `/api/sessions/:sessionId/cash-out` | Cash out and close a session     |

---

## House Rules

The server applies the assignment rules as follows:

* Below 40 credits: no house reroll.
* Between 40 and 60 credits: a winning result has a 30% chance of being rerolled.
* Above 60 credits: a winning result has a 60% chance of being rerolled.
* Only one additional roll is allowed.
* The second result is always accepted.

---

## Error Responses

Common responses include:

| Status | Code                            | Meaning                             |
| -----: | ------------------------------- | ----------------------------------- |
|  `400` | Nest validation error           | Invalid UUID or request             |
|  `404` | `SESSION_NOT_FOUND`             | Session is missing or expired       |
|  `409` | `SESSION_OPERATION_IN_PROGRESS` | Another mutation owns the lock      |
|  `409` | `SESSION_ALREADY_CASHED_OUT`    | Session is already closed           |
|  `409` | `SESSION_STATE_CONFLICT`        | Stored version changed unexpectedly |
|  `422` | `INSUFFICIENT_CREDITS`          | Session cannot afford another roll  |
|  `503` | `SESSION_CREATION_FAILED`       | Session could not be created        |

Example:

```json
{
  "statusCode": 409,
  "code": "SESSION_OPERATION_IN_PROGRESS",
  "message": "Another operation is already in progress for this session."
}
```

---

# Local Setup

## Prerequisites

Install:

* Git
* Node.js 20 or newer
* npm
* An Upstash account and Redis database

NestJS and Angular do not need to be installed globally.

The current client is not yet implemented, so Angular installation is not required for the server setup.

## Clone the Repository

```powershell
git clone YOUR_REPOSITORY_URL
cd MS-Group-Home-Assignment
```

## Install Server Dependencies

```powershell
cd server
npm install
```

The project uses local package dependencies and npm scripts. A global NestJS CLI installation is not required.

## Create the Environment File

Create the file inside the `server` directory:

```text
MS-Group-Home-Assignment/
└── server/
    ├── .env
    ├── .env.example
    └── package.json
```

PowerShell:

```powershell
New-Item .env
```

Add:

```env
PORT=3000

UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

SESSION_TTL_SECONDS=86400
```

Use the REST URL and regular token shown in the Upstash console.

Do not use the read-only token because the application must update sessions.

The real `.env` file is ignored by Git.

## Start the Server

```powershell
npm run start:dev
```

The server should start at:

```text
http://localhost:3000/api
```

Verify it:

```powershell
curl.exe http://localhost:3000/api/alive
```

## Run Tests

```powershell
npm test
```

Additional checks:

```powershell
npm run format
npm run lint
npm run build
```

---

## Manual Testing Scripts

PowerShell scripts are available in:

```text
server/scripts/
```

Run them from the repository root:

```powershell
& .\server\scripts\api-smoke-test.ps1
```

Or from inside `server`:

```powershell
& .\scripts\api-smoke-test.ps1
```

The scripts support:

* Health verification
* Session creation
* Session retrieval
* Rolls
* Cash-out
* Duplicate cash-out validation

Some scripts contain:

```powershell
$SessionId = "ID_TO_REPLACE"
```

Replace it with a real session ID before running the script.

---

# Testing Approach

Unit tests do not connect to the real Upstash database.

Redis and randomness are mocked so tests remain:

* Fast
* Deterministic
* Independent of network availability
* Safe for CI environments

Current tests cover:

* Health responses
* Session creation
* Session retrieval
* Cash-out behavior
* Duplicate cash-out protection
* Roll outcomes
* Reward calculations
* House reroll boundaries
* Version conflicts
* Mutation-lock behavior

Redis integration tests can be added separately using a dedicated test database.

---

# Development Journey

## Repository and Server Setup

* Created and published the Git repository.
* Added the NestJS server.
* Configured environment loading.
* Added a Redis-aware health route.
* Configured startup to fail when Redis is unavailable.

## Session Storage

* Evaluated process-memory storage.
* Selected Redis for shared, expiring session state.
* Added secure UUID session identifiers.
* Added session creation and retrieval routes.

## Game Engine

* Separated game rules from infrastructure.
* Added typed symbols and rewards.
* Added injectable randomness.
* Implemented the house reroll rules.
* Added deterministic unit tests.

## Safe Mutations

* Added atomic Redis scripts for roll commits and cash-out.
* Added session versioning.
* Added a shared distributed mutation lock.
* Used the same lock for roll and cash-out.
* Added token-safe lock release.
* Removed automatic roll retries.

---
