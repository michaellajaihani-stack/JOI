# J.O.I Academy Portal

## Run with Supabase

The website's `npm start` command runs the Supabase-backed `J.O.I/server.js`.
The SQLite database is only used by the one-time migration script below.

1. In the Supabase SQL Editor, run [`J.O.I/supabase_schema.sql`](./J.O.I/supabase_schema.sql).
2. Copy `J.O.I/.env.example` to `J.O.I/.env` and set `SUPABASE_SERVICE_ROLE_KEY`
   to the project's server-only secret. Never use that secret in browser code
   or commit `.env`.
3. Preview the local-data import with `npm run migrate:sqlite -- --dry-run`.
4. After confirming the listed row counts, import with
   `npm run migrate:sqlite -- --apply`. Run this before creating Supabase
   employee accounts; if an import is interrupted, rerun with `--apply --resume`.
5. From `J.O.I`, run `npm start` and open `http://localhost:3000`.

In Supabase Authentication settings, add the app URL (`http://localhost:3000`)
to the allowed redirect URLs and configure email delivery before relying on
applicant confirmations or staff invitations.

The public schema has RLS enabled and no anonymous policies. All database
operations are performed by the server with its service-role key. Student and
employee sign-in uses Supabase Auth; the matching profile row must have a
Supabase Auth account linked by `authUserId`. Staff profiles also need a unique
`strEmpEmail`.

### First staff account

Create the first staff user in Supabase Authentication, then link it to an
employee profile in the SQL Editor. Replace the sample values with your own:

```sql
INSERT INTO public."tblEmployees"
  ("authUserId", "strEmpCode", "strEmpName", "strEmpEmail",
   "lngEmpPositionID", "strAccess", "strDepartment")
SELECT
  u.id, 'EMP-ADMIN-01', 'Portal Administrator', u.email,
  p."lngEmpPositionID", 'ADMIN', 'IT & Systems Administration'
FROM auth.users AS u
CROSS JOIN public."tblEmpJobPosition" AS p
WHERE lower(u.email) = lower('admin@example.com')
  AND p."strEmpPosition" = 'System Administrator';
```

The migration imports application records but deliberately omits old password
hashes and SQLite backup-file metadata. It does not create Supabase Auth users.
After import, provision Auth users and reset their passwords; student accounts
can link by their email on first sign-in. Employee emails are not present in the
legacy database and must be added before staff can sign in. The local-file
backup endpoint is replaced by Supabase-managed backups in the project
dashboard.