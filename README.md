# 🛍️ Aura - E-commerce Platform

Aura is an online store I built end to end: a React storefront, an Express REST API and a PostgreSQL database through Prisma. You can browse around 100 products, filter and search them, add things to a cart or wishlist, check out with Cash on Delivery or Razorpay, follow your order, and leave a review once it's delivered.

It's a single API (a modular monolith), not a set of microservices. There's no admin panel, Docker, Redis or Elasticsearch in this version. I kept the scope small on purpose and put the effort into getting checkout, payments and auth right, and into making the storefront feel good to use.

One rule shaped most of the backend: the browser never decides what anything costs. At checkout it sends IDs and choices, and the server recalculates prices, discounts, shipping, tax and stock inside one database transaction.

The repo follows the [WebVoltz Engineering Standards](common/), so strict TypeScript, zero-warning ESLint, coverage thresholds, Husky hooks, commitlint, Gitleaks and CI are all switched on.

## ✨ Features

**Shopping**

- Nested categories, 47 brands and products with variants (colour, storage, size and so on).
- Filters for category, brand, price, stock and variant attributes, with counts next to each option. Six sort orders, pagination, and everything is kept in the URL so you can share a filtered page.
- A ⌘K search palette that shows results as you type.
- A cart stored on the server. Prices and stock are re-checked every time it loads, and a guest cart gets merged into your account when you sign in.
- A wishlist and an address book.

**Checkout and orders**

- A three-step checkout (address, payment, review) with coupons. There are seven demo coupons, and the invalid ones each fail with a different, readable reason.
- Checkout accepts an `Idempotency-Key`, so double-clicking "Place order" won't create two orders.
- Stock can't be oversold. Checkout claims stock with `UPDATE … WHERE stock >= qty` inside the transaction, and there's a test that fires parallel checkouts at the last unit to prove it.
- Cash on Delivery works with no setup. Razorpay turns on when you add keys: payments are verified on the server, webhooks can safely arrive twice, failed payments can be retried, and cancelled orders are refunded.
- Order history with a status timeline. Cancelling puts the stock back and returns the coupon use.
- Reviews are only open to people who actually received the product (a delivered order).

**Accounts**

- Sign up, sign in, email verification, password reset, profile and password change.
- The access token lasts 15 minutes and only lives in memory. The refresh token sits in an httpOnly cookie and changes on every use. If an old one is ever reused, every session from that login is logged out.

**The storefront**

I wanted it to feel like a polished store rather than a demo, so there's quite a bit of animation. The hero headline reveals word by word, and buttons pull slightly towards the cursor. Category cards tilt in 3D, and there's a mega-menu. When you add something to the bag it flies into the cart icon, and product images have a zoom lens. You get confetti when an order goes through, and skeleton loaders while pages load. If your system asks for reduced motion, all of it switches off.

It has light and dark themes and works from small phones up to wide desktops. I checked seven screen sizes, from 360 px to 1920 px, for anything overflowing or getting cut off.

## 📸 Screenshots

These were all taken from the app running locally with the demo data loaded.

### Browsing

|                                                                     |                                                                   |
| ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| ![Home page](docs/screenshots/01-home.png)                          | ![Shop by category](docs/screenshots/02-categories.png)           |
| Home page. The headline animates in and the product collage floats. | Shop by category. The cards tilt as you move the mouse over them. |
| ![Mega menu](docs/screenshots/03-mega-menu.png)                     | ![Command palette search](docs/screenshots/04-search.png)         |
| The Shop menu, previewing whichever category you hover.             | Pressing ⌘K and typing "iphone".                                  |
| ![Product listing with filters](docs/screenshots/05-listing.png)    | ![Product page](docs/screenshots/06-product.png)                  |
| Smartphones filtered to Apple and Samsung, most expensive first.    | A product page with colour and storage options.                   |

### Reviews, cart and checkout

|                                                                    |                                                                  |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| ![Reviews](docs/screenshots/07-reviews.png)                        | ![Cart drawer](docs/screenshots/08-cart-drawer.png)              |
| Reviews, with the rating breakdown and filters.                    | The cart drawer, showing how far you are from free shipping.     |
| ![Checkout address step](docs/screenshots/09-checkout-address.png) | ![Checkout review step](docs/screenshots/10-checkout-review.png) |
| Step 1 of checkout: pick where it's going.                         | Step 3, with the `WELCOME10` coupon applied.                     |
| ![Order confirmed](docs/screenshots/11-order-success.png)          | ![Sign in](docs/screenshots/15-login.png)                        |
| After placing an order.                                            | The sign-in page.                                                |

### Account and orders

|                                                           |                                                  |
| --------------------------------------------------------- | ------------------------------------------------ |
| ![Account](docs/screenshots/12-account.png)               | ![Order history](docs/screenshots/13-orders.png) |
| The account page.                                         | Order history.                                   |
| ![Order tracking](docs/screenshots/14-order-tracking.png) |                                                  |
| A delivered order. Each item now has a Review button.     |                                                  |

### Dark mode

|                                                                       |                                                       |
| --------------------------------------------------------------------- | ----------------------------------------------------- |
| ![Dark home](docs/screenshots/16-dark-home.png)                       | ![Dark product](docs/screenshots/17-dark-product.png) |
| Dark mode follows your system setting, or you can switch it yourself. | A product page in dark mode.                          |

### Tablet and mobile

|                                                                    |                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| ![Tablet home](docs/screenshots/18-tablet-home.png)                | ![Tablet product](docs/screenshots/19-tablet-product.png)           |
| On a tablet the collage is replaced by a row of featured products. | The tablet product page keeps the gallery and details side by side. |

|                                                     |                                                           |                                                           |                                                     |
| --------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------- |
| ![Mobile home](docs/screenshots/20-mobile-home.png) | ![Mobile listing](docs/screenshots/21-mobile-listing.png) | ![Mobile product](docs/screenshots/22-mobile-product.png) | ![Mobile menu](docs/screenshots/23-mobile-menu.png) |
| Home on a phone.                                    | Listing, with filters in a pull-out panel.                | The buy bar sticks to the bottom.                         | The menu.                                           |

## 🧰 Tech stack

| What                                          | Used for                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| React 19, Vite 8                              | The storefront in `apps/web`                                             |
| Tailwind CSS 4, Motion 13                     | Styling, themes and animation                                            |
| TanStack Query 5, Zustand 5                   | Data fetching and caching; small bits of client state (session, cart UI) |
| React Router 8                                | Routing, filters in the URL, scroll restoration                          |
| Express 5, TypeScript                         | The API in `apps/api`                                                    |
| PostgreSQL 18                                 | The database                                                             |
| Prisma 7 with `@prisma/adapter-pg`            | Schema, migrations, the typed client and the seed data                   |
| Zod 4                                         | Validating requests, config and API responses                            |
| Argon2id, JSON Web Tokens                     | Passwords and sessions                                                   |
| Razorpay                                      | Online payments (optional)                                               |
| npm workspaces                                | Running it as one repo                                                   |
| ESLint, Prettier, Husky, commitlint, Gitleaks | Keeping the code clean and secrets out of Git                            |
| Vitest, Supertest, Testing Library            | Tests                                                                    |
| GitHub Actions                                | CI                                                                       |

Headings use Plus Jakarta Sans and body text uses Inter. Both are self-hosted.

## 🏗️ Architecture

```mermaid
flowchart LR
    User(["Browser"])
    Web["apps/web<br/>React + Vite storefront"]
    API["apps/api<br/>Express REST API"]
    Services["Services<br/>business rules"]
    Prisma["Prisma client<br/>@ecommerce/db"]
    PG[("PostgreSQL")]
    Razorpay(["Razorpay"])
    Shared["packages/*<br/>shared · types · validation"]
    Seed["Seeder<br/>prisma/seeds"]

    User <--> Web
    Web -- "REST + JWT<br/>refresh cookie" --> API
    API -- "validated input" --> Services
    Services --> Prisma --> PG
    Services -- "create order / verify" --> Razorpay
    Razorpay -- "webhooks" --> API
    Shared -. "imported by" .-> Web
    Shared -. "imported by" .-> API
    Seed --> PG
```

A request goes route → controller → service → Prisma → PostgreSQL. Controllers only validate the input with Zod and hand it on; the actual rules live in the services.

Services get everything they depend on (config, database, logger, mailer, Razorpay client, clock) passed in through one `AppContext` object. That's what makes the tests practical: they build the real app but swap in a fake mailer, a fake Razorpay and a clock they can move forward.

The three packages under `packages/` are shared between the API and the storefront:

- `@ecommerce/shared` has constants, money formatting and the one function that works out order totals.
- `@ecommerce/types` describes every API response as a Zod schema. The API is typed against it, and the storefront checks each response against it at runtime, so if the two ever drift apart you get a clear error instead of a broken page.
- `@ecommerce/validation` has the request schemas, so forms and the API reject the same things.

All money is stored as whole paise (₹1 = 100 paise) to avoid floating-point rounding problems.

## 📁 Project structure

```text
apps/
  api/                Express API. modules/ has one folder per feature (auth, catalog, cart,
                      checkout, orders, payments, reviews…), plus middleware/, services/, config/
  web/                React storefront: pages/, features/, components/, layouts/, hooks/,
                      stores/, services/, lib/
packages/
  shared/             constants, money helpers, pricing        (@ecommerce/shared)
  types/              API response schemas and types           (@ecommerce/types)
  validation/         request schemas                          (@ecommerce/validation)
prisma/               schema, migrations, seed data, generated client   (@ecommerce/db)
common/               shared configs copied from the WebVoltz standards repo
scripts/              tests that check the repo follows the standards
docs/screenshots/     the images in this README
.github/workflows/    CI
```

## 🔄 How the main flows work

**Placing an order**

```text
POST /api/checkout  { addressId, paymentMethod, couponCode? }   + Idempotency-Key
  -> start a transaction
  -> load the cart and check every product, variant and stock level
  -> work out prices -> coupon -> shipping -> 18% GST
  -> create the order, copying item details and the address into it
  -> take the stock:  UPDATE … SET stock = stock - qty WHERE stock >= qty
     (if any row doesn't update, someone else got there first, so roll everything back)
  -> use up the coupon the same way, create the payment record, empty the cart
  -> commit. Sending the same Idempotency-Key again just returns this order.
```

**Paying with Razorpay**

```text
POST /api/payments/create   -> the server creates a Razorpay order for the order's total
  -> Razorpay's checkout opens in the browser (its script only loads at this point)
POST /api/payments/verify   -> the server checks Razorpay's signature, then marks the order paid
POST /api/payments/webhook  -> Razorpay confirms or fails the payment; safe to receive twice
```

**Staying signed in**

```text
sign in   -> access token (15 min, in memory) + refresh token (httpOnly cookie, stored hashed)
401       -> POST /api/auth/refresh -> new pair of tokens, the old refresh token stops working
an old refresh token shows up again -> assume it was stolen and end every session from that login
```

## 🔑 Environment variables

Each of `prisma/`, `apps/api/` and `apps/web/` has a `.env.example`. Copy it to `.env` next to it. The `.env` files are git-ignored. The API checks its config when it starts and refuses to run if something is wrong.

| Variable                                                              | Where           | What it's for                                                    |
| --------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------- |
| `DATABASE_URL`                                                        | `prisma`, `api` | Your PostgreSQL connection. Tests use the same name plus `_test` |
| `JWT_ACCESS_SECRET`                                                   | `api`           | Required. A long random string for signing tokens                |
| `JWT_ACCESS_TTL_SECONDS` / `REFRESH_TOKEN_TTL_DAYS`                   | `api`           | How long tokens last (defaults 900 seconds and 30 days)          |
| `PORT` / `LOG_LEVEL` / `NODE_ENV`                                     | `api`           | API port (4000), log detail, environment                         |
| `APP_URL` / `CORS_ORIGINS`                                            | `api`           | The storefront's address, for email links and CORS               |
| `TRUST_PROXY`                                                         | `api`           | Set this if the API runs behind a reverse proxy                  |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | `api`           | Optional. Leave them empty and only Cash on Delivery is offered  |
| `VITE_API_BASE_URL` / `VITE_APP_ENV`                                  | `web`           | Where the storefront finds the API. These end up in the browser  |

To make a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## 💻 Running it locally

You'll need Node 24, npm 11 and PostgreSQL 16 or newer (I use 18). If you want to commit, you'll also need Gitleaks 8.30.x, because the pre-commit hook runs it.

1. Install everything. This also generates the Prisma client and sets up the Git hooks.

   ```bash
   npm ci
   ```

2. Create a database user and two databases. Run this once as a PostgreSQL superuser. The second database is for the API tests.

   ```sql
   CREATE ROLE ecommerce LOGIN CREATEDB PASSWORD 'choose-a-password';
   CREATE DATABASE ecommerce OWNER ecommerce;
   CREATE DATABASE ecommerce_test OWNER ecommerce;
   ```

3. Copy the three `.env.example` files to `.env`. Put your password into `DATABASE_URL` and fill in `JWT_ACCESS_SECRET`.

4. Set up the tables, load the demo data and start both apps:

   ```bash
   npm run db:migrate:deploy
   npm run db:seed
   npm run dev
   ```

The store is at http://localhost:5173 and the API at http://localhost:4000/api. There's a health check at `/api/health`.

**Demo logins and data**

| What      | Details                                                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Customer  | `demo@example.com` / `Demo@12345`. Already has addresses, a cart, a wishlist and 3 orders                                         |
| Admin     | `admin@example.com` / `Admin@12345`. The role exists, but there's no admin panel yet                                              |
| Coupons   | `WELCOME10`, `FLAT200` and `FESTIVE25` work. `SUMMER50`, `COMINGSOON`, `FIRST100` and `RETIRED` fail, each for a different reason |
| Catalogue | 7 main categories, 21 sub-categories, 47 brands, 100 products, 220 variants and about 300 reviews                                 |

One of the demo customer's orders is already delivered. It contains _Essence Mascara Lash Princess_ and _Apple AirPods_, so you can try writing a review right away.

No emails are actually sent in development. Verification and password-reset links are printed in the API terminal instead.

## ⚙️ Commands

Run these from the repo root.

| Command                     | What it does                                                 |
| --------------------------- | ------------------------------------------------------------ |
| `npm run dev`               | Starts the API and the storefront together                   |
| `npm run build`             | Builds everything, in the right order                        |
| `npm run quality`           | Prettier check, ESLint and TypeScript across every workspace |
| `npm test`                  | All tests, with coverage                                     |
| `npm run format`            | Formats the code with Prettier                               |
| `npm run db:migrate`        | Creates and applies a new migration while you're developing  |
| `npm run db:migrate:deploy` | Applies the existing migrations                              |
| `npm run db:seed`           | Wipes the data and loads the demo data                       |
| `npm run db:reset`          | Drops the database, recreates it and loads the demo data     |
| `npm run db:studio`         | Opens Prisma Studio so you can look at the data              |
| `npm run security:audit`    | Fails if any dependency has a high-severity advisory         |

Be careful with `db:seed` and `db:reset`: both delete what's there. The seeder won't run with `NODE_ENV=production` unless you also set `SEED_ALLOW_PRODUCTION=true`.

## 🔌 API

Every route starts with `/api`. Errors always come back in the same shape: `{ "error": { "code", "message", "details?" } }`.

```text
GET    /health
POST   /auth/register | /auth/login | /auth/refresh | /auth/logout
POST   /auth/forgot-password | /auth/reset-password | /auth/verify-email | /auth/verify-email/resend
GET    /auth/me      PATCH /auth/me      POST /auth/change-password
GET    /categories   GET /categories/:slug   GET /brands   GET /brands/:slug
GET    /products     GET /products/facets    GET /products/:slug   GET /products/:slug/related
GET    /products/:productId/reviews      GET /products/:productId/reviews/eligibility
POST   /products/:productId/reviews      PATCH|DELETE /reviews/:id
GET|DELETE /cart     POST /cart/items    PATCH|DELETE /cart/items/:id    POST /cart/merge
GET    /wishlist     POST|DELETE /wishlist/:productId
GET|POST /addresses  GET|PATCH|DELETE /addresses/:id
POST   /checkout     POST /checkout/validate-coupon
GET    /orders       GET /orders/:id     POST /orders/:id/cancel
GET    /payments/methods   POST /payments/create   POST /payments/verify   POST /payments/webhook
```

Here's what a product search looks like:

```text
GET /api/products?search=iphone&category=electronics&brand=apple&minPrice=10000&maxPrice=100000
                 &attr=storage:256GB&inStock=true&sort=price_asc&page=1&limit=20
```

You can repeat `brand` and `attr` to pick more than one. Prices you send are in rupees, but every amount the API returns is in paise. `sort` can be `newest`, `price_asc`, `price_desc`, `rating`, `name_asc` or `popular`.

## 🧪 Tests

| Workspace             | Tests | Statements | Branches | Functions | Lines |
| --------------------- | ----: | ---------: | -------: | --------: | ----: |
| Policy (root)         |    23 |          - |        - |         - |     - |
| `packages/shared`     |    27 |       100% |     100% |      100% |  100% |
| `packages/types`      |     9 |       100% |     100% |      100% |  100% |
| `packages/validation` |    27 |       100% |     100% |      100% |  100% |
| `prisma`              |     5 |       100% |     100% |      100% |  100% |
| `apps/api`            |   107 |      97.4% |    89.9% |      100% | 97.3% |
| `apps/web`            |   107 |      99.5% |    96.2% |      100% | 99.5% |

The standards require at least 90% statements, 85% branches, 100% functions and 90% lines, and the build fails below that.

The API tests make real HTTP calls against a real database, the `_test` copy of whatever `DATABASE_URL` points to. The `_test` suffix is always added, so the tests can't wipe your development data by mistake. They cover the paths that matter most: signing up and in, refreshing tokens (including a reused one), cart to checkout to order, COD and Razorpay payments with webhooks, cancelling and refunds, verified reviews, and parallel checkouts racing for the last item.

On the storefront, coverage is measured on the logic (config, the API client, stores and hooks). The components have their own behaviour tests using Testing Library.

## 🔒 Code quality and security

The standards config lives in [`common/`](common/). In practice that means:

- TypeScript is strict everywhere, including `skipLibCheck: false`. No `any`, and no `!` assertions.
- ESLint is type-aware, includes the accessibility rules, and allows zero warnings. Prettier handles formatting.
- Before each commit, Husky runs Gitleaks, lint-staged, the full quality check and a build. Commit messages have to follow Conventional Commits.
- [CI](.github/workflows/ci.yml) does it all again on every push and pull request. It scans the full history for secrets, runs `npm audit`, and runs the tests against a PostgreSQL 18 container.

On the security side:

- The API uses Helmet, a CORS allowlist, a 100 kB limit on request bodies, and rate limits, with a stricter limit on auth routes. Errors never include stack traces or internals.
- Passwords are hashed with Argon2id. Login takes the same time whether or not the email exists, so you can't use it to find accounts.
- Refresh tokens are stored hashed. Routes that rely on the cookie also need an `X-Requested-With` header, which blocks cross-site requests.
- Email-verification and reset links work once and expire. Changing or resetting your password signs out your other sessions.
- Razorpay signatures are checked with a constant-time comparison.
- Logs are JSON and passwords and tokens are masked out.

## 🧠 Design decisions

**One API, split by feature.** Everything is deployed as one Express app, but auth, catalogue, cart, checkout, orders, payments and reviews each have their own module. For a store this size that's much simpler to run than separate services, and a module can still be pulled out later if it needs to be.

**Money in paise, one pricing function.** Storing whole numbers avoids rounding bugs, and there's exactly one function that computes totals. The storefront only uses it for estimates it labels as such. The number you actually pay always comes from the server.

**Conditional updates instead of row locks.** `UPDATE … WHERE stock >= qty` either takes the stock or changes nothing. If nothing changes, the whole checkout rolls back. That's simpler than `SELECT … FOR UPDATE` and it holds up under concurrent orders.

**The database checks things too.** `CHECK` constraints stop negative stock or prices, out-of-range ratings, and orders whose total doesn't add up. A unique index stops the same item appearing on two cart lines. If a bug gets past the application code, the database still says no.

**Orders keep their own copies.** An order stores the product name, SKU, price and the address as they were when it was placed. Editing a product or deleting an address later doesn't change old orders.

**Where the tokens live.** The refresh token is in a cookie JavaScript can't read. That means a script injected into the page could steal a short-lived access token at worst, not a login that lasts 30 days. There's also a small `aura-session` flag in `localStorage`, which only tells the app whether it's worth trying a refresh on page load.

**Checking responses at runtime.** The storefront validates every API response against the shared schemas. It costs very little, and a backend change can't quietly break the UI.

**Animation that stays out of the way.** Animations only move and fade elements, which keeps them smooth. They switch off for people who ask for reduced motion. Pages load as separate chunks, and the Razorpay script is only fetched when someone actually pays online.

### Where I deviated from the standards

A few things didn't fit the standards or the original plan exactly, so here they are:

1. **npm instead of pnpm.** The plan said pnpm, but the standards require npm, so `pnpm db:*` became `npm run db:*`.
2. **The generated Prisma client isn't linted or formatted.** Prisma 7 writes files with `eslint-disable` and `@ts-nocheck` at the top, and there's no way to turn that off. It's generated into `prisma/generated/`, outside `src/`, and it's git-ignored. A policy test makes sure `src/generated/**` is still linted, and all code that uses the client is fully type-checked.
3. **A few pinned dependencies.** `deepmerge-ts@8.0.2` and `mysql2@3.24.4` replace vulnerable versions that the Prisma CLI pulls in, until Prisma ships a fix. React is pinned to 19.2.7, because Prisma Studio was pulling in a second copy and the page went blank. Vitest is 4.1.11 instead of 4.1.10, which has a moderate advisory.
4. **No pino.** One of its dependencies doesn't type-check with `@types/node` 26 and `skipLibCheck: false`. The API has a small JSON logger that does the same redaction instead.
5. **Storefront coverage** is measured on the logic layer, not every component.
6. **`db:reset` runs the seeder itself**, since `prisma migrate reset` stopped seeding in Prisma 7.
7. **GitHub Actions instead of GitLab CI.** The workflow runs the same jobs as the shared GitLab config. I left `common/gitlab/` in place untouched for reference.

## 🐛 Troubleshooting

**`Port 5173 is already in use`.** An old `npm run dev` is still running somewhere. Stop it with Ctrl+C in its terminal. If you can't find it, run `netstat -ano | findstr :5173` and end that PID.

**The API exits with `Invalid service configuration.`** Something in `apps/api/.env` is missing or wrong. Most of the time `JWT_ACCESS_SECRET` is empty or `DATABASE_URL` doesn't start with `postgresql://`.

**`password authentication failed for user "ecommerce"`.** The password in `DATABASE_URL` doesn't match the one you gave the role. Check both `prisma/.env` and `apps/api/.env`.

**API tests say `database "ecommerce_test" does not exist`.** You skipped the second `CREATE DATABASE` in step 2.

**The page is blank after installing packages.** Two copies of React got installed. Running `npm ci` again sorts it out.

**Verification or reset emails never arrive.** That's expected in development. Look in the API terminal for the link.

**Razorpay doesn't show up at checkout.** It only appears when all three `RAZORPAY_*` variables are set.

**A commit is rejected with `gitleaks 8.30.x is required`.** Install Gitleaks and make sure it's on your `PATH`.

## 🚀 What's next

- **An admin panel.** Right now nothing moves an order from processing to shipped to delivered. The statuses and timeline are ready for it, and the `ADMIN` role already exists.
- **Real email.** Emails currently go to the log through a `Mailer` interface. Hooking up SES or Postmark would be the next step.
- **Expiring unpaid orders.** An unpaid Razorpay order holds its stock until someone cancels it. A background job should release it after a while.
- **Proper GST.** Tax is a flat 18% for now. Real GST depends on the product category and the state.
- **Better search.** Search is simple case-insensitive matching. PostgreSQL's `pg_trgm` or full-text search would be the next step before anything like Elasticsearch.
- **Our own images.** The demo products and photos come from [DummyJSON](https://dummyjson.com), with prices converted to rupees, and the images load from their CDN.
