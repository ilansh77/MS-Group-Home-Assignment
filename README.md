# Casino Jackpot

A full-stack slot-machine application built as a technical home assignment.

The project contains:

- A NestJS REST API that owns the game rules and session state.
- An Angular 19.2 client built with standalone components, signals, RxJS, functional guards and interceptors, and `OnPush` change detection.
- An Upstash Redis database shared by every API instance.

The server is authoritative for symbols, wins, rewards, balances, rerolls, cash-out, and session status. The browser only displays the state returned by the API.

---

## Assignment Coverage

The application implements the required game lifecycle:

- A new anonymous session starts with 10 credits.
- Each roll costs 1 credit.
- Three identical symbols produce a win.
- Rewards and house reroll rules are calculated on the server.
- Cash-out closes the session and records the remaining credits.
- Session state survives across API instances through Redis.
- Concurrent mutations of the same session are rejected with a distributed Redis lock.
- The session identifier is kept in an `HttpOnly` cookie rather than Angular state, browser storage, or a route parameter.
- The current-session probe returns `204 No Content` when no browser session exists or when its Redis record has expired.
- A dedicated `DELETE` endpoint clears the browser-managed session cookie before starting a new game.
- The Angular client restores server state after refresh, canonicalizes routes, animates the reels, and displays wins in a modal without influencing game results.

## Technology Stack

### Server

- NestJS
- TypeScript
- Jest
- REST API
- `cookie-parser`

### Client

- Angular 19.2
- Standalone components
- Angular Router with lazy-loaded route components
- Signals and computed signals
- RxJS
- Functional route guards
- Functional HTTP interceptors
- `ChangeDetectionStrategy.OnPush`
- Sass variables, mixins, and component-scoped styles
- Environment-specific API configuration

### Infrastructure

- Upstash Redis
- `@upstash/redis` REST SDK
- Redis key expiration
- Redis Lua scripts for atomic mutations
- HTTPS-secured Redis communication

---

## Design Decisions

### REST instead of WebSockets

The application follows a request-response flow: create a session, retrieve it, roll, and cash out. The server does not need to push unsolicited events to the browser, so REST keeps the implementation smaller and easier to test.

Slot animation is a client-side presentation concern. It does not determine the result and does not extend the server mutation lock. WebSockets would be more appropriate for future features such as multiplayer games, shared jackpots, live leaderboards, or server-pushed events.

### Redis instead of process memory

Process memory would only be reliable with one NestJS instance. With multiple instances, a request could reach a different process from the one that originally created the session.

Redis provides shared, expiring state:

```text
Browser
   |
   v
Load balancer
   |
   +-- NestJS instance A --+
   |                       |
   +-- NestJS instance B --+--> Upstash Redis
```

Redis fits this assignment because sessions are temporary, small, frequently updated, and shared between API instances.

### No relational database

The assignment does not require persistent user accounts, long-term balances, transaction history, or auditing. A relational database would become appropriate if those requirements were added later.

### Cookie-based session identification

The Redis session ID is a bearer credential. It is therefore not exposed through Angular route parameters, `localStorage`, `sessionStorage`, signals, or public API responses.

When a session is created, NestJS sends an opaque `casino_session` cookie configured with:

- `HttpOnly`, so browser JavaScript cannot read it.
- `SameSite=Lax`, reducing cross-site request risks.
- `Secure` in production.
- `Path=/api/sessions`, restricting where it is sent.
- A maximum age aligned with the Redis session lifetime.

The browser stores the cookie and attaches it to matching API requests when Angular sends requests with `withCredentials: true`. The Angular interceptor never reads, creates, or mutates the cookie.

Cookie handling differs by endpoint:

- `GET /api/sessions/current` uses the optional mode of the shared `SessionCookiePipe`.
- A missing cookie returns `204 No Content` without querying Redis.
- A well-formed cookie whose Redis session has expired is cleared and also returns `204 No Content`.
- A malformed cookie remains an authentication error and returns `401 INVALID_SESSION_COOKIE`.
- Roll and cash-out use the required mode of the same pipe, so a missing cookie returns `401 SESSION_COOKIE_MISSING`.
- `DELETE /api/sessions/current` clears the cookie with the same name and path used when it was created, but without a new lifetime.

The cookie identifies the session; Redis remains authoritative for credits, status, timestamps, version, and cash-out data.

### Signals and RxJS on the client

RxJS manages asynchronous HTTP flows, errors, sequencing, and finalization. Signals hold the latest synchronous state required by the UI, including the current session, credits, pending state, errors, and the last roll.

After a browser refresh, the signal store is empty but the cookie remains. The functional route guard calls `GET /api/sessions/current` and rehydrates the store when the server returns a session. A `204` response maps to `null` and is treated as the normal no-session state rather than an HTTP error.

The client uses one parameterized session-route guard for the welcome, game, and cash-out routes. It validates the server state and redirects to the canonical route for the returned session status.

## Assumptions

- The house reroll tier is based on the balance at the beginning of the roll.
- A roll costs 1 credit even when it wins.
- Only one house reroll is allowed.
- The second generated result is accepted, including another winning result.
- Cash-out closes the anonymous session and records its remaining credits.
- Reading a session does not refresh its expiration.
- Sessions expire after a configurable period; the default is 24 hours.
- A server mutation lock exists only while the request is being processed.
- The client animation does not control server concurrency.
- A valid client-side route guard improves navigation but is not an API security boundary.
- A missing current-session cookie is a normal anonymous state and returns `204 No Content`.
- Clearing the cookie starts a new browser session context; Redis data still follows its normal expiration lifecycle.
- Reel animation and the win modal are presentation-only and never generate or alter game results.

---

# Server

## Architecture

```text
HTTP request
    |
    v
Cookie decorator + SessionCookiePipe
    |
    v
SessionsController
    |
    v
SessionsService --------> GameEngineService
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

The HTTP layer extracts and validates the cookie. `SessionsService` remains independent of Express and receives the validated session ID as a normal method argument.

### Game engine

The game engine is responsible for:

- Generating three symbols.
- Detecting winning combinations.
- Calculating rewards.
- Deducting the roll cost.
- Applying the balance-based house reroll probabilities.

Randomness is accessed through an injectable `RandomSource`. Production uses Node.js cryptographic randomness, while unit tests inject deterministic mocks.

### Repository abstraction

`SessionsService` depends on a `SessionRepository` abstraction rather than directly on Redis. `RedisSessionRepository` implements session creation, retrieval, atomic roll commits, cash-out, expiration, and mutation locking.

A stored session has the following shape:

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

Redis keys use these formats:

```text
casino:session:<sessionId>
casino:session-mutation-lock:<sessionId>
```

## House rules

- Below 40 credits: no house reroll.
- From 40 through 60 credits: a winning result has a 30% chance of one reroll.
- Above 60 credits: a winning result has a 60% chance of one reroll.
- The second result is always accepted.

The public roll response does not reveal whether the house rerolled.

## Concurrency and atomicity

Roll and cash-out use the same per-session distributed lock. This prevents roll-versus-roll, roll-versus-cash-out, and cash-out-versus-cash-out overlap while allowing different sessions to proceed independently.

Lock flow:

1. Generate a unique request token.
2. create the Redis lock with `SET ... NX PX`.
3. Return `409 SESSION_OPERATION_IN_PROGRESS` when the lock already exists.
4. Perform the mutation after acquiring the lock.
5. Release the lock in `finally`.
6. Delete it only when the stored token still matches the request token.

The expiration prevents a crashed API instance from leaving a permanent lock. Token-safe release prevents an expired lock owner from deleting a newer request's lock.

Session versions are retained as defense in depth. If a lock expires before an unusually slow request completes, the Redis commit rejects the stale expected version rather than overwriting newer state. Version conflicts are not automatically retried.

Roll commits and cash-out are performed with Redis Lua scripts so validation and mutation happen atomically. The scripts preserve the remaining session TTL. A separate Lua script safely releases a mutation lock by token.

## Session cookie flow

```text
POST /api/sessions
    |
    v
NestJS creates the Redis session
    |
    v
Set-Cookie: casino_session=<opaque UUID>
    |
    v
Browser stores the HttpOnly cookie
    |
    v
Angular requests use withCredentials: true
    |
    v
cookie-parser -> @Cookie decorator -> SessionCookiePipe
    |
    +-- optional mode for GET /sessions/current
    |      missing cookie -> 204
    |      expired session -> clear stale cookie -> 204
    |      existing session -> 200 with public state
    |
    +-- required mode for roll and cash-out
           missing or malformed cookie -> 401
```

Starting a new game after cash-out uses:

```text
DELETE /api/sessions/current
    |
    v
NestJS sends an expired Set-Cookie header
with the same cookie name and path
    |
    v
Browser removes casino_session
    |
    v
Angular clears its signal store and navigates to /
```

Because the cookie is `HttpOnly`, Angular never clears it directly. The client calls the API and lets the browser process the server's `Set-Cookie` response.

## API routes

The API uses `/api` as its global prefix.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/alive` | Verify API and Redis availability |
| `POST` | `/api/sessions` | Create a session and set its cookie |
| `GET` | `/api/sessions/current` | Retrieve the cookie-identified session, or return `204` when absent or expired |
| `POST` | `/api/sessions/current/roll` | Perform a roll |
| `POST` | `/api/sessions/current/cash-out` | Cash out and close the session |
| `DELETE` | `/api/sessions/current` | Clear the browser session cookie |

The session ID is neither accepted as a route parameter nor returned in public response bodies.

### Health response

```typescript
interface AliveResponse {
  status: 'ok';
  redis: 'connected';
  service: string;
}
```

```json
{
  "status": "ok",
  "redis": "connected",
  "service": "casino-jackpot-api"
}
```

NestJS checks Redis during startup and does not begin listening when Redis is unavailable.

### Create-session response

```typescript
interface CreateSessionResponse {
  credits: number;
  status: 'active';
}
```

```json
{
  "credits": 10,
  "status": "active"
}
```

### Current-session response

An existing session returns `200 OK` with:

```typescript
interface GetSessionResponse {
  credits: number;
  status: 'active' | 'cashed-out';
  createdAt: string;
  updatedAt: string;
  cashedOutAt?: string;
  cashedOutCredits?: number;
}
```

A missing cookie or expired Redis session returns `204 No Content`. An expired session cookie is cleared before the response is completed.

### Roll response

```typescript
type SlotSymbol = 'C' | 'L' | 'O' | 'W';

type SlotSymbols = [SlotSymbol, SlotSymbol, SlotSymbol];

interface RollSessionResponse {
  symbols: SlotSymbols;
  won: boolean;
  reward: number;
  credits: number;
}
```

```json
{
  "symbols": ["C", "L", "O"],
  "won": false,
  "reward": 0,
  "credits": 9
}
```

### Cash-out response

```typescript
interface CashOutSessionResponse {
  cashedOutCredits: number;
  status: 'cashed-out';
}
```

```json
{
  "cashedOutCredits": 19,
  "status": "cashed-out"
}
```

### Clear-session response

`DELETE /api/sessions/current` returns `204 No Content`. The response clears `casino_session` by using the same cookie name and path as session creation, without assigning a new maximum age.

## Common API errors

| Status | Code | Meaning |
|---:|---|---|
| `401` | `SESSION_COOKIE_MISSING` | A required mutation endpoint did not receive the game-session cookie |
| `401` | `INVALID_SESSION_COOKIE` | The cookie is not a valid session UUID |
| `404` | `SESSION_NOT_FOUND` | A required operation referenced a Redis session that is missing or expired |
| `409` | `SESSION_OPERATION_IN_PROGRESS` | Another mutation currently owns the lock |
| `409` | `SESSION_ALREADY_CASHED_OUT` | The session is already closed |
| `409` | `SESSION_STATE_CONFLICT` | The stored version changed unexpectedly |
| `422` | `INSUFFICIENT_CREDITS` | The session cannot afford another roll |
| `503` | `SESSION_CREATION_FAILED` | A session could not be created |

`GET /api/sessions/current` intentionally translates the absence of a usable session into `204 No Content`. Other server, Redis, or network failures remain errors and are not converted into an anonymous state.

# Client

## Architecture

```text
Standalone page component
    |
    v
SessionStoreService
    |
    v
SessionsApiService
    |
    v
ApiClientService
    |
    v
Credentials interceptor
    |
    v
NestJS API
```

`ApiClientService` provides typed `GET`, `POST`, and `DELETE` methods. `SessionsApiService` maps those generic methods to the session endpoints.

The functional credentials interceptor applies `withCredentials: true` globally. It does not read or create the `HttpOnly` cookie. The browser stores the cookie from NestJS's `Set-Cookie` header and attaches it to matching requests.

The client calls the API host configured for the selected Angular environment. In local development, Angular runs on port 4200 and calls NestJS directly on port 3000, so NestJS enables credentialed CORS for the configured `CLIENT_ORIGIN`.

## Client routes

| Route | Screen | Canonical behavior |
|---|---|---|
| `/` | Welcome | Allowed without a session; active sessions redirect to `/game`, and cashed-out sessions redirect to `/cashout` |
| `/game` | Game | Requires an active session |
| `/cashout` | Cash-out | Requires a cashed-out session |
| `**` | Wildcard | Redirects to `/`, after which the session guard selects the canonical route |

A single functional `sessionRouteGuard` is parameterized through route data. It requests the current server session before navigation:

- No session allows `/` and redirects protected routes to `/`.
- An active session allows `/game` and redirects other application routes to `/game`.
- A cashed-out session allows `/cashout` and redirects other application routes to `/cashout`.
- Unexpected API or network failures do not masquerade as a valid session.

The guard improves navigation and state restoration, but the NestJS API still enforces every session requirement.

## Lazy-loaded screens

Lazy loading is implemented in `app.routes.ts` with `loadComponent()` and dynamic imports. Each standalone page is compiled into a separate route chunk and loaded only when its route is activated.

```typescript
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [sessionRouteGuard],
    data: {
      [SESSION_ROUTE_MODE]: WELCOME_ROUTE_MODE,
    },
    loadComponent: () =>
      import('./features/welcome/pages/welcome-page/welcome-page.component')
        .then(({ WelcomePageComponent }) => WelcomePageComponent),
  },
  {
    path: 'game',
    canActivate: [sessionRouteGuard],
    data: {
      [SESSION_ROUTE_MODE]: GameSessionStatus.Active,
    },
    loadComponent: () =>
      import('./features/game/pages/game-page/game-page.component')
        .then(({ GamePageComponent }) => GamePageComponent),
  },
  {
    path: 'cashout',
    canActivate: [sessionRouteGuard],
    data: {
      [SESSION_ROUTE_MODE]: GameSessionStatus.CashedOut,
    },
    loadComponent: () =>
      import('./features/cashout/pages/cashout-page/cashout-page.component')
        .then(({ CashoutPageComponent }) => CashoutPageComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
```

A resolver is not used because the guard already needs the current session to decide whether navigation is allowed. Loading the same resource in both a guard and resolver would duplicate work and create two sources for the same initial state.

## Client state flow

- `SessionsApiService` returns cold HTTP Observables.
- `SessionStoreService` stores the current public session state in signals; the cookie itself is never stored in Angular.
- The store derives credits, pending state, roll availability, and cash-out availability with readonly and computed signals.
- Request finalization resets pending state even when a request fails.
- `GET /sessions/current` returns `SessionState | null`; the API's `204` response becomes the normal `null` state.
- Successful create, roll, and cash-out responses update the relevant signals.
- A `401` or `404` from a required mutation clears stale local state and redirects the user to the welcome route.
- Components render signals under `OnPush` change detection.
- Explicit component subscriptions use `takeUntilDestroyed()`.
- Refreshing the browser clears in-memory signals, after which the route guard restores the session using the browser-managed cookie.

## Session lifecycle in the client

```text
Welcome page
    |
    | POST /sessions
    v
Active session -> /game
    |
    | POST /sessions/current/roll
    | update credits and last-roll signals
    v
Animated server result
    |
    | POST /sessions/current/cash-out
    v
Cashed-out session -> /cashout
    |
    | DELETE /sessions/current
    v
Cookie cleared + signal store cleared -> /
```

The cash-out page does not remove the cookie through JavaScript. It calls the server's `DELETE` endpoint, waits for the successful `204` response, clears the public signal state, and then navigates home.

## Casino presentation

The visual layer uses a red, burgundy, gold, cream, green-felt, and charcoal casino palette. Shared Sass variables such as `$mainRed` and reusable mixins provide consistent page shells, panels, headings, and buttons. Component styles use nested selectors while remaining locally encapsulated.

The game page simulates physical reels while a roll request is being resolved:

1. Decorative symbols cycle locally while the reels are spinning.
2. The controls remain disabled during the animation.
3. The three symbols returned by NestJS are revealed one reel at a time.
4. The final balance and win information still come exclusively from the server.
5. A winning result opens a reusable modal after the final reel stops.
6. Escape, backdrop interaction, or the modal button closes the result dialog.
7. Reduced-motion preferences shorten or disable nonessential animation.

The generated animation symbols are never submitted to the API and have no effect on rewards, balance, reroll rules, or concurrency.

# Local Setup

## Prerequisites

Install:

- Git
- Node.js 22.x, which includes npm

Check the installed versions:

```sh
node --version
npm --version
```

The expected Node output begins with `v22`.

Angular CLI and NestJS CLI do not need to be installed globally because `npm install` installs the versions declared by each project and npm scripts use those local binaries.

Optional global installations:

```sh
npm install --global @angular/cli@19.2
npm install --global @nestjs/cli
```

Verify them only when installed globally:

```sh
ng version
nest --version
```

## Clone the repository

```sh
git clone YOUR_REPOSITORY_URL
cd MS-Group-Home-Assignment
```

## Configure and run the server

Install dependencies:

```sh
cd server
npm install
```

The real server environment file is supplied separately. Place it at exactly:

```text
MS-Group-Home-Assignment/server/.env
```

The result should resemble:

```text
server/
├── .env
├── .env.example
├── package.json
└── src/
```

The supplied file contains values equivalent to:

```env
NODE_ENV=development
PORT=3000
CLIENT_ORIGIN=http://localhost:4200

UPSTASH_REDIS_REST_URL=https://example.upstash.io
UPSTASH_REDIS_REST_TOKEN=example-token

SESSION_TTL_SECONDS=86400
```

The supplied Upstash credentials belong to the assignment database. The real `.env` file is ignored by Git and must not be committed.

Start NestJS:

```sh
npm run start:dev
```

The API is available at:

```text
http://localhost:3000/api
```

Verify it:

```sh
curl http://localhost:3000/api/alive
```

Keep this terminal running.

## Configure and run the client

Open a second terminal from the repository root:

```sh
cd client
npm install
```

The local Angular environment should point directly to NestJS:

```typescript
// client/src/environments/environment.development.ts
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000/api',
};
```

No Angular development proxy is required. The browser contacts NestJS directly, and the server allows the Angular origin through credentialed CORS.

Start Angular with the development environment:

```sh
npm run dev
```

The client is available at:

```text
http://localhost:4200
```

The expected local setup is:

```text
Terminal 1: server/ -> npm run start:dev -> http://localhost:3000
Terminal 2: client/ -> npm run dev       -> http://localhost:4200
```

Open `http://localhost:4200` in a browser.

## Angular environments

The client uses build configurations for development, QA, and production. API hosts are configured in:

```text
client/src/environments/environment.development.ts
client/src/environments/environment.qa.ts
client/src/environments/environment.production.ts
```

Development targets `http://localhost:3000/api`. QA and production may contain deployment-specific placeholders until those environments are provisioned.

Typical commands:

```sh
npm run dev       # development configuration
npm start         # QA configuration, when configured
npm run build     # production build
npm run build:qa  # QA build
```

## Manual cookie testing

The server can be tested without Angular by using a curl cookie jar:

```sh
cookie_jar="./casino-cookies.txt"

curl   --cookie-jar "$cookie_jar"   --request POST   http://localhost:3000/api/sessions

curl   --cookie "$cookie_jar"   http://localhost:3000/api/sessions/current

curl   --cookie "$cookie_jar"   --request POST   http://localhost:3000/api/sessions/current/roll

curl   --cookie "$cookie_jar"   --request POST   http://localhost:3000/api/sessions/current/cash-out

curl   --cookie "$cookie_jar"   --cookie-jar "$cookie_jar"   --request DELETE   http://localhost:3000/api/sessions/current
```

After the final request, calling `GET /api/sessions/current` with the updated cookie jar should return `204 No Content`.

# Tests and Validation

## Server

Server unit tests mock Redis and randomness, keeping them deterministic and independent of network availability. Coverage includes health checks, session creation and retrieval, game rules, balance boundaries, cash-out behavior, mutation locks, version conflicts, cookie validation modes, cookie options, controller-to-service forwarding, `204` session probing, stale-cookie clearing, and the `DELETE` cookie route.

Run:

```sh
cd server
npm test
npm run lint
npm run build
```

## Client

The client test suite should cover the API service, signal store, consolidated session guard, route outcomes, page actions, reel-result sequencing, and win-modal interactions.

Run the Angular test and production build commands from `client/`:

```sh
cd client
npm test
npm run lint
npm run build
```

# Development Process

The implementation evolved through these decisions:

1. Created the NestJS API and Redis-aware health check.
2. Replaced process-memory sessions with expiring Upstash Redis records.
3. Separated game rules behind an injectable game engine and deterministic random-source tests.
4. Added atomic Redis scripts for roll commits and cash-out.
5. Added optimistic session versions as stale-write protection.
6. Added a shared per-session distributed lock and token-safe release.
7. Replaced public session IDs with an opaque `HttpOnly` cookie.
8. Added cookie parsing, parameterized required/optional validation, and credentialed CORS.
9. Added `204 No Content` semantics for the nullable current-session probe and stale-cookie cleanup.
10. Added `DELETE /api/sessions/current` to clear the browser-managed cookie safely.
11. Added the Angular 19.2 application with standalone lazy-loaded screens.
12. Added typed `GET`, `POST`, and `DELETE` API methods, a global credentials interceptor, an RxJS-backed signal store, and a consolidated functional session guard.
13. Added canonical welcome, active-game, and cash-out routing without a separate not-found screen.
14. Added reusable Sass variables and mixins, animated reels, reduced-motion support, and a reusable win modal.