# Utopia — Smart Public Works Transparency & Municipal Operations Platform

**Utopia** is a full-stack CivicTech infrastructure and municipal operations platform designed for Greater Chennai Corporation (GCC). It bridges the gap between public works execution and citizen transparency by pairing a **Google Maps-style citizen discovery canvas** and an **Amazon-style 7-stage delivery pipeline** with a multi-tier **Municipal & Department Operations Portal**, an automated **DigSync Interdepartmental Coordination Engine**, and a mobile **On-Site Field Supervisor Portal**.

## 🚀 Quick Start

Start the complete service locally with Docker Compose. From the repository root, create a private `.env` file with fresh secrets (run once; keep this file out of version control):

```sh
printf 'POSTGRES_PASSWORD=%s\nJWT_SECRET=%s\n' "$(openssl rand -hex 32)" "$(openssl rand -hex 48)" > .env
```

Then build and launch PostgreSQL, the API, and Nginx:

```sh
docker compose -f compose.yml up --build -d
docker compose -f compose.yml ps
```

Compose reads `.env`, passes the database password to PostgreSQL and the API, and passes the JWT secret to the API. The backend contains no built-in database password or signing key; it creates the PostgreSQL connection URL from the injected settings. Compose waits for PostgreSQL health before starting the API, and for API health before starting Nginx. The PostgreSQL data persists in the `pgdata` volume. The database port is bound to localhost for development and tests. Open:
- **🌍 Web Application**: [http://localhost:5174](http://localhost:5174)
- **📡 Backend REST API**: [http://localhost:8001](http://localhost:8001)
- **📚 Interactive API Documentation (Swagger)**: [http://localhost:8001/docs](http://localhost:8001/docs)
- **🩺 Health Check**: [http://localhost:8001/api/health](http://localhost:8001/api/health)

Optional AI responses use a server-side OpenAI-compatible provider. Set `AI_API_KEY` in the private `.env` to enable generated responses; without it, Utopia AI uses database-grounded response templates. Optional provider settings are `AI_MODEL`, `AI_API_BASE_URL`, `AI_TRANSCRIPTION_MODEL`, `AI_REQUEST_TIMEOUT`, and `AI_MAX_TOKENS`. The key is passed only to the API container. Live audio recordings can be transcribed through the configured provider and are sent to that provider for processing; the transcription request is not saved as a separate file. Multimedia evidence is stored in the persistent `media_uploads` volume, separate from the web root. Per-file caps default to 10 MiB for images, 20 MiB for audio, and 50 MiB for video; configure `MEDIA_MAX_IMAGE_BYTES`, `MEDIA_MAX_AUDIO_BYTES`, and `MEDIA_MAX_VIDEO_BYTES` to change them.

Existing deployments create the new `media_attachments` table at API startup through SQLAlchemy metadata. The equivalent repeatable SQL migration is `backend/migrations/0001_media_attachments.sql`; apply it to an existing database manually only if the API startup migration is disabled. The uploads volume must be backed up along with PostgreSQL because issue rows store references to files in that volume.

Compose replaces the old launcher for the full service lifecycle:

```sh
docker compose -f compose.yml up --build       # foreground
docker compose -f compose.yml up --build -d    # background
docker compose -f compose.yml ps               # status
docker compose -f compose.yml logs -f          # follow logs
docker compose -f compose.yml restart          # restart services
docker compose -f compose.yml down             # stop services; keep database data
```

Use `docker compose -f compose.yml down -v` to also delete the PostgreSQL data volume. Set `WEB_PORT`, `API_PORT`, or `DB_PORT` in `.env` to choose different host ports if a port is already occupied. The application is PostgreSQL-only; when running the API outside Compose, set `DATABASE_URL` to a `postgresql+psycopg://` connection string and set `JWT_SECRET` to a generated 48-byte key. The API refuses to start if the JWT key is missing or shorter than 32 characters.

For source development with Vite hot reload and automatic API reload, add these optional settings to `.env`:

```dotenv
FRONTEND_BUILD_TARGET=development
WEB_CONTAINER_PORT=5174
UVICORN_RELOAD=1
```

Then run `docker compose -f compose.yml up --build -d` followed by `docker compose -f compose.yml watch`. Remove those settings and rebuild to return to the production Nginx frontend.

#### PostgreSQL password mismatch after changing `.env`

PostgreSQL applies `POSTGRES_PASSWORD` only when it initializes an empty `pgdata` volume. Editing that value later does not update the password stored in the existing database, so the API can report `password authentication failed for user "civicgrid"`. Keep the original `.env` password for an existing volume. If it is unavailable, leave the volume intact, update the role password from inside the database container to the current `.env` value, then restart the API:

```sh
docker compose -f compose.yml up -d db
docker compose -f compose.yml exec -T db sh -c "psql -U postgres -d postgres -v new_password=\"\$POSTGRES_PASSWORD\" -c \"ALTER ROLE civicgrid WITH PASSWORD :'new_password';\""
docker compose -f compose.yml restart api
```

Do not use `docker compose down -v` as a password fix; it deletes the database volume and its data.

---

## 🧪 Acceptance Testing & API Verification

Backend and deployment tests, including the required PostgreSQL test setup, are documented in [`test/README.md`](test/README.md):

```sh
docker compose -f compose.yml up -d db
export DATABASE_HOST=localhost DATABASE_NAME=civicgrid DATABASE_USER=civicgrid
export DATABASE_PASSWORD='YOUR_POSTGRES_PASSWORD'
uv run --with-requirements test/requirements.txt --with pytest-cov pytest test -q
```

Use a disposable PostgreSQL database for tests. The suite creates and removes a separate schema for each test. For Compose startup, Nginx, and persistent-volume checks, follow `test/README.md`.

---

## 🌟 Comprehensive Feature Catalog

### 1. 🗺️ Public Citizen Discovery Portal (`/` and `/citizen`)
*Zero-login, friction-free civic transparency portal for residents of Chennai.*

- **Full-Bleed Interactive Map Canvas**:
  - Interactive Leaflet map centered on Chennai with custom teardrop pins, animated radar pulses on active sites, and status color badges.
  - Base layer switcher: Toggle between standard Street Map and high-resolution **Esri Satellite Imagery**.
- **Location & Postal Code Search**:
  - **6-Digit PIN Code Search**: Instant search across Indian postal codes (`600005`, `600017`, `600004`, `600023`, `600127`, etc.) with centroid centering.
  - **Dynamic Geocoding Engine**: Offline centroid cache for major Chennai localities with automatic fallback to OpenStreetMap Nominatim for unseeded PIN codes.
  - **GPS Auto-Detection**: With browser permission on HTTPS (or localhost), the app sends device coordinates to the backend for reverse geocoding to a locality and Indian postal code. If GPS is unavailable, residents can enter a PIN manually.
  - Reverse geocoding uses OpenStreetMap's public Nominatim service by default. Device coordinates are sent to that service; results are cached and requests are limited to one per second. Operators can configure `NOMINATIM_BASE_URL` and `NOMINATIM_USER_AGENT`. Follow the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) and retain OpenStreetMap attribution when changing geocoding providers.
  - **Quick Locality Filter Chips**: Instant one-click chips for *Triplicane (600005)*, *Ayanavaram (600023)*, *T. Nagar (600017)*, *Mylapore (600004)*, *Melakottaiyur (600127)*, etc.
- **Categorical & Keyword Filtering**:
  - Filter by category: *All Works*, *Drainage & Stormwater*, *Metro Water*, *Roads & Paving*, *Electricity (TANGEDCO)*, *Telecom Fibre*, *Delayed*, *Road Closures*.
  - Full-text search across project titles, contractor names, road names, and unique work codes.
- **Google Maps-Style Place Sheet**:
  - Smooth pan-to-project animation opening a slide-in inspection sheet with complete technical and civic details.
- **Amazon-Style 7-Stage Delivery Pipeline**:
  - Progress tracker showing the exact lifecycle stage:
    1. *Sanction & DPR Published*
    2. *Tender & Site Mobilisation*
    3. *Utility Shifting & Excavation*
    4. *Core Conduit / Pipe Laying*
    5. *Quality & Compaction Audit*
    6. *Road Surface Restoration & Asphalting*
    7. *Commissioned & Reopened*
  - Visual indicators: completed stages marked with green checkmarks, current active stage highlighted with an animated radar pulse, and overall completion percentage bar.
- **Delay Transparency & Accountability**:
  - Unscheduled delays display an alert badge with the **official reason for lag**, the **approved mitigation plan**, and original vs revised completion targets.
- **Environmental & Hazard Timings**:
  - **Permitted Noise Windows**: Working hours for heavy machinery (e.g. `22:00 – 04:00`, acoustic curtain deployments, decibel restrictions).
  - **Dust Suppression Advisories**: Permitted excavation hours (e.g. `09:00 – 14:00`, water mist cannons active).
  - **Advance Intimation Tracker**: Displays whether neighbourhood residents were given mandatory 48-hour advance notice.
- **Commuter Advisory & Detour Feeds**:
  - Real-time road blockage and lane reduction notices.
  - Official detour routes for motorists and pedestrians.
  - Live dispatch badge intimating **Google Maps Navigation feeds** and **Chennai Traffic Police**.
- **Work Handler & Contractor Directory**:
  - Site Executive Engineer name, phone number, and official government email.
  - Executing contractor agency name and site supervisor phone number.
  - 24/7 GCC Grievance Helpline (1913).
- **Citizen Feedback, Q&A & Grievance Reporting**:
  - **Ask a Question**: Residents can post queries about project timelines and delays; receives official engineer replies.
  - **Report Issue Modal**: Citizens can lodge complaints (excessive dust/noise, open trench hazard, water disruption) generating a trackable reference ID (`CGI-XXXX`).
  - **Automated 3-Day SLA Escalation**: Grievances unresolved after 3 days are automatically escalated to the GCC Super Admin triage board.

---

### 2. 🔐 Unified Role-Based Authentication Gateway (`/login`)
*Role-aware entry point with strict department boundaries and demo quick-login buttons.*

| Role | Login Route | Default User | Employee Badge | Department Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Municipality Admin** | `/municipality/login` | `admin@gcc.gov.in` (`admin123`) | `GCC-ENG-0842` | Greater Chennai Corporation (Citywide All Works) |
| **Metro Water Officer** | `/department/login` | `water@metrowater.tn.gov.in` (`water123`) | `CMW-DIV-0219` | Chennai Metro Water |
| **Chief Roads Engineer** | `/department/login` | `roads@gcc.gov.in` (`roads123`) | `GCC-RD-0155` | GCC Roads & Bridges |
| **Electricity Utility Lead** | `/department/login` | `power@tangedco.gov.in` (`power123`) | `TNEB-ZN-3310` | TANGEDCO |
| **Drainage Engineer** | `/department/login` | `drainage@gcc.gov.in` (`drain123`) | `SWD-ZN-0418` | Stormwater Drainage |
| **On-Site Field Supervisor**| `/onsite/login` | `field.gcc@chennai.gov.in` (`field123`) | `GCC-FIELD-552` | GCC Roads & Bridges (Field Verification) |

---

### 3. 🏛️ Municipality Central Operations Portal (`/admin` & `/municipality/dashboard`)
*Executive command center for citywide public works oversight and interdepartmental governance.*

- **Citywide KPI Dashboard**:
  - Real-time aggregate statistics: Total Capital Works, Active Work Sites, Lagging / Delayed Projects, Total Sanctioned Capital Budget, and Citizen Grievances.
- **DigSync Interdepartmental Coordination Engine**:
  - Geospatial collision algorithm detecting corridor overlaps (< 1.5 km) and overlapping construction windows across different utility agencies.
  - Identifies collision types: *Trenching / Road Resurfacing Collision* (e.g. water pipe excavation scheduled right after fresh road paving) vs *Simultaneous Right-of-Way Excavation*.
  - Calculates overlap duration and proximity in meters.
- **Conflict Ticket Arbitration & Resolution**:
  - Review interdepartmental Conflict Tickets (`CT-XXXX`) raised by departments.
  - Executive arbitration: Municipality selects the winning priority department and records binding rationale.
  - Automated status workflow: Winning project is transitioned to `In progress`; losing department project is transitioned to `Rescheduling Required`.
- **Citywide Works Register & Milestone Manager**:
  - Searchable, filterable directory of all works across all 15 Chennai zones.
  - Project Editor Modal: Update milestone progress (0–100%), advance Amazon stages (1–7), amend delay reasons and mitigation plans, adjust permitted noise/dust hours, and toggle Google Maps navigation broadcasts.
- **Citizen Grievance & SLA Escalation Triage**:
  - Live complaint feed with status filtering (`Submitted`, `Under Review`, `Resolved`, `Answered`).
  - Highlights tickets exceeding 3 days with an **Escalated to Municipality** badge.
  - Official response composer dispatching answers directly to citizen-facing project cards.
- **Hazard Timings & Navigation Feeds**:
  - Overview of all active road closures broadcast to navigation APIs.
- **WhatsApp & SMS Citizen Advisory Dispatcher**:
  - Broadcast official advisory notifications (e.g. water shutdown, road resurfacing detour) to registered citizens in a selected postal PIN code via WhatsApp Business API / SMS gateway simulation.
  - Historical broadcast audit log (`/api/broadcasts/logs`).

---

### 4. 🏢 Department Official Operations Portal (`/department/dashboard`)
*Scoped workspace for departmental nodal officers (Metro Water, Roads, Electricity, Drainage).*

- **Strict Department Data Isolation**:
  - Officers can only view and manage capital works belonging to their authorized department. Cross-department modifications are rejected by the backend (HTTP 403 Forbidden).
- **Sanction New Capital Works (`/department/create-project`)**:
  - Capital work registration form: Title, Category, Pincode, Locality, Address, Budget, Contractor, Start Date, Due Date, Technical Scope, and Funding Program.
  - Auto-generated project code (`CG-2026-XXX`).
  - Department spoofing protection (enforced by user JWT session).
- **Pre-Sanction Collision Detection**:
  - Before sanctioning, the system automatically runs a conflict scan against all other utility departments within 2.0 km or the same PIN code.
  - If a collision is found, the system presents the overlapping project details and provides a one-click flow to **Raise Conflict Ticket (`CT-XXXX`) to Municipality** for executive review.
- **Conflict Rescheduling Workflow**:
  - For projects flagged for rescheduling, officers can submit alternative start and due dates.
  - Backend verifies that the proposed new dates are completely collision-free before confirming the reschedule.
- **Field Submissions Review**:
  - Department officers inspect daily work logs, labor counts, machinery deployment reports, and photo proofs uploaded by on-site field supervisors.
  - One-click approval / review workflow (`/api/onsite/submissions/{id}/status`).
- **Department Grievance Queue**:
  - Filter citizen inquiries specifically routed to the department and dispatch official engineer responses.

---

### 5. 👷 On-Site Field Supervisor Mobile Portal (`/onsite/dashboard`)
*Mobile-optimized field application for on-ground site engineers and supervisors.*

- **"My Projects" Field Selector**: Quick access to active works assigned to the supervisor's department.
- **Multi-Tab Field Reporting Suite**:
  1. **📊 Progress Tab**: Interactive progress percentage slider (0–100%) and 7-stage Amazon milestone step selector. Syncs immediately with the citizen map.
  2. **📷 Photo Proof Tab**: Upload site inspection photographs with descriptive captions and geo-tagging references.
  3. **⚠️ Blocker / Safety Alert Tab**: Report unforeseen worksite hazards, utility strikes, or missing barricades; instantly generates a `BLK-XXXX` priority alert.
  4. **📋 Daily Worksite Log Tab**: Record on-site labor headcount, heavy machinery equipment active (e.g. JCB backhoe, pneumatic compressor), and shift operating hours.
  5. **⏳ Delay Advisory Tab**: Log unforeseen subsurface obstacles (e.g. rock formations, high water table, heritage clearances) to update project delay transparency.
  6. **📜 Audit History Tab**: Chronological audit log of all field submissions with review badges (`Submitted`, `Approved`).

---

## 🔌 Complete Backend REST API Reference

| Method | Endpoint | Description | Role / Auth |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/auth/login` | Authenticate official, verify department, issue JWT token | Public |
| **GET** | `/api/auth/me` | Fetch authenticated officer profile and permissions | Bearer Token |
| **GET** | `/api/projects` | List all projects with PIN, locality, category, search filters | Public |
| **GET** | `/api/projects/{id}` | Detailed project view with timeline events, questions & issues | Public |
| **POST** | `/api/projects` | Sanction and register a new capital public works project | Official / Admin |
| **PATCH**| `/api/projects/{id}` | Update progress %, milestone step, hazard windows, detour broadcast | Official (Own Dept) / Admin |
| **POST** | `/api/projects/{id}/events` | Append an official milestone event to the project timeline | Official / Admin |
| **GET** | `/api/departments` | Distinct list of municipal utility departments | Public |
| **GET** | `/api/localities` | Grouped postal code statistics (total, active, delayed works) | Public |
| **GET** | `/api/stats` | Citywide / PIN-level public works summary statistics | Public |
| **GET** | `/api/issues` | Fetch citizen feedback, questions, and complaints | Public |
| **POST** | `/api/issues` | Submit citizen complaint or project question (`CGI-XXXX` / `Q-XXXX`) | Public |
| **POST** | `/api/issues/{id}/reply` | Dispatch official municipal response to a citizen inquiry | Official / Admin |
| **GET** | `/api/digsync` | Run corridor overlap detection (< 1.5 km) between utilities | Public / Admin |
| **POST** | `/api/projects/check-conflicts`| Check proposed schedule collisions against other departments | Official / Admin |
| **GET** | `/api/conflict-tickets` | List interdepartmental conflict resolution tickets | Official (Scoped) / Admin |
| **POST** | `/api/conflict-tickets` | Raise conflict ticket to Municipality for executive arbitration | Official / Admin |
| **POST** | `/api/conflict-tickets/{id}/resolve` | Municipality decision: approve winning dept, mandate reschedule | Admin Only |
| **POST** | `/api/conflict-tickets/{id}/reschedule` | Reschedule project with collision-free date verification | Official / Admin |
| **GET** | `/api/onsite/my-projects` | List active projects for field supervisor inspection | Onsite / Official / Admin |
| **GET** | `/api/onsite/submissions` | Fetch field inspection submissions and photo proofs | Onsite / Official / Admin |
| **POST** | `/api/onsite/submissions` | Submit on-site progress, photo, blocker, shift log, or delay | Onsite / Official / Admin |
| **PATCH**| `/api/onsite/submissions/{id}/status` | Update field submission status (`Approved`, `Reviewing`) | Official / Admin |
| **GET** | `/api/geocode/pincode` | Resolve 6-digit Indian PIN code to locality and coordinates | Public |
| **GET** | `/api/geocode/reverse` | Resolve GPS/map coordinates to locality and Indian postal code via OpenStreetMap Nominatim | Public |
| **POST** | `/api/whatsapp/broadcast` | Broadcast localized advisory to registered citizens in a PIN code | Official / Admin |
| **GET** | `/api/broadcasts/logs` | Fetch audit logs of dispatched citizen SMS/WhatsApp advisories | Official / Admin |
| **GET** | `/api/health` | Service health status and version check | Public |
| **POST** | `/api/ai/chat` | Database-grounded citizen assistant; accepts message, optional short context and coordinates; returns answer and record sources | Public, rate-limited |
| **POST** | `/api/media/upload` | Stage an image/audio/video upload; multipart fields `file` and `media_type`; returns a one-use upload token | Public, rate-limited |
| **GET** | `/api/media/{id}` | Serve evidence only after it is attached to a public issue | Public attached evidence |

To attach evidence to an existing `POST /api/issues` request, include `attachments: [{"media_id": 123, "upload_token": "..."}]` (maximum five). Upload first, then submit the issue; the issue and attachment association commit in one database transaction. Text-only issue payloads remain supported. Images, audio and video are served through the API, not directly from the upload directory.

---

## 🗄️ Database Models & Entities

- **`Project`**: Core civic works entity containing code, title, category, department, locality, 6-digit PIN, budget, contractor, start/due dates, geographic coordinates (`lat`/`lng`), 7-stage Amazon step (`current_step`), progress %, engineer contacts, contractor supervisor contacts, permitted noise/dust timing windows, Google Maps navigation broadcast toggle, and detour advice.
- **`Event`**: Verified chronological milestone timeline events tied to each project.
- **`Issue`**: Citizen questions, grievances, and safety complaints with reference codes, severity levels, 3-day SLA escalation tracking, advance intimation verification, and official engineer responses.
- **`ConflictTicket`**: Interdepartmental dispute tickets capturing requesting department, conflicting department, proposed dates, reason for proceeding, municipal executive decision, approved department, and rescheduled dates.
- **`FieldSubmission`**: On-site supervisor reports capturing report type (`progress`, `photo`, `blocker`, `shift_log`, `delay`), workforce labor count, machinery deployed, shift hours, attached inspection photo URLs, captions, and approval statuses.
- **`SMSLog`**: Audit record of simulated WhatsApp Business and SMS advisory broadcasts targeted by PIN code.
# Community verification and contractor performance

The existing citizen grievance feed supports anonymous community confirmations and comments. Residents can participate without creating an account; a browser community identity is used to prevent repeat actions from that browser, and authenticated accounts are also protected by database uniqueness constraints. Comments can include evidence uploaded through the existing media endpoint. Department staff review complaints at `/department/contractor-verification`; only an official verification can create a contractor score transaction.

There is no separate public contractor page or contractor login. Municipal administrators manage scores, scoring rules, on-site account links, appeals, and the corroboration threshold at `/admin/contractors`, with interactive citywide charts on the Municipality dashboard. Each on-site official sees their linked contractor score and personal score history in the existing `/onsite/login` dashboard; the Department Officer role remains separate. Existing project contractor names are associated with contractor records during migration/startup. Unawarded placeholder contractor names are excluded.

For an existing PostgreSQL database, apply `backend/migrations/0002_community_and_contractors.sql` using the project's database migration procedure before deploying. The migration is additive, preserves existing project contractor names, and leaves placeholder awards unassigned. Fresh databases also receive the schema through SQLAlchemy table creation. The runtime compatibility helper adds the new legacy columns, but the SQL migration is required to install the foreign keys and perform the historical contractor association.

The default community corroboration threshold is five and can be changed by a municipal administrator. Score rules are seeded once with the configured defaults. Every score change is stored as an immutable transaction; approved appeals add reversal transactions. Completion rewards are triggered when a project transitions to Completed. Officers/admins can record quality inspections and explicit delay evaluations through the contractor performance API. A delay is not penalized automatically; the evaluator must mark it unjustified and provide a reason/reference.

Municipal and on-site staff use the existing JWT authentication. Citizen accounts remain optional for public complaint discussion. Anonymous community activity is rate-limited per browser identity and client address; this in-memory rate limit is process-local. Contractor records migrated from the current demo seed data are illustrative and must not be presented as verified GCC procurement rankings until production project/contractor records are loaded.
