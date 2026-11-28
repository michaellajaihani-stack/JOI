require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in J.O.I/.env before running seed-staff-samples.js.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const SAMPLE_STAFF = [
  {
    strAccess: 'ADMIN',
    strEmpCode: 'ADM-2026-001',
    strEmpName: 'System Administrator',
    strEmpEmail: 'admin@joiacademy.edu.ph',
    password: 'JoiAdmin@2026!',
    strDepartment: 'IT & Systems Administration',
    positionName: 'System Administrator'
  },
  {
    strAccess: 'REGISTRAR',
    strEmpCode: 'REG-2026-001',
    strEmpName: 'Maria Clara Santos',
    strEmpEmail: 'registrar@joiacademy.edu.ph',
    password: 'JoiRegistrar@2026!',
    strDepartment: 'Office of the University Registrar',
    positionName: 'University Registrar'
  },
  {
    strAccess: 'FINANCE',
    strEmpCode: 'FIN-2026-001',
    strEmpName: 'Rafael Mendoza',
    strEmpEmail: 'finance@joiacademy.edu.ph',
    password: 'JoiFinance@2026!',
    strDepartment: 'Student Accounts & Treasury',
    positionName: 'Finance & Accounting Officer'
  },
  {
    strAccess: 'FACULTY',
    strEmpCode: 'FAC-2026-001',
    strEmpName: 'Prof. Gabriel Reyes',
    strEmpEmail: 'faculty@joiacademy.edu.ph',
    password: 'JoiFaculty@2026!',
    strDepartment: 'College of Computing & Information Sciences',
    positionName: 'College Professor / Faculty'
  }
];

async function ensurePositions() {
  const defaults = [
    'System Administrator',
    'University Registrar',
    'Finance & Accounting Officer',
    'College Professor / Faculty'
  ];
  const { data: existing, error } = await supabase.from('tblEmpJobPosition').select('*');
  if (error) throw error;

  const byName = new Map(existing.map((p) => [p.strEmpPosition, p.lngEmpPositionID]));
  for (const name of defaults) {
    if (!byName.has(name)) {
      const { data: inserted, error: insErr } = await supabase
        .from('tblEmpJobPosition')
        .insert({ strEmpPosition: name })
        .select('*')
        .single();
      if (insErr) throw insErr;
      byName.set(name, inserted.lngEmpPositionID);
    }
  }
  return byName;
}

async function listAllAuthUsers() {
  const users = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...(data.users || []));
    if (!data.users || data.users.length < 200) break;
    page += 1;
  }
  return users;
}

async function ensureAuthUser(staff, existingUsers) {
  const emailLower = staff.strEmpEmail.toLowerCase();
  const existing = existingUsers.find((u) => String(u.email || '').toLowerCase() === emailLower);
  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: staff.password,
      email_confirm: true,
      user_metadata: { full_name: staff.strEmpName, role: staff.strAccess }
    });
    if (error) throw error;
    return data.user.id;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email: staff.strEmpEmail,
    password: staff.password,
    email_confirm: true,
    user_metadata: { full_name: staff.strEmpName, role: staff.strAccess }
  });
  if (error || !data.user) throw error || new Error(`Failed to create auth user for ${staff.strEmpEmail}`);
  return data.user.id;
}

async function upsertEmployee(staff, authUserId, positionId) {
  const { data: existing, error: findErr } = await supabase
    .from('tblEmployees')
    .select('*')
    .or(`strEmpCode.eq.${staff.strEmpCode},strEmpEmail.eq.${staff.strEmpEmail}`)
    .maybeSingle();
  if (findErr) throw findErr;

  const baseRecord = {
    authUserId,
    strEmpCode: staff.strEmpCode,
    strEmpName: staff.strEmpName,
    strEmpEmail: staff.strEmpEmail,
    lngEmpPositionID: positionId,
    strAccess: staff.strAccess,
    strDepartment: staff.strDepartment,
    ysnActive: 1
  };

  const writeOp = async (payload) => {
    if (existing) {
      return supabase
        .from('tblEmployees')
        .update(payload)
        .eq('lngEmpID', existing.lngEmpID)
        .select('*')
        .single();
    }
    return supabase
      .from('tblEmployees')
      .insert(payload)
      .select('*')
      .single();
  };

  let { data, error } = await writeOp(baseRecord);
  if (error && String(error.message || '').includes('ysnActive')) {
    const { ysnActive, ...withoutActive } = baseRecord;
    ({ data, error } = await writeOp(withoutActive));
  }
  if (error) throw error;
  return data;
}

async function ensureFacultySections(facultyEmpId) {
  const { data: existingSections, error: secErr } = await supabase
    .from('tblSubjectSections')
    .select('*')
    .eq('lngFacultyEmpID', facultyEmpId);
  if (secErr) throw secErr;
  if (existingSections && existingSections.length >= 2) {
    return existingSections;
  }

  const { data: courses, error: courseErr } = await supabase
    .from('tblCourseList')
    .select('lngCourseID,strCourseCode')
    .order('lngCourseID', { ascending: true });
  if (courseErr) throw courseErr;

  let courseId = courses?.[0]?.lngCourseID;
  if (!courseId) {
    const { data: createdCourse, error: cErr } = await supabase
      .from('tblCourseList')
      .insert({
        strCourseCode: 'BSCS',
        strCourseDescription: 'Bachelor of Science in Computer Science',
        curCourseCost: 42000.0,
        intCourseDurationYears: 4
      })
      .select('lngCourseID')
      .single();
    if (cErr) throw cErr;
    courseId = createdCourse.lngCourseID;
  }

  const sampleSections = [
    {
      lngCourseID: courseId,
      strSubjectCode: 'CS 301',
      strSubjectTitle: 'Algorithms & Complexity',
      intUnits: 3,
      strSectionName: 'BSCS 3-1',
      strSchedule: 'MWF 09:00 AM - 10:00 AM',
      strRoom: 'Salcedo Hall 302',
      lngFacultyEmpID: facultyEmpId,
      strPrerequisiteCode: 'NONE',
      intMaxCapacity: 35,
      intEnrolledCount: 0,
      curPerUnitFee: 1850,
      curLabFee: 0
    },
    {
      lngCourseID: courseId,
      strSubjectCode: 'CS 302',
      strSubjectTitle: 'Database Management Systems',
      intUnits: 3,
      strSectionName: 'BSCS 3-1',
      strSchedule: 'TTH 01:00 PM - 02:30 PM',
      strRoom: 'CompLab 204',
      lngFacultyEmpID: facultyEmpId,
      strPrerequisiteCode: 'NONE',
      intMaxCapacity: 35,
      intEnrolledCount: 0,
      curPerUnitFee: 1850,
      curLabFee: 1200
    },
    {
      lngCourseID: courseId,
      strSubjectCode: 'CS 305',
      strSubjectTitle: 'Software Engineering I',
      intUnits: 3,
      strSectionName: 'BSCS 3-2',
      strSchedule: 'MWF 01:00 PM - 02:00 PM',
      strRoom: 'Salcedo Hall 305',
      lngFacultyEmpID: facultyEmpId,
      strPrerequisiteCode: 'NONE',
      intMaxCapacity: 35,
      intEnrolledCount: 0,
      curPerUnitFee: 1850,
      curLabFee: 0
    }
  ];

  const inserted = [];
  for (const sec of sampleSections) {
    const already = (existingSections || []).find(
      (s) => s.strSubjectCode === sec.strSubjectCode && s.strSectionName === sec.strSectionName
    );
    if (already) {
      inserted.push(already);
      continue;
    }
    const { data, error } = await supabase
      .from('tblSubjectSections')
      .insert(sec)
      .select('*')
      .single();
    if (error) throw error;
    inserted.push(data);
  }
  return inserted;
}

async function main() {
  console.log('Seeding J.O.I Academy sample staff accounts...');
  const positionByName = await ensurePositions();
  const existingUsers = await listAllAuthUsers();

  let facultyEmpId = null;
  for (const staff of SAMPLE_STAFF) {
    const authUserId = await ensureAuthUser(staff, existingUsers);
    const positionId = positionByName.get(staff.positionName);
    const employee = await upsertEmployee(staff, authUserId, positionId);
    if (staff.strAccess === 'FACULTY') {
      facultyEmpId = employee.lngEmpID;
    }
    console.log(`  [OK] ${staff.strAccess} -> ${staff.strEmpCode} (${staff.strEmpEmail}) | lngEmpID=${employee.lngEmpID}`);
  }

  if (facultyEmpId) {
    const sections = await ensureFacultySections(facultyEmpId);
    console.log(`  [OK] Faculty sections assigned to lngEmpID=${facultyEmpId}: ${sections.length} section(s).`);
  }

  console.log('Staff sample seeding complete.');
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
