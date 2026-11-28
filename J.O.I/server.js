require('dotenv').config();

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.SITE_URL || `http://localhost:${PORT}`;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SERVICE_ROLE_KEY in .env before starting the Supabase backend.'
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const authClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > 5 * 1024 * 1024) {
        reject(new HttpError(413, 'Request payload is too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new HttpError(400, 'Invalid JSON payload.'));
      }
    });
    req.on('error', reject);
  });
}

async function query(builder) {
  const { data, error } = await builder;
  if (error) throw error;
  return data;
}

async function rows(table, orderColumn) {
  const pageSize = 1000;
  const result = [];
  for (let from = 0; ; from += pageSize) {
    let request = supabase.from(table).select('*');
    if (orderColumn) request = request.order(orderColumn, { ascending: true });
    const page = await query(request.range(from, from + pageSize - 1));
    result.push(...page);
    if (page.length < pageSize) return result;
  }
}

async function one(table, idColumn, id) {
  return query(
    supabase.from(table).select('*').eq(idColumn, id).maybeSingle()
  );
}

async function insertOne(table, record) {
  return query(supabase.from(table).insert(record).select('*').single());
}

async function updateOne(table, idColumn, id, patch) {
  return query(
    supabase.from(table).update(patch).eq(idColumn, id).select('*').maybeSingle()
  );
}

function cleanStudent(student) {
  if (!student) return student;
  const { authUserId, ...safeStudent } = student;
  return safeStudent;
}

function cleanEmployee(employee) {
  if (!employee) return employee;
  const { authUserId, ...safeEmployee } = employee;
  return safeEmployee;
}

function indexBy(records, key) {
  return new Map(records.map((record) => [String(record[key]), record]));
}

async function contactTypeId(name) {
  const type = query(
    supabase.from('tblContactType')
      .select('lngContactTypeID')
      .eq('strContactType', name)
      .single()
  );
  return (await type).lngContactTypeID;
}

async function addContact(studentId, typeName, details, employeeId = null) {
  const typeId = await contactTypeId(typeName);
  return insertOne('tblContacts', {
    lngStudentID: studentId,
    lngContactTypeID: typeId,
    lngEmployeeID: employeeId,
    memContactDetails: details
  });
}

async function recalculateStudentBalance(studentId) {
  const student = await one('tblStudentInformation', 'lngStudentID', studentId);
  if (!student) return null;

  const [loads, sections, payments] = await Promise.all([
    query(supabase.from('tblStudentSubjectLoad').select('*').eq('lngStudentID', studentId)),
    rows('tblSubjectSections', 'lngSectionID'),
    query(supabase.from('tblPayments').select('curAmount').eq('lngStudentID', studentId).eq('strStatus', 'Paid / Verified'))
  ]);
  const sectionById = indexBy(sections, 'lngSectionID');
  const currentLoads = loads.filter((load) => load.strTerm === student.strSemester);
  let tuitionTotal = 0;
  let labTotal = 0;
  for (const load of currentLoads) {
    const section = sectionById.get(String(load.lngSectionID));
    if (!section) continue;
    tuitionTotal += Number(section.intUnits) * Number(section.curPerUnitFee);
    labTotal += Number(section.curLabFee);
  }

  const miscFee = Number(student.curMiscFee) || 6850;
  const grossAssessment = currentLoads.length > 0
    ? tuitionTotal + labTotal + miscFee
    : 29050;
  const verifiedPayments = payments.reduce((total, payment) => total + Number(payment.curAmount), 0);
  const balance = Math.max(0, grossAssessment - verifiedPayments);

  await updateOne('tblStudentInformation', 'lngStudentID', studentId, {
    curOutstandingBalance: balance,
    dtmLastChanged: new Date().toISOString()
  });

  return { tuitionTotal, labTotal, miscFee, grossAssessment, verifiedPayments, balance };
}

async function enrichSections(sections, employees, courses) {
  const employeeById = indexBy(employees, 'lngEmpID');
  const courseById = indexBy(courses, 'lngCourseID');
  return sections.map((section) => ({
    ...section,
    strProfessorName: employeeById.get(String(section.lngFacultyEmpID))?.strEmpName || null,
    strCourseCode: courseById.get(String(section.lngCourseID))?.strCourseCode || null
  }));
}

async function getStudentFullBundle(studentId) {
  const student = await one('tblStudentInformation', 'lngStudentID', studentId);
  if (!student) return null;

  const [
    assessment,
    links,
    courses,
    loads,
    sections,
    employees,
    documents,
    payments,
    notes,
    contacts,
    contactTypes
  ] = await Promise.all([
    recalculateStudentBalance(studentId),
    query(supabase.from('tblLINKStudent_Course').select('*').eq('lngStudentID', studentId)),
    rows('tblCourseList', 'lngCourseID'),
    query(supabase.from('tblStudentSubjectLoad').select('*').eq('lngStudentID', studentId).order('lngLoadID')),
    rows('tblSubjectSections', 'lngSectionID'),
    rows('tblEmployees', 'lngEmpID'),
    query(supabase.from('tblAdmissionDocuments').select('*').eq('lngStudentID', studentId).order('lngDocID', { ascending: false })),
    query(supabase.from('tblPayments').select('*').eq('lngStudentID', studentId).order('lngPaymentID', { ascending: false })),
    query(supabase.from('tblPromissoryNotes').select('*').eq('lngStudentID', studentId).order('lngNoteID', { ascending: false })),
    query(supabase.from('tblContacts').select('*').eq('lngStudentID', studentId).order('lngContactID', { ascending: false })),
    rows('tblContactType', 'lngContactTypeID')
  ]);

  const employeeById = indexBy(employees, 'lngEmpID');
  const courseById = indexBy(courses, 'lngCourseID');
  const sectionById = indexBy(sections, 'lngSectionID');
  const typeById = indexBy(contactTypes, 'lngContactTypeID');
  const linkedCourse = links[0] || null;
  const course = linkedCourse ? courseById.get(String(linkedCourse.lngCourseID)) : null;

  return {
    student: {
      ...cleanStudent(student),
      lngCourseID: linkedCourse?.lngCourseID ?? null,
      dteCourseStartDate: linkedCourse?.dteCourseStartDate ?? null,
      ysnCourseComplete: linkedCourse?.ysnCourseComplete ?? null,
      strCourseCode: course?.strCourseCode ?? null,
      strCourseDescription: course?.strCourseDescription ?? null,
      curCourseCost: course?.curCourseCost ?? null,
      intCourseDurationYears: course?.intCourseDurationYears ?? null
    },
    assessment,
    enrolledSubjects: loads.map((load) => {
      const section = sectionById.get(String(load.lngSectionID)) || {};
      return {
        ...load,
        ...section,
        lngLoadID: load.lngLoadID,
        lngSectionID: load.lngSectionID,
        strTerm: load.strTerm,
        strStatus: load.strStatus,
        strGrade: load.strGrade,
        dteEncoded: load.dteEncoded,
        strProfessorName: employeeById.get(String(section.lngFacultyEmpID))?.strEmpName || null
      };
    }),
    allSections: await enrichSections(sections, employees, courses),
    documents: documents.map((document) => ({
      ...document,
      strReviewerName: employeeById.get(String(document.lngReviewedByEmpID))?.strEmpName || null
    })),
    payments: payments.map((payment) => ({
      ...payment,
      strVerifierName: employeeById.get(String(payment.lngVerifiedByEmpID))?.strEmpName || null
    })),
    promissoryNotes: notes.map((note) => ({
      ...note,
      strLoggedByName: employeeById.get(String(note.lngLoggedByEmpID))?.strEmpName || null
    })),
    contacts: contacts.map((contact) => ({
      lngContactID: contact.lngContactID,
      dteContactDate: contact.dteContactDate,
      memContactDetails: contact.memContactDetails,
      strContactType: typeById.get(String(contact.lngContactTypeID))?.strContactType || null,
      strEmpName: employeeById.get(String(contact.lngEmployeeID))?.strEmpName || null
    }))
  };
}

async function getStaffOverview() {
  const [
    studentRows,
    courses,
    sections,
    loads,
    documents,
    payments,
    notes,
    contacts,
    employeeRows,
    positions,
    contactTypes,
    studentCourseLinks,
    backups
  ] = await Promise.all([
    rows('tblStudentInformation', 'lngStudentID'),
    rows('tblCourseList', 'lngCourseID'),
    rows('tblSubjectSections', 'lngSectionID'),
    rows('tblStudentSubjectLoad', 'lngLoadID'),
    rows('tblAdmissionDocuments', 'lngDocID'),
    rows('tblPayments', 'lngPaymentID'),
    rows('tblPromissoryNotes', 'lngNoteID'),
    rows('tblContacts', 'lngContactID'),
    rows('tblEmployees', 'lngEmpID'),
    rows('tblEmpJobPosition', 'lngEmpPositionID'),
    rows('tblContactType', 'lngContactTypeID'),
    rows('tblLINKStudent_Course', 'lngLinkID'),
    rows('tblDatabaseBackups', 'lngBackupID')
  ]);

  const studentById = indexBy(studentRows, 'lngStudentID');
  const employeeById = indexBy(employeeRows, 'lngEmpID');
  const courseById = indexBy(courses, 'lngCourseID');
  const sectionById = indexBy(sections, 'lngSectionID');
  const typeById = indexBy(contactTypes, 'lngContactTypeID');
  const positionById = indexBy(positions, 'lngEmpPositionID');
  const linkByStudent = new Map();
  for (const link of studentCourseLinks) {
    if (!linkByStudent.has(String(link.lngStudentID))) linkByStudent.set(String(link.lngStudentID), link);
  }

  const students = studentRows.map((student) => {
    const link = linkByStudent.get(String(student.lngStudentID));
    const course = link ? courseById.get(String(link.lngCourseID)) : null;
    return {
      ...cleanStudent(student),
      lngCourseID: link?.lngCourseID ?? null,
      dteCourseStartDate: link?.dteCourseStartDate ?? null,
      ysnCourseComplete: link?.ysnCourseComplete ?? null,
      strCourseCode: course?.strCourseCode ?? null,
      strCourseDescription: course?.strCourseDescription ?? null
    };
  });
  const employeeSafeRows = employeeRows.map(cleanEmployee);
  const enriched = await enrichSections(sections, employeeRows, courses);
  const enrichedSectionById = indexBy(enriched, 'lngSectionID');

  return {
    students,
    courses,
    sections: enriched,
    subjectLoads: loads.map((load) => {
      const student = studentById.get(String(load.lngStudentID)) || {};
      const section = enrichedSectionById.get(String(load.lngSectionID)) || {};
      return {
        ...load,
        strStudentNo: student.strStudentNo,
        strFirstName: student.strFirstName,
        strLastName: student.strLastName,
        strEnrollmentStatus: student.strEnrollmentStatus,
        ysnHasINC: student.ysnHasINC,
        strSubjectCode: section.strSubjectCode,
        strSubjectTitle: section.strSubjectTitle,
        strSectionName: section.strSectionName,
        strSchedule: section.strSchedule,
        strRoom: section.strRoom,
        intUnits: section.intUnits,
        lngFacultyEmpID: section.lngFacultyEmpID,
        strProfessorName: section.strProfessorName
      };
    }),
    documents: documents.map((document) => {
      const student = studentById.get(String(document.lngStudentID)) || {};
      return {
        ...document,
        strStudentNo: student.strStudentNo,
        strFirstName: student.strFirstName,
        strLastName: student.strLastName,
        strStudentType: student.strStudentType,
        strEmail: student['hypE-mailAddress'],
        strReviewerName: employeeById.get(String(document.lngReviewedByEmpID))?.strEmpName || null
      };
    }).sort((a, b) => Number(a.strStatus !== 'Pending Review') - Number(b.strStatus !== 'Pending Review')),
    payments: payments.map((payment) => {
      const student = studentById.get(String(payment.lngStudentID)) || {};
      return {
        ...payment,
        strStudentNo: student.strStudentNo,
        strFirstName: student.strFirstName,
        strLastName: student.strLastName,
        strEnrollmentStatus: student.strEnrollmentStatus,
        strVerifierName: employeeById.get(String(payment.lngVerifiedByEmpID))?.strEmpName || null
      };
    }).sort((a, b) => Number(a.strStatus !== 'Pending Verification') - Number(b.strStatus !== 'Pending Verification')),
    promissoryNotes: notes.map((note) => {
      const student = studentById.get(String(note.lngStudentID)) || {};
      return {
        ...note,
        strStudentNo: student.strStudentNo,
        strFirstName: student.strFirstName,
        strLastName: student.strLastName,
        strEnrollmentStatus: student.strEnrollmentStatus,
        strLoggedByName: employeeById.get(String(note.lngLoggedByEmpID))?.strEmpName || null
      };
    }).sort((a, b) => Number(b.lngNoteID) - Number(a.lngNoteID)),
    contacts: contacts.map((contact) => {
      const student = studentById.get(String(contact.lngStudentID)) || {};
      return {
        ...contact,
        strStudentNo: student.strStudentNo,
        strFirstName: student.strFirstName,
        strLastName: student.strLastName,
        strContactType: typeById.get(String(contact.lngContactTypeID))?.strContactType || null,
        strEmpName: employeeById.get(String(contact.lngEmployeeID))?.strEmpName || null
      };
    }).sort((a, b) => Number(b.lngContactID) - Number(a.lngContactID)),
    employees: employeeSafeRows.map((employee) => ({
      ...employee,
      strEmpPosition: positionById.get(String(employee.lngEmpPositionID))?.strEmpPosition || null
    })),
    positions,
    contactTypes,
    studentCourseLinks,
    backups: backups.sort((a, b) => Number(b.lngBackupID) - Number(a.lngBackupID))
  };
}

function overviewForStaffRole(overview, employee) {
  const hiddenAdminData = {
    employees: [],
    positions: [],
    contactTypes: [],
    studentCourseLinks: [],
    backups: []
  };
  if (employee.strAccess === 'ADMIN') return overview;
  if (employee.strAccess === 'REGISTRAR') {
    return {
      ...overview,
      ...hiddenAdminData,
      payments: [],
      promissoryNotes: []
    };
  }
  if (employee.strAccess === 'DEAN') {
    return {
      ...overview,
      ...hiddenAdminData,
      students: overview.students.map((student) => ({
        lngStudentID: student.lngStudentID,
        strStudentNo: student.strStudentNo,
        strFirstName: student.strFirstName,
        strLastName: student.strLastName,
        strStudentType: student.strStudentType,
        strCourseCode: student.strCourseCode,
        ysnHasINC: student.ysnHasINC,
        strINCSubject: student.strINCSubject,
        dteINCIncurred: student.dteINCIncurred,
        ysnDeanPreRegReleased: student.ysnDeanPreRegReleased,
        strEnrollmentStatus: student.strEnrollmentStatus
      })),
      documents: [],
      payments: [],
      promissoryNotes: [],
      contacts: []
    };
  }
  if (employee.strAccess === 'FINANCE') {
    return {
      ...overview,
      ...hiddenAdminData,
      students: overview.students.map((student) => ({
        lngStudentID: student.lngStudentID,
        strStudentNo: student.strStudentNo,
        strFirstName: student.strFirstName,
        strLastName: student.strLastName,
        strEnrollmentStatus: student.strEnrollmentStatus,
        curOutstandingBalance: student.curOutstandingBalance
      })),
      sections: [],
      subjectLoads: [],
      documents: [],
      contacts: []
    };
  }
  if (employee.strAccess === 'FACULTY') {
    const assignedSections = overview.sections.filter(
      (section) => Number(section.lngFacultyEmpID) === Number(employee.lngEmpID)
    );
    const assignedSectionIds = new Set(assignedSections.map((section) => String(section.lngSectionID)));
    return {
      ...overview,
      ...hiddenAdminData,
      students: [],
      sections: assignedSections,
      subjectLoads: overview.subjectLoads.filter((load) => assignedSectionIds.has(String(load.lngSectionID))),
      documents: [],
      payments: [],
      promissoryNotes: [],
      contacts: [],
      studentCourseLinks: []
    };
  }
  throw new HttpError(403, 'Unrecognized staff access role.');
}

async function getPrincipal(req) {
  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new HttpError(401, 'Please sign in to continue.');

  const { data, error } = await authClient.auth.getUser(match[1]);
  if (error || !data.user) throw new HttpError(401, 'Your session has expired. Please sign in again.');

  const userId = data.user.id;
  const [studentResult, employeeResult] = await Promise.all([
    query(supabase.from('tblStudentInformation').select('*').eq('authUserId', userId).maybeSingle()),
    query(supabase.from('tblEmployees').select('*').eq('authUserId', userId).maybeSingle())
  ]);

  if (studentResult) {
    return {
      userId,
      type: 'student',
      role: studentResult.strStudentType === 'Applicant' ? 'APPLICANT' : 'STUDENT',
      student: studentResult
    };
  }
  if (employeeResult) {
    return {
      userId,
      type: 'staff',
      role: employeeResult.strAccess,
      employee: employeeResult
    };
  }
  throw new HttpError(403, 'This Supabase Auth account is not linked to a JOI student or employee profile.');
}

async function requirePrincipal(req) {
  if (!req.principal) req.principal = await getPrincipal(req);
  return req.principal;
}

async function requireStudent(req, requestedId) {
  const principal = await requirePrincipal(req);
  if (principal.type !== 'student' || String(principal.student.lngStudentID) !== String(requestedId)) {
    throw new HttpError(403, 'You can only access your own student account.');
  }
  return principal.student;
}

async function requireRole(req, roles) {
  const principal = await requirePrincipal(req);
  if (principal.type !== 'staff' || !roles.includes(principal.role)) {
    throw new HttpError(403, 'You do not have permission to perform this action.');
  }
  return principal.employee;
}

async function studentByIdentifier(identifier) {
  const candidates = await rows('tblStudentInformation', 'lngStudentID');
  const value = String(identifier).trim().toLocaleLowerCase();
  return candidates.find((candidate) =>
    String(candidate.strUsername || '').toLocaleLowerCase() === value ||
    String(candidate.strStudentNo || '').toLocaleLowerCase() === value
  ) || null;
}

async function staffByIdentifier(identifier) {
  const candidates = await rows('tblEmployees', 'lngEmpID');
  const value = String(identifier).trim().toLocaleLowerCase();
  return candidates.find((candidate) =>
    [candidate.strEmpCode, candidate.strEmpName, candidate.strAccess, candidate.strEmpEmail]
      .some((field) => String(field || '').toLocaleLowerCase() === value)
  ) || null;
}

async function signIn(email, password) {
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    throw new HttpError(401, 'Invalid credentials. If this account existed in the SQLite app, set/reset its password in Supabase Auth first.');
  }
  return { data, error };
}

async function attachAuthUser(table, idColumn, record, userId) {
  if (record.authUserId && record.authUserId !== userId) {
    throw new HttpError(403, 'This account is linked to a different Supabase Auth user.');
  }
  if (!record.authUserId) {
    await updateOne(table, idColumn, record[idColumn], { authUserId: userId });
  }
}

async function login(req, res) {
  const { mode, identifier, password } = await parseBody(req);
  if (!identifier || !password) {
    throw new HttpError(400, 'Please enter both identifier/username and password.');
  }

  const isStudent = mode === 'applicant' || mode === 'student';
  if (!isStudent && mode !== 'staff') {
    throw new HttpError(400, 'Unsupported authentication mode.');
  }
  const profile = isStudent
    ? await studentByIdentifier(identifier)
    : await staffByIdentifier(identifier);
  if (!profile) throw new HttpError(401, 'Invalid login identifier or password.');

  const email = isStudent ? profile['hypE-mailAddress'] : profile.strEmpEmail;
  if (!email) {
    throw new HttpError(409, 'This profile needs an email address before it can be linked to Supabase Auth.');
  }
  const { data } = await signIn(email, password);
  const confirmedEmail = String(data.user.email || '').toLocaleLowerCase();
  if (confirmedEmail !== String(email).toLocaleLowerCase()) {
    throw new HttpError(403, 'The Supabase Auth email does not match this profile.');
  }

  if (isStudent) {
    await attachAuthUser('tblStudentInformation', 'lngStudentID', profile, data.user.id);
    const role = profile.strStudentType === 'Applicant' ? 'APPLICANT' : 'STUDENT';
    return sendJson(res, 200, {
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      userType: 'student',
      role,
      studentId: profile.lngStudentID,
      name: `${profile.strFirstName} ${profile.strLastName}`,
      studentNo: profile.strStudentNo
    });
  }

  await attachAuthUser('tblEmployees', 'lngEmpID', profile, data.user.id);
  const position = await one('tblEmpJobPosition', 'lngEmpPositionID', profile.lngEmpPositionID);
  return sendJson(res, 200, {
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
    userType: 'staff',
    role: profile.strAccess,
    empId: profile.lngEmpID,
    empCode: profile.strEmpCode,
    name: profile.strEmpName,
    position: position?.strEmpPosition || '',
    department: profile.strDepartment
  });
}

async function createApplicant(body) {
  const {
    personal = {},
    education = {},
    family = {},
    documents = [],
    courseId = 1,
    username,
    password,
    confirmedReview
  } = body;

  if (!confirmedReview) {
    throw new HttpError(400, 'You must review and confirm your application details before final submission.');
  }
  if (!personal.firstName || !personal.lastName || !username || !password || !personal.email) {
    throw new HttpError(400, 'First Name, Last Name, email, Username, and Password are required.');
  }
  if (String(password).length < 8) {
    throw new HttpError(400, 'Password must be at least 8 characters long.');
  }

  const existingRows = await rows('tblStudentInformation', 'lngStudentID');
  if (existingRows.some((student) => String(student.strUsername || '').toLocaleLowerCase() === String(username).trim().toLocaleLowerCase())) {
    throw new HttpError(409, 'Username is already taken. Please choose another username.');
  }

  const studentNo = `APP-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const { data: authData, error: authError } = await authClient.auth.signUp({
    email: String(personal.email).trim(),
    password: String(password),
    options: {
      data: { full_name: `${personal.firstName} ${personal.lastName}`, role: 'applicant' },
      emailRedirectTo: SITE_URL
    }
  });
  if (authError || !authData.user) {
    throw new HttpError(400, authError?.message || 'Could not create the Supabase Auth account.');
  }
  if (!authData.user.email || !(authData.user.identities || []).length) {
    throw new HttpError(409, 'That email is already registered. Sign in or use the account recovery process.');
  }

  let createdStudentId = null;
  try {
    const student = await insertOne('tblStudentInformation', {
      authUserId: authData.user.id,
      strStudentNo: studentNo,
      strUsername: String(username).trim(),
      strTitle: personal.title || 'Mr./Ms.',
      strFirstName: String(personal.firstName).trim(),
      strMiddleName: personal.middleName || '',
      strLastName: String(personal.lastName).trim(),
      strAddress1: personal.address1 || '121 H.V. Dela Costa Street',
      strAddress2: personal.address2 || 'Salcedo Village',
      strCity: personal.city || 'Makati City',
      strCounty: personal.county || 'Metro Manila',
      strPostCode: personal.postCode || '1209',
      strCountry: personal.country || 'Philippines',
      strTelephone: personal.telephone || '',
      strAltTelephone: personal.altTelephone || '',
      'hypE-mailAddress': String(personal.email).trim(),
      dtmDOB: personal.dob || '2007-01-01',
      strUpdatedBy: 'APPLICANT_INTAKE_PORTAL',
      strStudentType: 'Applicant',
      intYearLevel: Number(education.yearLevel || 1),
      strSemester: '1st Semester AY 2026-2027',
      strApplicationStatus: 'Submitted - Pending Registrar Review',
      strEnrollmentStatus: 'Applicant',
      ysnHasINC: 0,
      ysnDeanPreRegReleased: 0,
      curMiscFee: 6850,
      curOutstandingBalance: 29050,
      jsonEducationalBg: education,
      jsonFamilyInfo: family
    });
    createdStudentId = student.lngStudentID;

    await insertOne('tblLINKStudent_Course', {
      lngStudentID: student.lngStudentID,
      lngCourseID: Number(courseId),
      dteCourseStartDate: new Date().toISOString().slice(0, 10),
      ysnCourseComplete: 0
    });

    const docsToSave = Array.isArray(documents) && documents.length > 0
      ? documents
      : [
          { docType: 'Form 138 (Report Card)', fileName: `${personal.lastName}_Form138.pdf`, fileSize: '1.4 MB' },
          { docType: 'Good Moral Certificate', fileName: `${personal.lastName}_GoodMoral.pdf`, fileSize: '890 KB' },
          { docType: 'Transcript of Records / PSA Birth Cert', fileName: `${personal.lastName}_BirthCert.pdf`, fileSize: '1.1 MB' }
        ];
    const documentRows = docsToSave.map((document) => ({
      lngStudentID: student.lngStudentID,
      strDocType: String(document.docType || 'Other'),
      strFileName: String(document.fileName || 'uploaded-document'),
      strFileSize: document.fileSize || '1.1 MB',
      strStatus: 'Pending Review',
      strRemarks: 'Uploaded via 4-Page Digital Intake Form'
    }));
    await query(supabase.from('tblAdmissionDocuments').insert(documentRows));
    await addContact(
      student.lngStudentID,
      'Admission Document Review (FR-003)',
      `New ${personal.applicantType || 'Applicant'} intake form submitted (${studentNo}). ${documentRows.length} digital admission documents queued for Registrar review.`
    );

    return {
      student,
      token: authData.session?.access_token || null,
      refreshToken: authData.session?.refresh_token || null,
      requiresEmailConfirmation: !authData.session
    };
  } catch (error) {
    if (createdStudentId !== null) {
      const { error: deleteProfileError } = await supabase
        .from('tblStudentInformation')
        .delete()
        .eq('lngStudentID', createdStudentId);
      if (deleteProfileError) {
        console.error('Failed to clean up incomplete applicant profile:', deleteProfileError);
      }
    }
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(authData.user.id);
    if (deleteAuthError) console.error('Failed to clean up incomplete Auth account:', deleteAuthError);
    throw error;
  }
}

function staticFilePath(pathname) {
  const requestedPath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^[/\\]+/, '');
  const filePath = path.resolve(PUBLIC_DIR, requestedPath);
  const relativePath = path.relative(PUBLIC_DIR, filePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) return null;
  return filePath;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      return res.end();
    }

    if (pathname === '/api/public/courses' && req.method === 'GET') {
      const courses = await rows('tblCourseList', 'lngCourseID');
      return sendJson(res, 200, { courses });
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      return await login(req, res);
    }

    if (pathname === '/api/auth/refresh' && req.method === 'POST') {
      const { refreshToken } = await parseBody(req);
      if (!refreshToken) throw new HttpError(400, 'A refresh token is required.');
      const { data, error } = await authClient.auth.refreshSession({ refresh_token: refreshToken });
      if (error || !data.session) throw new HttpError(401, 'Your session expired. Please sign in again.');
      return sendJson(res, 200, {
        token: data.session.access_token,
        refreshToken: data.session.refresh_token
      });
    }

    if (pathname === '/api/applicant/apply' && req.method === 'POST') {
      const created = await createApplicant(await parseBody(req));
      return sendJson(res, 201, {
        message: 'Application submitted successfully!',
        token: created.token,
        refreshToken: created.refreshToken,
        requiresEmailConfirmation: created.requiresEmailConfirmation,
        studentId: created.student.lngStudentID,
        studentNo: created.student.strStudentNo,
        username: created.student.strUsername
      });
    }

    if (pathname.startsWith('/api/student/dashboard/') && req.method === 'GET') {
      const studentId = pathname.split('/').pop();
      await requireStudent(req, studentId);
      const bundle = await getStudentFullBundle(studentId);
      if (!bundle) throw new HttpError(404, 'Student record not found.');
      return sendJson(res, 200, bundle);
    }

    if (pathname === '/api/student/enroll-subject' && req.method === 'POST') {
      const { studentId, sectionId } = await parseBody(req);
      await requireStudent(req, studentId);
      const { error } = await supabase.rpc('joi_enroll_subject', {
        p_student_id: Number(studentId),
        p_section_id: Number(sectionId)
      });
      if (error) {
        const status = error.code === 'P0001' ? 409 : undefined;
        throw new HttpError(status || 400, error.message);
      }
      const section = await one('tblSubjectSections', 'lngSectionID', sectionId);
      return sendJson(res, 200, {
        message: `Successfully added ${section.strSubjectCode} (${section.strSectionName}) to your subject load.`,
        bundle: await getStudentFullBundle(studentId)
      });
    }

    if (pathname === '/api/student/drop-subject' && req.method === 'POST') {
      const { studentId, loadId } = await parseBody(req);
      await requireStudent(req, studentId);
      const { error } = await supabase.rpc('joi_drop_subject', {
        p_student_id: Number(studentId),
        p_load_id: Number(loadId)
      });
      if (error) {
        const status = error.code === 'P0001' ? 404 : undefined;
        throw new HttpError(status || 400, error.message);
      }
      return sendJson(res, 200, {
        message: 'Subject removed from current load.',
        bundle: await getStudentFullBundle(studentId)
      });
    }

    if (pathname === '/api/student/upload-document' && req.method === 'POST') {
      const { studentId, docType, fileName, fileSize } = await parseBody(req);
      if (!studentId || !docType || !fileName) {
        throw new HttpError(400, 'Document type and file name are required.');
      }
      await requireStudent(req, studentId);
      await insertOne('tblAdmissionDocuments', {
        lngStudentID: Number(studentId),
        strDocType: docType,
        strFileName: fileName,
        strFileSize: fileSize || '1.2 MB',
        strStatus: 'Pending Review',
        strRemarks: 'Uploaded via Student/Applicant Portal (FR-002)'
      });
      await addContact(
        Number(studentId),
        'Admission Document Review (FR-003)',
        `Student uploaded digital admission document: ${docType} (${fileName}) for Registrar verification.`
      );
      return sendJson(res, 201, {
        message: 'Document uploaded and queued for Registrar review.',
        bundle: await getStudentFullBundle(studentId)
      });
    }

    if (pathname === '/api/student/submit-qr-payment' && req.method === 'POST') {
      const { studentId, amount, paymentMethod, receiptFileName, referenceNo } = await parseBody(req);
      const student = await requireStudent(req, studentId);
      if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
        throw new HttpError(400, 'Enter a valid payment amount.');
      }
      if (!student.ysnDeanPreRegReleased) {
        throw new HttpError(400, 'Pre-Registration Form has not yet been released. Please await clearance before settling payment.');
      }
      const reference = referenceNo || `JOI-QR-${new Date().getFullYear()}-${crypto.randomInt(10000, 100000)}`;
      const amountValue = Number(amount);
      const qrPayload = `JOI-ACADEMY|STU:${student.strStudentNo}|AMT:${amountValue.toFixed(2)}|REF:${reference}`;
      await insertOne('tblPayments', {
        lngStudentID: student.lngStudentID,
        strReferenceNo: reference,
        strPaymentMethod: paymentMethod || 'QR Ph Dynamic (GCash / Maya / InstaPay)',
        curAmount: amountValue,
        strQRPayload: qrPayload,
        strReceiptFileName: receiptFileName || `QR_Receipt_${reference}.png`,
        strStatus: 'Pending Verification',
        strRemarks: 'Submitted via Student QR Payment Portal (FR-007)'
      });
      if (student.strEnrollmentStatus !== 'Officially Enrolled') {
        await updateOne('tblStudentInformation', 'lngStudentID', student.lngStudentID, {
          strEnrollmentStatus: 'Awaiting Payment Verification',
          dtmLastChanged: new Date().toISOString()
        });
      }
      await addContact(
        student.lngStudentID,
        'Financial / QR Payment Notification',
        `Submitted QR Payment Receipt (${reference}) for PHP ${amountValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}. Queued for Finance verification.`
      );
      return sendJson(res, 201, {
        message: `QR Payment (${reference}) submitted! Finance will verify your receipt.`,
        bundle: await getStudentFullBundle(student.lngStudentID)
      });
    }

    if (pathname === '/api/student/inquiry' && req.method === 'POST') {
      const { studentId, category, message } = await parseBody(req);
      if (!studentId || !message) throw new HttpError(400, 'Please enter your inquiry or concern message.');
      await requireStudent(req, studentId);
      await addContact(
        Number(studentId),
        'Student Portal Inquiry & Support',
        `[${category || 'General Inquiry'}] ${message}`
      );
      return sendJson(res, 201, {
        message: 'Your inquiry has been logged and routed to the appropriate office.',
        bundle: await getStudentFullBundle(studentId)
      });
    }

    if (pathname === '/api/staff/overview' && req.method === 'GET') {
      const employee = await requireRole(req, ['ADMIN', 'REGISTRAR', 'FINANCE', 'FACULTY', 'DEAN']);
      return sendJson(res, 200, overviewForStaffRole(await getStaffOverview(), employee));
    }

    if (pathname === '/api/registrar/review-document' && req.method === 'POST') {
      const employee = await requireRole(req, ['ADMIN', 'REGISTRAR']);
      const { docId, status, remarks } = await parseBody(req);
      if (!['Approved', 'Rejected'].includes(status)) throw new HttpError(400, 'Invalid document review status.');
      const document = await one('tblAdmissionDocuments', 'lngDocID', Number(docId));
      if (!document) throw new HttpError(404, 'Document not found.');
      await updateOne('tblAdmissionDocuments', 'lngDocID', document.lngDocID, {
        strStatus: status,
        strRemarks: remarks || `Reviewed by Registrar (${status})`,
        lngReviewedByEmpID: employee.lngEmpID,
        dteReviewed: new Date().toISOString()
      });
      const student = await one('tblStudentInformation', 'lngStudentID', document.lngStudentID);
      const pending = await query(
        supabase.from('tblAdmissionDocuments')
          .select('lngDocID')
          .eq('lngStudentID', document.lngStudentID)
          .neq('strStatus', 'Approved')
      );
      if (pending.length === 0 && student.strStudentType === 'Applicant') {
        await updateOne('tblStudentInformation', 'lngStudentID', student.lngStudentID, {
          strApplicationStatus: 'Docs Verified & Approved',
          strEnrollmentStatus: 'Pre-Registered',
          ysnDeanPreRegReleased: 1,
          dtmLastChanged: new Date().toISOString(),
          strUpdatedBy: 'REGISTRAR'
        });
      } else if (status === 'Rejected') {
        await updateOne('tblStudentInformation', 'lngStudentID', student.lngStudentID, {
          strApplicationStatus: 'Action Required: Document Rejected',
          dtmLastChanged: new Date().toISOString(),
          strUpdatedBy: 'REGISTRAR'
        });
      }
      const email = student['hypE-mailAddress'] || 'student@joi.edu.ph';
      await addContact(
        student.lngStudentID,
        'Admission Document Review (FR-003)',
        `[EMAIL NOTIFICATION] Admission Document "${document.strDocType}" (${document.strFileName}) marked ${status.toUpperCase()} for ${email}. Remarks: ${remarks || 'Verified by Office of the Registrar.'}`,
        employee.lngEmpID
      );
      return sendJson(res, 200, {
        message: `Document marked as ${status}. Notification recorded for ${email}.`
      });
    }

    if (pathname === '/api/registrar/dean-approval' && req.method === 'POST') {
      const employee = await requireRole(req, ['ADMIN', 'REGISTRAR', 'DEAN']);
      const { studentId, releasePreReg, enrollmentStatus } = await parseBody(req);
      const student = await one('tblStudentInformation', 'lngStudentID', Number(studentId));
      if (!student) throw new HttpError(404, 'Student not found.');
      const status = enrollmentStatus || (student.ysnHasINC ? 'Conditionally Enrolled (INC)' : 'Pre-Registered');
      await updateOne('tblStudentInformation', 'lngStudentID', student.lngStudentID, {
        ysnDeanPreRegReleased: releasePreReg ? 1 : 0,
        strEnrollmentStatus: status,
        strApplicationStatus: 'Approved',
        dtmLastChanged: new Date().toISOString(),
        strUpdatedBy: 'DEAN_REGISTRAR'
      });
      await addContact(
        student.lngStudentID,
        'Academic Advising & INC Clearance',
        `Academic Approval & Pre-Registration Form ${releasePreReg ? 'RELEASED' : 'HELD'} by Department Dean / Registrar. Enrollment Status: ${status}.`,
        employee.lngEmpID
      );
      return sendJson(res, 200, { message: `Updated Pre-Registration release status for ${student.strFirstName} ${student.strLastName}.` });
    }

    if (pathname === '/api/registrar/section' && req.method === 'POST') {
      await requireRole(req, ['ADMIN', 'REGISTRAR']);
      const body = await parseBody(req);
      if (body.sectionId) {
        const section = await updateOne('tblSubjectSections', 'lngSectionID', Number(body.sectionId), {
          intMaxCapacity: Number(body.maxCapacity || 35),
          strSchedule: body.schedule,
          strRoom: body.room,
          strPrerequisiteCode: body.prerequisiteCode || 'NONE'
        });
        if (!section) throw new HttpError(404, 'Section not found.');
        return sendJson(res, 200, { message: 'Section capacity and schedule updated.' });
      }
      if (!body.subjectCode || !body.subjectTitle) throw new HttpError(400, 'Subject code and title are required.');
      const section = await insertOne('tblSubjectSections', {
        lngCourseID: Number(body.courseId || 1),
        strSubjectCode: body.subjectCode,
        strSubjectTitle: body.subjectTitle,
        intUnits: Number(body.units || 3),
        strSectionName: body.sectionName || 'BSCOE 3-1',
        strSchedule: body.schedule || 'MWF 02:00 PM - 03:30 PM',
        strRoom: body.room || 'Salcedo Hall 301',
        lngFacultyEmpID: body.facultyEmpId ? Number(body.facultyEmpId) : null,
        strPrerequisiteCode: body.prerequisiteCode || 'NONE',
        intMaxCapacity: Number(body.maxCapacity || 35),
        intEnrolledCount: 0,
        curPerUnitFee: Number(body.perUnitFee || 1850),
        curLabFee: Number(body.labFee || 0)
      });
      return sendJson(res, 201, { message: `Created new section offering ${section.strSubjectCode} (${section.strSectionName}).` });
    }

    if (pathname === '/api/finance/verify-payment' && req.method === 'POST') {
      const employee = await requireRole(req, ['ADMIN', 'FINANCE']);
      const { paymentId, status, remarks } = await parseBody(req);
      if (!['Paid / Verified', 'Failed / Rejected'].includes(status)) throw new HttpError(400, 'Invalid payment status.');
      const payment = await one('tblPayments', 'lngPaymentID', Number(paymentId));
      if (!payment) throw new HttpError(404, 'Payment record not found.');
      await updateOne('tblPayments', 'lngPaymentID', payment.lngPaymentID, {
        strStatus: status,
        strRemarks: remarks || `Verified by Finance (${status})`,
        lngVerifiedByEmpID: employee.lngEmpID,
        dteVerified: new Date().toISOString()
      });
      await recalculateStudentBalance(payment.lngStudentID);
      if (status === 'Paid / Verified') {
        const student = await one('tblStudentInformation', 'lngStudentID', payment.lngStudentID);
        const assignedStudentNo = String(student.strStudentNo).startsWith('APP-')
          ? `2026-00${100 + Number(student.lngStudentID)}`
          : student.strStudentNo;
        await updateOne('tblStudentInformation', 'lngStudentID', student.lngStudentID, {
          strEnrollmentStatus: 'Officially Enrolled',
          strStudentType: student.strStudentType === 'Applicant' ? 'Returning' : student.strStudentType,
          strStudentNo: assignedStudentNo,
          dtmLastChanged: new Date().toISOString(),
          strUpdatedBy: 'FINANCE_QR_VERIFIED'
        });
        const studentLoads = await query(
          supabase.from('tblStudentSubjectLoad')
            .select('lngLoadID,strStatus')
            .eq('lngStudentID', student.lngStudentID)
        );
        for (const load of studentLoads) {
          await updateOne('tblStudentSubjectLoad', 'lngLoadID', load.lngLoadID, {
            strStatus: load.strStatus.startsWith('Conditional') ? 'Conditional (INC Grace Period)' : 'Enrolled'
          });
        }
      }
      await addContact(
        payment.lngStudentID,
        'Financial / QR Payment Notification',
        `QR Payment ${payment.strReferenceNo} (PHP ${Number(payment.curAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}) marked ${status} by Finance. ${remarks || ''}`,
        employee.lngEmpID
      );
      return sendJson(res, 200, {
        message: status === 'Paid / Verified'
          ? 'Payment verified and student tagged as Officially Enrolled.'
          : `Payment marked as ${status}.`
      });
    }

    if (pathname === '/api/finance/promissory-note' && req.method === 'POST') {
      const employee = await requireRole(req, ['ADMIN', 'FINANCE']);
      const { studentId, coveredAmount, agreementTerms, deferredDueDate } = await parseBody(req);
      const student = await one('tblStudentInformation', 'lngStudentID', Number(studentId));
      if (!student) throw new HttpError(404, 'Student not found.');
      const reference = `PN-JOI-${new Date().getFullYear()}-${crypto.randomInt(1000, 10000)}`;
      const amount = Number(coveredAmount || student.curOutstandingBalance || 15000);
      const dueDate = deferredDueDate || `${new Date().getFullYear()}-12-15`;
      const enrollStatus = student.ysnHasINC ? 'Officially Enrolled (Conditional INC)' : 'Officially Enrolled';
      await insertOne('tblPromissoryNotes', {
        lngStudentID: student.lngStudentID,
        strNoteReferenceNo: reference,
        curCoveredAmount: amount,
        strAgreementTerms: agreementTerms || 'Approved paper Promissory Note with deferred installment schedule.',
        dteDeferredDueDate: dueDate,
        strStatus: 'Approved',
        lngLoggedByEmpID: employee.lngEmpID
      });
      await updateOne('tblStudentInformation', 'lngStudentID', student.lngStudentID, {
        strEnrollmentStatus: enrollStatus,
        ysnDeanPreRegReleased: 1,
        dtmLastChanged: new Date().toISOString(),
        strUpdatedBy: 'FINANCE_PROMISSORY'
      });
      await addContact(
        student.lngStudentID,
        'Promissory Note Agreement (FR-005)',
        `Logged approved paper Promissory Note ${reference} covering PHP ${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} (Due: ${dueDate}).`,
        employee.lngEmpID
      );
      return sendJson(res, 201, { message: `Promissory Note ${reference} recorded.` });
    }

    if (pathname === '/api/faculty/encode-grade' && req.method === 'POST') {
      const employee = await requireRole(req, ['ADMIN', 'FACULTY']);
      const { loadId, grade } = await parseBody(req);
      if (!grade) throw new HttpError(400, 'A grade is required.');
      const load = await one('tblStudentSubjectLoad', 'lngLoadID', Number(loadId));
      if (!load) throw new HttpError(404, 'Subject load entry not found.');
      const section = await one('tblSubjectSections', 'lngSectionID', load.lngSectionID);
      if (employee.strAccess !== 'ADMIN' && Number(section.lngFacultyEmpID) !== Number(employee.lngEmpID)) {
        throw new HttpError(403, 'Faculty can only encode grades for their assigned sections.');
      }
      const isINC = String(grade).toUpperCase().includes('INC');
      const status = isINC ? 'INC' : (grade === 'In Progress' ? 'Enrolled' : 'Completed');
      await updateOne('tblStudentSubjectLoad', 'lngLoadID', load.lngLoadID, {
        strGrade: grade,
        strStatus: status,
        dteEncoded: new Date().toISOString()
      });
      if (isINC) {
        await updateOne('tblStudentInformation', 'lngStudentID', load.lngStudentID, {
          ysnHasINC: 1,
          strINCSubject: `${section.strSubjectCode} - ${section.strSubjectTitle}`,
          dteINCIncurred: new Date().toISOString().slice(0, 10),
          strEnrollmentStatus: 'Conditionally Enrolled (INC)',
          dtmLastChanged: new Date().toISOString()
        });
      }
      await addContact(
        load.lngStudentID,
        'Academic Advising & INC Clearance',
        `Faculty encoded grade "${grade}" for ${section.strSubjectCode} (${section.strSubjectTitle}).`,
        employee.lngEmpID
      );
      return sendJson(res, 200, { message: `Grade "${grade}" recorded for ${section.strSubjectCode}.` });
    }

    if (pathname === '/api/admin/employee' && req.method === 'POST') {
      const actor = await requireRole(req, ['ADMIN']);
      const { empId, empCode, empName, email, positionId, accessRole, department } = await parseBody(req);
      if (empId) {
        const employee = await updateOne('tblEmployees', 'lngEmpID', Number(empId), {
          strEmpName: empName,
          strEmpEmail: email,
          lngEmpPositionID: Number(positionId),
          strAccess: accessRole,
          strDepartment: department
        });
        if (!employee) throw new HttpError(404, 'Employee not found.');
        return sendJson(res, 200, { message: `Updated RBAC permissions for ${empName} (${accessRole}).` });
      }
      if (!email || !empName || !positionId || !accessRole) {
        throw new HttpError(400, 'Employee name, email, job position, and access role are required.');
      }
      const code = empCode || `EMP-${accessRole.slice(0, 3)}-${crypto.randomInt(10, 99)}`;
      const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
        data: { full_name: empName, role: accessRole }
      });
      if (inviteError || !invited.user) {
        throw new HttpError(400, inviteError?.message || 'Could not invite the employee to Supabase Auth.');
      }
      try {
        await insertOne('tblEmployees', {
          authUserId: invited.user.id,
          strEmpCode: code,
          strEmpName: empName,
          strEmpEmail: String(email).trim(),
          lngEmpPositionID: Number(positionId),
          strAccess: accessRole,
          strDepartment: department || 'Academic Affairs'
        });
      } catch (error) {
        const { error: cleanupError } = await supabase.auth.admin.deleteUser(invited.user.id);
        if (cleanupError) console.error('Failed to remove Auth invite after employee creation failed:', cleanupError);
        throw error;
      }
      return sendJson(res, 201, {
        message: `Created staff profile ${code}. Supabase Auth invitation sent to ${email}.`
      });
    }

    if (pathname === '/api/admin/backup' && req.method === 'POST') {
      await requireRole(req, ['ADMIN']);
      throw new HttpError(501, 'Local SQLite file backups are not available with Supabase. Configure Supabase project backups in the dashboard.');
    }

    if (pathname.startsWith('/api/')) {
      throw new HttpError(404, 'API endpoint not found.');
    }

    const filePath = staticFilePath(pathname);
    if (!filePath) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      return fs.createReadStream(filePath).pipe(res);
    }
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME_TYPES['.html'] });
    return fs.createReadStream(indexPath).pipe(res);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    console.error('Supabase API error:', error);
    return sendJson(res, status, { error: error.message || 'Internal Server Error' });
  }
});

server.listen(PORT, () => {
  console.log(`J.O.I Academy Supabase API running at http://localhost:${PORT}`);
});
