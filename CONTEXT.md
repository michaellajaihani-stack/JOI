# J.O.I Academy Portal - Architectural Context

## 1. Project Overview & Tech Stack

### Purpose

Jewel of Intellect (J.O.I) Academy is a centralized online enrollment system. The application provides:

- Applicant intake with a four-page wizard and digital document metadata.
- Student authentication and a student portal for schedules, course loads, fees, payments, documents, profile data, and inquiries.
- Staff authentication and role-specific dashboards for registrar, finance, faculty, dean, and administrator workflows.
- Admission document review, academic clearance, subject-section management, QR payment verification, promissory-note recording, and grade/INC encoding.
- Supabase-backed PostgreSQL storage and Supabase Auth; the one-time migration utility imports legacy SQLite data.

### Tech Stack

| Area | Technology |
|---|---|
| Language | JavaScript (`.js`), SQL, HTML, CSS |
| Backend runtime | Node.js; no `engines` field is declared in `J.O.I/package.json` |
| Backend server | Built-in `node:http` server, not Express or another framework |
| Frontend | Framework-free browser JavaScript with server-rendered HTML templates |
| Database | Supabase-hosted PostgreSQL |
| Authentication | Supabase Auth via `@supabase/supabase-js` |
| Legacy data source | SQLite through Node.js `node:sqlite` (`DatabaseSync`) |
| Environment loader | `dotenv` |
| Styling | Plain CSS in `J.O.I/public/styles.css`; inline styles are also used heavily |
| Package manifest | `J.O.I/package.json`, version `1.0.0` |
| Major direct dependencies | `@supabase/supabase-js` `^2.119.2`, `dotenv` `^18.0.10` |
| UI libraries | None. No React, Vue, Angular, Tailwind, Bootstrap, or component framework is used |
| Build tooling | None. Files are served directly |
| Test tooling | None. No test script or test files are declared |

The migration script uses `node:sqlite`, whose `DatabaseSync` API requires a sufficiently recent Node.js release. The workspace has been run with Node.js 22.23.5; the repository itself does not pin that version.

### Build & Run Commands

Run commands from the repository root or `J.O.I`, using the exact project scripts.

```bash
# Install dependencies
cd J.O.I
npm install

# Start the application
npm start
# Equivalent: node server.js
```

The application listens on `PORT`, defaulting to `3000`, and the expected local URL is `http://localhost:3000`.

```bash
# SQLite to Supabase migration preview
npm run migrate:sqlite -- --dry-run

# Apply migration
npm run migrate:sqlite -- --apply

# Resume an interrupted apply
npm run migrate:sqlite -- --apply --resume

# Show migration usage
npm run migrate:sqlite -- --help
```

There is no `build`, `dev`, `test`, `lint`, or `format` npm script. There is no production build step: `J.O.I/public/` is served directly.

Database setup is performed by opening `J.O.I/supabase_schema.sql` in the Supabase SQL Editor rather than through an npm migration command.

## 2. Directory & File Structure

```text
JOI/
|-- CONTEXT.md                         # This architectural and onboarding reference
|-- README.md                          # Supabase setup, migration, and first-admin instructions
|-- .gitignore                         # Ignores env, node_modules, SQLite DBs, backups, and reference items
`-- J.O.I/
    |-- package.json                   # Package metadata and start/migration scripts
    |-- package-lock.json              # npm dependency lockfile
    |-- .env.example                  # Required and optional environment-variable template
    |-- .env                          # Local environment values; excluded from version control
    |-- server.js                     # Node HTTP server, Supabase clients, auth, business logic, and API routes
    |-- migrate-sqlite-to-supabase.js # Legacy SQLite read-only import and verification utility
    |-- supabase_schema.sql           # PostgreSQL schema, seed data, RLS setup, functions, triggers, and privileges
    `-- public/
        |-- index.html                # Browser document, fallback course data, input filters, and app script loading
        |-- app.js                    # Entire frontend state, views, API calls, and global controller actions
        |-- styles.css                # All frontend visual styling
        `-- assets/
            |-- campus_bg.png         # Campus landing background
            |-- crest.png             # J.O.I crest
            |-- er_diagram.png        # Database relationship diagram
            |-- image.png             # General project/reference image
            |-- onlinepayment.jpg     # QR/payment reference image
            |-- ref_applicants.jpg    # Applicant UI reference
            |-- ref_landing.jpg       # Landing UI reference
            |-- ref_students.jpg      # Student UI reference
            `-- star.png              # Top-banner star decoration
```

`J.O.I/node_modules/` is present locally but is excluded from repository guidance and `CONTEXT.md` analysis. `J.O.I/joi_academy.db` is not currently present, although the migration script and `.gitignore` expect it. `J.O.I/backups/` is not currently present.

### Important Files

- `J.O.I/server.js`: monolithic HTTP/API implementation. It also contains data assembly and role-filtering functions.
- `J.O.I/public/app.js`: monolithic browser application. The IIFE at the top owns all client state and exports `window.JOIApp`.
- `J.O.I/public/index.html`: loads `styles.css`, sets fallback course records, adds input sanitizers, and loads `app.js?v=3`.
- `J.O.I/supabase_schema.sql`: authoritative PostgreSQL schema. It also inserts job positions, contact types, and initial course records.
- `J.O.I/migrate-sqlite-to-supabase.js`: legacy import utility only. It does not create Supabase Auth users or delete the source SQLite database.
- `README.md`: operational setup instructions.

## 3. Architecture & Data Flow

### Entry Points

#### Backend startup

1. `J.O.I/server.js` loads `.env` with `dotenv`.
2. It reads `PORT`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `SITE_URL`.
3. It throws immediately if the URL or either Supabase key is missing.
4. It creates:
   - `supabase`, the service-role client for privileged server-side operations.
   - `authClient`, the publishable-key client for password sign-in, sign-up, token refresh, and identity lookup.
5. `http.createServer(...)` handles CORS preflight, API routes, static files, and SPA-style index fallback.
6. `server.listen(PORT, ...)` starts the service.

#### Frontend startup

1. `J.O.I/public/index.html` creates `#app-root`, loads `styles.css`, and defines `window.JOI_FALLBACK_COURSES`.
2. `J.O.I/public/app.js` executes an IIFE, initializes `state`, and defines render functions.
3. On `DOMContentLoaded`, `render()` mounts the current view and `loadPublicBootstrap()` calls `/api/public/courses`.
4. The browser controller is exported as `window.JOIApp`.
5. Unknown frontend URLs are not separately routed: navigation is controlled by `state.view`.

### End-to-End Request/Data Flow

#### Static content

`GET /` or a static asset path is resolved against `J.O.I/public/`. `server.js` prevents traversal outside `PUBLIC_DIR`. Existing files are streamed with MIME types. Unknown non-API paths return `public/index.html`, enabling client-side view switching.

#### Applicant submission

1. `window.JOIApp.submitApplicantIntake()` reads the 4-page draft and posts it to `/api/applicant/apply`.
2. `createApplicant()` validates review confirmation, required fields, password length, and username uniqueness.
3. It signs up the applicant with Supabase Auth.
4. It inserts `tblStudentInformation`, `tblLINKStudent_Course`, and pending `tblAdmissionDocuments`.
5. It creates an admission contact/audit record.
6. If profile/document writes fail, it attempts to delete the created profile and Auth user.
7. The response includes the student ID/number and optional session tokens.

#### Student operations

1. Frontend actions call `apiFetch()`, which sends JSON plus `Authorization: Bearer <access_token>` when available.
2. `requireStudent()` verifies the bearer user through Supabase Auth and checks that the Auth account maps to the requested `lngStudentID`.
3. Student routes call Supabase RPC functions or table helpers.
4. Subject enrollment and removal use `joi_enroll_subject` and `joi_drop_subject` SQL functions.
5. `getStudentFullBundle()` aggregates the student, balance, subjects, sections, documents, payments, notes, and contacts.

#### Staff operations

1. Frontend staff actions call authenticated API routes.
2. `requireRole()` verifies the bearer user and resolves the linked `tblEmployees.strAccess`.
3. `/api/staff/overview` calls `getStaffOverview()` and then `overviewForStaffRole()` to remove unauthorized data per role.
4. Registrar, finance, faculty, dean, and admin route handlers update tables and insert contact records.

#### Balance calculation

`recalculateStudentBalance()` calculates current-term tuition from loaded sections, adds the lab fees and miscellaneous fee, subtracts verified payments, and persists `curOutstandingBalance`. The PostgreSQL enrollment/drop functions repeat the same basic assessment calculation atomically.

### State Management & Auth

#### Client state

`public/app.js` keeps a module-local `state` object containing:

- `view`, `authInput`, `currentUser`
- `studentBundle`, `staffOverview`
- `publicCourses`
- `studentTab`, `staffTab`, `masterListSectionFilter`, `erSelectedTable`
- `intakeDraft`

There is no persistent user-session storage in local storage. The access and refresh tokens returned by login are kept only in `state.currentUser` for the current browser session. Applicant intake data is persisted in `localStorage` under `joi_applicant_intake_draft_v1`.

`apiFetch()`:

- Adds JSON headers.
- Adds the current access token as a Bearer token.
- Refreshes the session through `/api/auth/refresh` on HTTP 401 when a refresh token exists.
- Retries the original request with the refreshed access token.
- Throws `data.error` or a generic request error on non-success responses.

#### Server authentication

Supabase Auth is authoritative. `getPrincipal()` validates the Bearer token through `authClient.auth.getUser()`, then searches `tblStudentInformation.authUserId` and `tblEmployees.authUserId`.

Student authorization is enforced by `requireStudent(req, requestedId)`: the principal must be a student and its student ID must match the requested ID.

Staff authorization is enforced by `requireRole(req, roles)`: the principal must be a staff account with one of the allowed `strAccess` values.

Recognized staff roles are `ADMIN`, `REGISTRAR`, `FINANCE`, `FACULTY`, and `DEAN`. The frontend maps them to tabs, but route-level server authorization remains the actual security boundary.

#### Role-specific overview filtering

`overviewForStaffRole()` removes or narrows data for:

- `REGISTRAR`: removes employee/admin, finance, and backup data.
- `DEAN`: sends a minimal student subset and removes documents/payments/notes/contacts.
- `FINANCE`: sends student balance/status fields, payments, and notes while removing sections and documents.
- `FACULTY`: sends only assigned sections and subject-load entries for those sections.
- `ADMIN`: receives the full overview.

RLS is enabled in Supabase but no public/anon policies are created. All normal application database access uses the service-role server client.

## 4. Database Schema & External Integrations

### Database Schema

All application tables are in the PostgreSQL `public` schema. All use `bigint` identity primary keys unless otherwise stated. RLS is enabled for every table and no public/anonymous policies are created. The server service role receives table and sequence privileges in `J.O.I/supabase_schema.sql`.

| Table | Key columns and purpose |
|---|---|
| `tblCourseList` | `lngCourseID`, unique `strCourseCode`, course description, cost, duration, and notes |
| `tblStudentInformation` | Student identity/profile, unique Auth link, username/student number, academic status, INC fields, fees, balance, and JSONB education/family data |
| `tblLINKStudent_Course` | Student-course link; foreign keys to student/course and course-start/completion fields |
| `tblEmpJobPosition` | Job-position IDs and unique position names |
| `tblEmployees` | Employee profile, unique Auth link/email/code, job-position FK, access-role check, department |
| `tblContactType` | Unique contact-category names |
| `tblContacts` | Student/FK contact type, optional employee handler, timestamp, and details |
| `tblSubjectSections` | Course, subject code/title, units, section/schedule/room, faculty FK, prerequisite, capacity, enrolled count, and fees |
| `tblStudentSubjectLoad` | Student/section/term load, status, grade, and encoded timestamp; unique by student/section/term |
| `tblAdmissionDocuments` | Student document metadata, status/remarks, reviewer, upload/review timestamps |
| `tblPayments` | Student payment, unique reference, method, amount, QR payload, receipt, status, verifier, and timestamps |
| `tblPromissoryNotes` | Student note, unique reference, covered amount, terms/due date/status, logger, and timestamp |
| `tblDatabaseBackups` | Legacy backup metadata representation; not a live backup mechanism |
| `tblStudentAssessment` | Student gross assessment, balance, status, logger, and timestamp |

Important relationships:

- `tblStudentInformation.authUserId -> auth.users.id`
- `tblEmployees.authUserId -> auth.users.id`
- `tblLINKStudent_Course.lngStudentID -> tblStudentInformation.lngStudentID`
- `tblLINKStudent_Course.lngCourseID -> tblCourseList.lngCourseID`
- `tblEmployees.lngEmpPositionID -> tblEmpJobPosition.lngEmpPositionID`
- `tblContacts.lngStudentID -> tblStudentInformation.lngStudentID`
- `tblContacts.lngContactTypeID -> tblContactType.lngContactTypeID`
- `tblContacts.lngEmployeeID -> tblEmployees.lngEmpID`
- `tblSubjectSections.lngCourseID -> tblCourseList.lngCourseID`
- `tblSubjectSections.lngFacultyEmpID -> tblEmployees.lngEmpID`
- `tblStudentSubjectLoad.lngStudentID -> tblStudentInformation.lngStudentID`
- `tblStudentSubjectLoad.lngSectionID -> tblSubjectSections.lngSectionID`
- Admission, payment, promissory, backup, assessment, and contact tables reference their related student/employee records with cascade or restrict behavior as shown in `J.O.I/supabase_schema.sql`.

SQL constraints include unique identifiers/emails/course codes, check constraints for binary status fields and section capacity, positive fees/units, and the one-load-per-student-section-term rule.

Indexes cover student-course links, sections, subject loads, document status, payment status, contact date, and promissory-note student lookup.

Schema functions:

- `joi_enroll_subject(p_student_id bigint, p_section_id bigint)`: validates subject duplication, INC prerequisite blocking, 24-unit limit, and section capacity; adds a load and recalculates the balance.
- `joi_drop_subject(p_student_id bigint, p_load_id bigint)`: validates student/load ownership, removes the load, decrements capacity, and recalculates the balance.
- `joi_sync_identity_sequences()`: resets PostgreSQL identity sequences after migration.
- `joi_generate_student_no()`: trigger helper for student numbers.
- `joi_generate_emp_code()`: trigger helper for role-prefixed employee codes.

The schema defines seed rows for job positions, contact types, and eight course records. `J.O.I/public/index.html` also contains a separate fallback course list; it is not the same complete SQL seed list.

### API Endpoints

The server also handles `OPTIONS *` with `204` and `Access-Control-Allow-Methods: GET, POST, OPTIONS`.

| Method | Path | Payload / parameters | Success response |
|---|---|---|---|
| `GET` | `/api/public/courses` | None | `200 { courses: [...] }` |
| `POST` | `/api/auth/login` | JSON `{ mode, identifier, password }` | `200` with access/refresh tokens and student or staff identity fields |
| `POST` | `/api/auth/refresh` | JSON `{ refreshToken }` | `200 { token, refreshToken }` |
| `POST` | `/api/applicant/apply` | 4-page draft `{ personal, education, family, documents, courseId, username, password, confirmedReview }` | `201` with message, student ID/number, optional tokens, and confirmation requirement |
| `GET` | `/api/student/dashboard/:studentId` | URL student ID; Bearer auth | `200` student bundle containing student, assessment, enrolled subjects, sections, documents, payments, notes, and contacts |
| `POST` | `/api/student/enroll-subject` | `{ studentId, sectionId }` | `200 { message, bundle }` |
| `POST` | `/api/student/drop-subject` | `{ studentId, loadId }` | `200 { message, bundle }` |
| `POST` | `/api/student/upload-document` | `{ studentId, docType, fileName, fileSize }` | `201 { message, bundle }`; stores metadata only |
| `POST` | `/api/student/submit-qr-payment` | `{ studentId, amount, paymentMethod, receiptFileName, referenceNo }` | `201 { message, bundle }` |
| `POST` | `/api/student/inquiry` | `{ studentId, category, message }` | `201 { message, bundle }` |
| `GET` | `/api/staff/overview` | Bearer auth; role resolved server-side | `200` role-filtered staff overview |
| `POST` | `/api/registrar/review-document` | `{ docId, status, remarks }` | `200 { message }` |
| `POST` | `/api/registrar/dean-approval` | `{ studentId, releasePreReg, enrollmentStatus }` | `200 { message }` |
| `POST` | `/api/registrar/section` | Existing section: `{ sectionId, maxCapacity, schedule, room, prerequisiteCode }`; new section: `{ courseId, subjectCode, subjectTitle, units, sectionName, schedule, room, facultyEmpId, prerequisiteCode, maxCapacity, perUnitFee, labFee }` | `200` update or `201` create `{ message }` |
| `POST` | `/api/finance/verify-payment` | `{ paymentId, status, remarks }` | `200 { message }` |
| `POST` | `/api/finance/promissory-note` | `{ studentId, coveredAmount, agreementTerms, deferredDueDate }` | `201 { message }` |
| `POST` | `/api/faculty/encode-grade` | `{ loadId, grade }` | `200 { message }` |
| `POST` | `/api/admin/employee` | Update: `{ empId, empName, email, positionId, accessRole, department }`; invite: `{ empName, email, positionId, accessRole, empCode?, department? }` | `200` update or `201` invite `{ message }` |
| `POST` | `/api/admin/backup` | Bearer auth only | `501` because local backup is replaced by Supabase-managed backups |

All JSON API errors use `sendJson(res, status, { error: message })`. Status defaults to `500` for non-`HttpError` exceptions.

### External Services

- **Supabase PostgreSQL:** configured in `J.O.I/server.js` and `J.O.I/migrate-sqlite-to-supabase.js` by `SUPABASE_URL` and the service/publishable keys.
- **Supabase Auth:** used for sign-in, sign-up, bearer identity lookup, token refresh, employee invitations, and account cleanup.
- **Supabase Admin API:** used for employee invitations and deletion cleanup.
- **No external payment SDK/payment gateway is implemented.** QR payment strings and receipt metadata are generated/stored locally in Supabase; `J.O.I/public/app.js` has a deterministic visual QR SVG generator only.
- **No email provider SDK is implemented.** Applicant confirmation and staff invitation depend on Supabase Auth email configuration. Registrar "email notification" text is represented by a contact record and response message rather than a live email send.
- **No Supabase Storage integration is implemented.** Uploaded documents and payment receipts remain file-name metadata.

## 5. Environment & Configuration

### Environment Variables

Source: `J.O.I/.env.example` and direct `process.env` uses.

| Variable | Required | Used for |
|---|---:|---|
| `SUPABASE_URL` | Yes | Both Supabase clients and migration utility |
| `SUPABASE_PUBLISHABLE_KEY` | Yes for server startup | Browser-like/publishable Auth operations (`authClient`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for server startup and migration apply | Privileged table operations and Supabase Admin/Auth operations |
| `PORT` | No | HTTP listen port; default `3000` |
| `SITE_URL` | No | Applicant Auth redirect URL; default `http://localhost:<PORT>` |

Do not document or commit actual secret values. The `.env.example` intentionally uses a placeholder for `SUPABASE_SERVICE_ROLE_KEY`; the local `.env` is excluded from Git by `J.O.I/.gitignore`.

### Setup Notes

1. Copy `J.O.I/.env.example` to `J.O.I/.env`.
2. Set the real Supabase URL and keys.
3. Run `J.O.I/supabase_schema.sql` in the target Supabase project.
4. Configure `http://localhost:3000` as an allowed redirect URL in Supabase Auth.
5. Configure Supabase email delivery if confirmations/invitations are required.
6. Create and link the first staff user by matching `auth.users.id` to `tblEmployees.authUserId`.

### Configuration Files

- `J.O.I/package.json`: only package metadata and scripts; no framework configuration.
- `J.O.I/package-lock.json`: npm dependency resolution.
- `J.O.I/.env.example`: environment template.
- `.gitignore`: ignores `.env`, `node_modules`, `J.O.I/*.db*`, `J.O.I/backups/`, and reference-index items.
- `J.O.I/public/index.html`: cache-busting script load is `app.js?v=3`.
- Static server MIME types cover HTML, CSS, JavaScript, JSON, PNG, JPEG, SVG, and ICO.

No linter, formatter, bundler, transpiler, Dockerfile, CI workflow, deployment manifest, or test configuration is present.

## 6. Coding Conventions & Patterns

### Server

- `J.O.I/server.js` is intentionally monolithic and uses section comments rather than separate controllers/services/modules.
- Supabase access is centralized through `query()`, `rows()`, `one()`, `insertOne()`, and `updateOne()`.
- HTTP routes are a sequential `if` chain in the server callback.
- JSON bodies are read through `parseBody()`, which limits payload size to 5 MB and converts JSON parse failures to HTTP 400.
- Application errors use `HttpError(status, message)`.
- The catch-all server handler converts `HttpError` status values and defaults unexpected exceptions to 500.
- Supabase and cleanup failures are logged with `console.error`.
- Service-role operations use the server-created `supabase` client.
- Bearer-auth operations use `authClient.auth.getUser()`.
- The route handlers perform both authorization and workflow changes directly.
- PostgreSQL identifiers in Supabase queries use the exact mixed-case table names declared in SQL, for example `tblStudentInformation`.

### Frontend

- `J.O.I/public/app.js` uses one IIFE and one `state` object rather than modules or a framework store.
- Rendered views are functions that return HTML strings.
- `render()` replaces `#app-root.innerHTML`.
- UI actions are exported through `window.JOIApp`.
- Dynamic HTML is constructed with template literals and database values are escaped through `escapeHtml()`.
- Inline `onclick`, `onchange`, and `oninput` handlers are used.
- API calls use `fetch()` and the shared `apiFetch()` wrapper.
- Local draft state uses deep merged defaults and `localStorage`.
- Toast feedback is handled by `showToast()`.
- PHP currency formatting uses `toLocaleString('en-PH', ...)`.
- No frontend framework lifecycle or component system is used.
- CSS is shared through `J.O.I/public/styles.css`, with additional inline styles in rendered templates.

### Data & Naming

- Database/table names use legacy Hungarian-style names such as `lngStudentID`, `strStudentNo`, `curOutstandingBalance`, `ysnHasINC`, and `dteContactDate`.
- Supabase table names use the legacy `tbl...` convention.
- API field names frequently mirror database column names.
- Dates come from ISO/date strings or PostgreSQL timestamptz values and are not normalized through a shared date library.

## 7. Current State, Known Issues & Technical Debt

### Confirmed incompleteness

- No test suite or test npm script exists.
- No build or lint configuration exists.
- `J.O.I/joi_academy.db` is referenced but is not present in the workspace, so the migration command cannot run until that exact SQLite file is created or restored.
- The migration script strips employee email and all Auth IDs, so employee accounts must be manually invited and linked.
- The migration script also strips student password hashes/Auth IDs and does not create Auth users.
- Applicant, employee, and student Auth profiles require manually prepared Supabase Auth state and email configuration.
- The `/api/admin/backup` route always returns `501`; backup data in `tblDatabaseBackups` is not live backup management.

### Hardcoded or environment-sensitive values

- `J.O.I/server.js` defaults `PORT` to `3000` and `SITE_URL` to `http://localhost:${PORT}`.
- Student semester text is hardcoded as `1st Semester AY 2026-2027`.
- Default enrollment balance is `29050` in multiple paths.
- Miscellaneous fee defaults to `6850`.
- Tuition is currently modeled as `1850` per credit unit in balance and UI calculations.
- The frontend and database contain 2026-oriented student numbers and due-date defaults.
- The applicant draft has fixed sample address and education/family defaults.
- The frontend fallback course list in `index.html` differs from the complete course list seeded in SQL.
- Staff action bodies contain unused `empId` fields; server authorization derives the employee from the Bearer token instead.

### Data and integration limitations

- Document uploads store only names/type/size metadata. Supabase Storage is not used.
- QR payment receipts store file-name metadata only; no actual receipt upload or payment gateway verification occurs.
- Registrar and finance routes record notification/contact entries, but do not send live email.
- Email confirmation behavior depends on Supabase Auth configuration and session/identity response shape.
- The staff overview server assembles large complete data sets before role filtering. Filtering occurs after retrieval, not as database-level authorization.
- RLS has no user-facing policies, so direct browser access to Supabase tables would not work by design; all operations rely on the service-role server.

### Validation and bug risks

- `J.O.I/public/app.js` contains a malformed-looking default applicant type string in `applicantType: 'New Applicant eshman)'` near the top of `defaultDraft`. It should be compared against the current intake UI before changing, because the surrounding file may have recent manual undo/edit history.
- The intake UI shows a password minimum of 6 characters in `J.O.I/public/app.js`, while `createApplicant()` rejects passwords shorter than 8 characters.
- `loadPublicBootstrap()` logs course-fetch failures but does not provide a fallback to `window.JOI_FALLBACK_COURSES` even though fallback course data exists in `index.html`.
- There is no centralized fetch timeout or retry strategy.
- A few route handlers update a profile before creating associated contact/assessment records and have partial-failure windows.
- `createApplicant()` creates the Supabase Auth account first and attempts cleanup if profile setup fails, but cleanup is not transactional across Auth and PostgreSQL.
- The server's catch-all returns 500 for unexpected exceptions rather than a broad custom 502/503 classification.
- Static HTML fallback is returned for any unknown non-API path, including asset-like unknown paths.
- The server does not set `Cache-Control` for static assets or HTML.
- The public course bootstrap fails startup-side gracefully on the frontend but backend startup itself throws for missing/placeholder Supabase keys.
- The deterministic QR generator in `generateQRCodeSVG()` creates a visual pattern, not an encoded standards-compliant QR payload.
- No actual CORS origin allowlist is configured: preflight allows the methods/headers but static/API use is same-origin by default.
- Several frontend actions rely on DOM element IDs and do not validate missing elements before `.value` access.

### UI and maintainability debt

- The frontend and backend are both monolithic.
- Rendered HTML uses many inline styles and inline event handlers.
- Requirement labels, status text, and academic rules are repeated across UI, server, and SQL.
- The UI cache-busting script query is fixed at `app.js?v=3`.
- No shared API schema/types package or generated Supabase types are present.
- The mixed legacy field naming makes it easy to confuse database columns and enriched view fields.
- The repository has no automated verification for SQL schema drift, route coverage, or frontend rendering.
