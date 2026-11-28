require('dotenv').config();

const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createClient } = require('@supabase/supabase-js');

const DB_PATH = path.join(__dirname, 'joi_academy.db');
const BATCH_SIZE = 250;
const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const resume = args.has('--resume');

const TABLES = [
  { table: 'tblCourseList', id: 'lngCourseID', kind: 'seed', key: 'strCourseCode' },
  { table: 'tblEmpJobPosition', id: 'lngEmpPositionID', kind: 'seed', key: 'strEmpPosition' },
  { table: 'tblContactType', id: 'lngContactTypeID', kind: 'seed', key: 'strContactType' },
  { table: 'tblEmployees', id: 'lngEmpID', strip: ['strEmpPassword'] },
  { table: 'tblStudentInformation', id: 'lngStudentID', strip: ['strPasswordHash'] },
  { table: 'tblLINKStudent_Course', id: 'lngLinkID' },
  { table: 'tblSubjectSections', id: 'lngSectionID' },
  { table: 'tblStudentSubjectLoad', id: 'lngLoadID' },
  { table: 'tblAdmissionDocuments', id: 'lngDocID' },
  { table: 'tblPayments', id: 'lngPaymentID' },
  { table: 'tblPromissoryNotes', id: 'lngNoteID' },
  { table: 'tblContacts', id: 'lngContactID' },
  { table: 'tblStudentAssessment', id: 'lngAssessmentID' }
];

function sourceRows(db, table, idColumn) {
  return db.prepare(`SELECT * FROM "${table}" ORDER BY "${idColumn}"`).all();
}

function transformRow(table, source) {
  const record = { ...source };
  for (const field of table.strip || []) delete record[field];

  if (table.table === 'tblEmployees') {
    delete record.authUserId;
    delete record.strEmpEmail;
  }
  if (table.table === 'tblStudentInformation') {
    delete record.authUserId;
    const educational = record.jsonEducationalBg;
    const family = record.jsonFamilyInfo;
    record.jsonEducationalBg = educational ? JSON.parse(educational) : {};
    record.jsonFamilyInfo = family ? JSON.parse(family) : {};
    if (!record.dteINCIncurred) record.dteINCIncurred = null;
  }

  return record;
}

async function query(builder) {
  const { data, error } = await builder;
  if (error) throw error;
  return data;
}

async function remoteRows(client, table, idColumn) {
  const result = [];
  for (let from = 0; ; from += 1000) {
    const page = await query(
      client.from(table).select('*').order(idColumn).range(from, from + 999)
    );
    result.push(...page);
    if (page.length < 1000) return result;
  }
}

function validateSeedRows(table, localRows, remoteRows) {
  const localById = new Map(localRows.map((row) => [String(row[table.id]), row]));
  for (const remote of remoteRows) {
    const local = localById.get(String(remote[table.id]));
    if (!local || String(local[table.key]) !== String(remote[table.key])) {
      throw new Error(
        `Supabase ${table.table} contains a conflicting seeded row. Resolve it before importing.`
      );
    }
  }
}

async function verifyTarget(client, sourceData, resumeRun) {
  const targetData = new Map();
  for (const table of TABLES) {
    const existing = await remoteRows(client, table.table, table.id);
    if (table.kind === 'seed') {
      validateSeedRows(table, sourceData.get(table.table), existing);
    } else if (existing.length && !resumeRun) {
      throw new Error(
        `Supabase ${table.table} is not empty. Run this migration before creating Supabase records, or use --resume only after a previous import attempt.`
      );
    }
    targetData.set(table.table, existing);
  }
  return targetData;
}

async function importRows(client, table, records) {
  for (let start = 0; start < records.length; start += BATCH_SIZE) {
    const batch = records.slice(start, start + BATCH_SIZE);
    const { error } = await client
      .from(table.table)
      .upsert(batch, { onConflict: table.id });
    if (error) {
      throw new Error(`Import failed for ${table.table}: ${error.message}`);
    }
  }
}

async function verifyCounts(client, sourceData, targetBefore) {
  for (const table of TABLES) {
    const expected = table.kind === 'seed'
      ? sourceData.get(table.table).length
      : sourceData.get(table.table).length;
    const { count, error } = await client
      .from(table.table)
      .select(table.id, { count: 'exact', head: true });
    if (error) throw error;
    if (count !== expected) {
      const before = targetBefore.get(table.table).length;
      throw new Error(
        `Count check failed for ${table.table}: expected ${expected} rows, found ${count} (before import: ${before}).`
      );
    }
  }
}

async function main() {
  if (resume && !apply) throw new Error('Use --resume together with --apply.');
  if (args.has('--help')) {
    console.log('Usage: node migrate-sqlite-to-supabase.js [--dry-run | --apply [--resume]]');
    return;
  }

  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  try {
    const sourceData = new Map(
      TABLES.map((table) => [
        table.table,
        sourceRows(db, table.table, table.id).map((row) => transformRow(table, row))
      ])
    );

    console.log(`Source: ${DB_PATH}`);
    console.log('SQLite password hashes are excluded. Supabase Auth users are not created by this import.');
    console.log('Local SQLite backup-file metadata is not imported.');
    for (const table of TABLES) {
      console.log(`${table.table}: ${sourceData.get(table.table).length} rows`);
    }
    console.log(`tblDatabaseBackups: ${sourceRows(db, 'tblDatabaseBackups', 'lngBackupID').length} rows skipped (SQLite-only backup metadata)`);

    if (!apply) {
      console.log('Dry run only. Add --apply to import these rows.');
      return;
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env before importing.');
    }
    const client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const targetBefore = await verifyTarget(client, sourceData, resume);
    for (const table of TABLES) {
      await importRows(client, table, sourceData.get(table.table));
    }

    const { error: sequenceError } = await client.rpc('joi_sync_identity_sequences');
    if (sequenceError) {
      throw new Error(`Rows imported, but identity sequence sync failed: ${sequenceError.message}`);
    }
    await verifyCounts(client, sourceData, targetBefore);

    console.log('Import and row-count verification completed.');
    console.log('Set up Supabase Auth accounts and link them to the imported student/employee profiles before enabling sign-in.');
    console.log('The local SQLite database has not been deleted.');
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
