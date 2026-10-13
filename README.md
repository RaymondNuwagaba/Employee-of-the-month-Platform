# Employee of the Month Platform

Employees vote for colleagues each month. Each vote rates four weighted criteria. The portal announces a monthly winner and keeps a live annual leaderboard.

| Criterion | Weight |
| --- | --- |
| Supporting each other | 40% |
| Timeliness | 30% |
| Interpersonal skills | 15% |
| Innovation | 15% |

Weights are configurable by admins. Each campaign freezes the weights at the moment it opens.

## Stack

- **backend/**: FastAPI, SQLAlchemy 2, Alembic, PostgreSQL (psycopg 3), Python 3.12
- **frontend/**: Vite, React 19, TypeScript, Tailwind CSS v4, TanStack Query, Recharts, MSAL
- **Auth**: Microsoft Entra ID (Microsoft 365) single sign-on, with an httpOnly session cookie

## Prerequisites

- Python 3.12
- Node.js 20 or later
- PostgreSQL 14 or later

## Backend setup

```bash
createdb eotm
createdb eotm_test            # used by the test suite

cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then edit DATABASE_URL, SESSION_SECRET, ENTRA_*
alembic upgrade head          # creates tables and seeds the 4 criteria
python -m app.seed            # optional: demo departments, people, 10 months of votes
uvicorn app.main:app --reload # http://localhost:8000, docs at /docs
```

Run the tests:

```bash
cd backend && .venv/bin/pytest -q
```

## Frontend setup

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173, proxies /api to :8000
```

Other scripts: `npm run build`, `npm run lint` (oxlint).

### Local sign-in without Microsoft

Set `AUTH_DEV_MODE=true` in `backend/.env`. The login page then lists every seeded user for one-click sign-in. Useful demo accounts:

- `alice.mwesigwa@company.com`: admin
- `grace.achieng@company.com`: HR
- Any other seeded person: employee

> **Security:** never enable `AUTH_DEV_MODE` in production. It lets anyone sign in as any user without a password.

## Microsoft Entra ID setup

1. In the Entra admin center, open **App registrations** and select **New registration**.
2. Under **Authentication**, add a **Single-page application** platform. Set the redirect URI to the site origin, for example `http://localhost:5173` or `https://eotm.yourcompany.com`.
3. Under **API permissions**, add delegated Microsoft Graph `User.Read`. Grant admin consent.
4. Copy the **Directory (tenant) ID** to `ENTRA_TENANT_ID` and the **Application (client) ID** to `ENTRA_CLIENT_ID`.
5. Optional: map roles to Entra groups. Under **Token configuration**, add a groups claim. Then set `ENTRA_GROUP_ADMIN` and `ENTRA_GROUP_HR` to group object IDs. Set `ENTRA_GROUP_EMPLOYEE` to restrict who may sign in.
   - Alternative: define app roles `EOTM.Admin`, `EOTM.HR` and `EOTM.Employee` and assign them to users.

The first sign-in creates the user from their Microsoft profile, including department and job title. Admins can adjust role, department, hire date and eligibility later.

## Production checklist

- Set `SESSION_SECRET` to a long random value: `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
- Set `COOKIE_SECURE=true` and serve over HTTPS.
- Keep `AUTH_DEV_MODE=false`.
- Run `npm run build`. Serve `frontend/dist` and proxy `/api` to uvicorn on the **same origin**. The session cookie and the CSRF header check rely on this.
- Run uvicorn with several workers behind a reverse proxy such as nginx or Caddy.

## How scoring works

**Monthly score (0–100).** Each voter rates one colleague 1–5 on every criterion. For each candidate:

```text
score = Σ (average rating on criterion ÷ 5) × criterion weight
```

Example: average ratings of supporting 5.0, timeliness 4.0, interpersonal 4.5 and innovation 3.0 give
`40 + 24 + 13.5 + 9 = 86.5`.

**Minimum evaluations.** A candidate needs at least `min_evaluations` votes (default 3) to rank. This stops one enthusiastic vote from winning.

**Tie-breaks.** Ranking uses these keys in order:

1. Higher score
2. Higher per-criterion averages, compared in weight order: Supporting each other first, then Timeliness, and so on
3. More evaluations

If a tie still remains, HR sees a warning and picks the winner manually.

Annual ties are broken by monthly wins, then average score in nominated months, then number of nominations.

**Publishing.** Voting closes automatically at the deadline. HR reviews the results and publishes a winner with a citation. Choosing someone other than rank 1 requires a written reason, which is audit-logged.

**Annual score.** This is the average monthly score across every published month of the year that the employee was eligible for. A month where they did not qualify counts as 0. This rewards consistent performance over one strong month.

## Rules enforced

- One vote per employee per campaign; no self-votes.
- New hires within the configured probation period, and employees marked ineligible, cannot receive votes.
- Comments are hidden until HR approves them.
- Every admin action is written to the audit log, including weight changes, overrides, vote resets and reopens.
- CSV exports are available per campaign and per year.

## Not included yet

- Email and Microsoft Teams notifications
- PDF or Excel reports (CSV only)
