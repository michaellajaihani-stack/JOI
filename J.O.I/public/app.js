/* =========================================================================
   JEWEL OF INTELLECT (J.O.I) ACADEMY — FRONTEND PORTAL APPLICATION
   Implements Landing, Applicants Module, Students Module, Faculty/Staff Module,
   4-Page Applicant Intake Wizard, and Multi-Role Real-Time Dashboards
   ========================================================================= */

(function () {
  const DRAFT_STORAGE_KEY = 'joi_applicant_intake_draft_v1';

  const defaultDraft = {
    step: 1,
    courseId: 1,
    username: '',
    password: '',
    confirmedReview: false,
    personal: {
      applicantType: 'New Applicant eshman)',
      title: 'Mr./Ms.',
      firstName: '',
      middleName: '',
      lastName: '',
      dob: '2007-04-12',
      email: '',
      telephone: '',
      altTelephone: '',
      address1: '121 H.V. Dela Costa Street',
      address2: 'Salcedo Village, Brgy. Bel-Air',
      city: 'Makati City',
      county: 'Metro Manila',
      postCode: '1209',
      country: 'Philippines'
    },
    education: {
      highSchool: '',
      schoolAddress: 'Makati City',
      lrn: '',
      strand: 'STEM (Science, Technology, Engineering, and Mathematics)',
      gradYear: '2026',
      gwa: '92.5',
      yearLevel: 1,
      honors: 'With Honors',
      previousCollege: ''
    },
    family: {
      fatherName: '',
      fatherOccupation: '',
      motherName: '',
      motherOccupation: '',
      guardianName: '',
      guardianRelation: 'Parent',
      guardianPhone: '',
      annualIncome: 'PHP 600,000 - PHP 900,000'
    },
    documents: [
      { docType: 'Form 138 (Senior High Report Card)', fileName: 'Form138_ReportCard_2026.pdf', fileSize: '1.4 MB' },
      { docType: 'Certificate of Good Moral Character', fileName: 'Good_Moral_Certificate.pdf', fileSize: '860 KB' },
      { docType: 'PSA Birth Certificate / TOR', fileName: 'PSA_Birth_Certificate.pdf', fileSize: '1.1 MB' }
    ]
  };

  const ROLE_TABS = {
    ADMIN: [
      { id: 'admin-dashboard', label: 'System Config & Accounts' },
      { id: 'admin-database', label: 'Database Management' },
      { id: 'registrar-documents', label: 'Registrar: Docs & Clearance' },
      { id: 'registrar-sections', label: 'Registrar: Courses & Sections' },
      { id: 'registrar-placement', label: 'Registrar: Placement & Master Lists' },
      { id: 'finance-payments', label: 'Finance: Payments & Promissory' },
      { id: 'faculty-grades', label: 'Faculty: Classes & Grades' }
    ],
    REGISTRAR: [
      { id: 'registrar-documents', label: 'Admissions & Document Review' },
      { id: 'registrar-sections', label: 'Courses, Blocks & Sections' },
      { id: 'registrar-placement', label: 'Student Placement & Master Lists' }
    ],
    FINANCE: [
      { id: 'finance-payments', label: 'Balances, Payments & Promissory Notes' }
    ],
    FACULTY: [
      { id: 'faculty-grades', label: 'My Assigned Sections & Grades' }
    ]
  };

  const state = {
    view: 'landing', // 'landing' | 'applicants-auth' | 'students-auth' | 'faculty-auth' | 'applicant-intake' | 'student-portal' | 'staff-portal'
    authInput: {
      identifier: '',
      password: '',
      showPassword: false,
      staffEmpCode: '',
      staffEmail: '',
      staffVerified: null
    },
    currentUser: null,
    studentBundle: null,
    staffOverview: null,
    publicCourses: [],
    studentTab: 'overview', // 'overview' | 'courses' | 'payments' | 'documents' | 'profile' | 'contacts'
    staffTab: 'registrar-documents',
    masterListSectionFilter: 'ALL',
    adminSelectedTable: 'tblEmployees',
    registrarEditSection: null,
    registrarTransferLoad: null,
    intakeDraft: loadDraft()
  };

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...defaultDraft,
          ...parsed,
          personal: { ...defaultDraft.personal, ...(parsed.personal || {}) },
          education: { ...defaultDraft.education, ...(parsed.education || {}) },
          family: { ...defaultDraft.family, ...(parsed.family || {}) },
          documents: Array.isArray(parsed.documents) && parsed.documents.length > 0
            ? parsed.documents
            : defaultDraft.documents
        };
      }
    } catch (_) {}
    return JSON.parse(JSON.stringify(defaultDraft));
  }

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(state.intakeDraft));
    } catch (_) {}
  }

  function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast';
    if (type === 'error') el.style.borderLeftColor = '#ef4444';
    if (type === 'success') el.style.borderLeftColor = '#22c55e';
    el.innerHTML = `<div style="font-weight:700;margin-bottom:2px;">${type === 'error' ? 'System Alert' : 'JOI Portal Notification'}</div><div>${escapeHtml(msg)}</div>`;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.25s ease';
      setTimeout(() => el.remove(), 260);
    }, 4200);
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatPHP(val) {
    const num = Number(val || 0);
    return 'PHP ' + num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Deterministic SVG QR Code Generator for FR-007
  function generateQRCodeSVG(payload) {
    const size = 21;
    const grid = Array.from({ length: size }, () => Array(size).fill(0));

    function drawFinder(r0, c0) {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
          const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          grid[r0 + r][c0 + c] = (isBorder || isInner) ? 1 : 0;
        }
      }
    }
    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);

    let hash = 2166136261;
    for (let i = 0; i < payload.length; i++) {
      hash ^= payload.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const inTopLeft = r < 8 && c < 8;
        const inTopRight = r < 8 && c >= size - 8;
        const inBotLeft = r >= size - 8 && c < 8;
        if (inTopLeft || inTopRight || inBotLeft) continue;
        if (r === 6 || c === 6) {
          grid[r][c] = (r + c) % 2 === 0 ? 1 : 0;
          continue;
        }
        hash ^= (r * 31 + c * 17) & 0xff;
        hash = Math.imul(hash, 16777619);
        grid[r][c] = (Math.abs(hash) % 10) < 5 ? 1 : 0;
      }
    }

    const cell = 8;
    const pad = 12;
    const total = size * cell + pad * 2;
    let rects = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c]) {
          rects += `<rect x="${pad + c * cell}" y="${pad + r * cell}" width="${cell}" height="${cell}" fill="#051938"/>`;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="190" height="190" style="border-radius:8px;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,0.08);">
      <rect width="${total}" height="${total}" fill="#ffffff"/>
      ${rects}
    </svg>`;
  }

  async function apiFetch(url, options = {}) {
    const makeRequest = (accessToken) => fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
      }
    });
    let res = await makeRequest(state.currentUser?.token);
    let data = await res.json();
    if (res.status === 401 && state.currentUser?.refreshToken && url !== '/api/auth/refresh') {
      const refreshResponse = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: state.currentUser.refreshToken })
      });
      const refreshed = await refreshResponse.json();
      if (refreshResponse.ok) {
        state.currentUser.token = refreshed.token;
        state.currentUser.refreshToken = refreshed.refreshToken;
        res = await makeRequest(state.currentUser.token);
        data = await res.json();
      }
    }
    if (!res.ok) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  }

  async function loadPublicBootstrap() {
    try {
      const data = await apiFetch('/api/public/courses');
      state.publicCourses = data.courses || [];
      render();
    } catch (err) {
      console.error(err);
    }
  }

  function navigate(viewName, presetAuth = null) {
    state.view = viewName;
    if (presetAuth) {
      state.authInput.identifier = presetAuth.identifier || '';
      state.authInput.password = presetAuth.password || '';
      state.authInput.showPassword = false;
      state.authInput.staffEmpCode = presetAuth.staffEmpCode || '';
      state.authInput.staffEmail = presetAuth.staffEmail || '';
      state.authInput.staffVerified = null;
    } else if (viewName.endsWith('-auth')) {
      state.authInput.identifier = '';
      state.authInput.password = '';
      state.authInput.showPassword = false;
      state.authInput.staffEmpCode = '';
      state.authInput.staffEmail = '';
      state.authInput.staffVerified = null;
    }
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function verifyStaffEmployeeId() {
    try {
      const empCode = String(state.authInput.staffEmpCode || '').trim();
      if (!empCode) {
        showToast('Please enter your Employee ID / Code first.', 'error');
        return;
      }
      const res = await apiFetch('/api/auth/verify-employee', {
        method: 'POST',
        body: JSON.stringify({ empCode })
      });
      state.authInput.staffVerified = res;
      state.authInput.staffEmpCode = res.empCode;
      render();
      showToast(`Employee ID verified — Role Detected: ${res.role}`, 'success');
    } catch (err) {
      state.authInput.staffVerified = null;
      render();
      showToast(err.message, 'error');
    }
  }

  async function loginWithCredentials(mode, identifier, password) {
    try {
      const payload = mode === 'staff'
        ? {
            mode: 'staff',
            empCode: state.authInput.staffEmpCode,
            email: state.authInput.staffEmail,
            password
          }
        : { mode, identifier, password };

      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      state.currentUser = res;

      if (res.userType === 'student') {
        const bundle = await apiFetch(`/api/student/dashboard/${res.studentId}`);
        state.studentBundle = bundle;
        state.studentTab = 'overview';
        state.view = 'student-portal';
        showToast(`Welcome, ${res.name} (${res.studentNo})!`, 'success');
      } else {
        const overview = await apiFetch('/api/staff/overview');
        state.staffOverview = overview;
        const allowedTabs = ROLE_TABS[res.role] || [];
        state.staffTab = allowedTabs[0]?.id || 'registrar-documents';
        state.view = 'staff-portal';
        showToast(`Authenticated as ${res.name} — ${res.position} (${res.role})`, 'success');
      }
      render();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function refreshStudentPortal() {
    if (!state.currentUser || !state.currentUser.studentId) return;
    state.studentBundle = await apiFetch(`/api/student/dashboard/${state.currentUser.studentId}`);
    render();
  }

  async function refreshStaffPortal() {
    state.staffOverview = await apiFetch('/api/staff/overview');
    render();
  }

  // =========================================================================
  // VIEW 1: LANDING GATEWAY (Two-Module Separation: School Access vs Student Access)
  // =========================================================================
  function renderLandingView() {
    return `
      <section class="campus-stage landing-tint">
        <div class="stage-content">
          <div class="landing-crest-wrap">
            <img src="/assets/crest.png" alt="Jewel of Intellect Academy Est. 2006 Crest" class="landing-crest-img" />
          </div>

          <div class="landing-actions-row">
            <button class="landing-pill-btn" onclick="window.JOIApp.navigate('faculty-auth')">
              Faculty / School Access
            </button>
            <button class="landing-pill-btn" onclick="window.JOIApp.navigate('students-auth')">
              Student Access
            </button>
          </div>

          <div class="landing-applicant-sub">
            <button class="landing-applicant-btn" onclick="window.JOIApp.navigate('applicants-auth')">
              Student Access &bull; Applicant Intake &amp; New Admissions
            </button>
          </div>
        </div>
      </section>
    `;
  }

  // =========================================================================
  // VIEW 2: APPLICANTS ACCESS MODULE (Matches Image 2 Mockup)
  // =========================================================================
  function renderApplicantsAuthView() {
    const pwType = state.authInput.showPassword ? 'text' : 'password';
    return `
      <section class="campus-stage auth-tint">
        <div class="stage-content">
          <h1 class="auth-module-heading">Applicants Access Module</h1>

          <div class="auth-card">
            <div class="auth-card-title">User Authentication</div>

            <div class="auth-field-group">
              <label class="auth-field-label" for="app-username-input">Username:</label>
              <div class="auth-input-wrap">
                <input
                  id="app-username-input"
                  type="text"
                  class="auth-input"
                  value="${escapeHtml(state.authInput.identifier)}"
                  oninput="window.JOIApp.setAuthField('identifier', this.value)"
                  autocomplete="username"
                  autofocus
                />
              </div>
            </div>

            <div class="auth-field-group">
              <label class="auth-field-label" for="app-password-input">Password:</label>
              <div class="auth-input-wrap">
                <input
                  id="app-password-input"
                  type="${pwType}"
                  class="auth-input"
                  value="${escapeHtml(state.authInput.password)}"
                  oninput="window.JOIApp.setAuthField('password', this.value)"
                  onkeydown="if(event.key==='Enter') window.JOIApp.submitAuth('applicant')"
                  autocomplete="current-password"
                />
                <button type="button" class="eye-toggle-btn" onclick="window.JOIApp.togglePassword()" title="Toggle Password Visibility">
                  ${renderEyeSvg(state.authInput.showPassword)}
                </button>
              </div>
            </div>

            <div class="auth-btn-row">
              <button type="button" class="auth-action-btn" onclick="window.JOIApp.clearAuth()">Clear</button>
              <button type="button" class="auth-action-btn" onclick="window.JOIApp.submitAuth('applicant')">Enter</button>
            </div>

            <p class="auth-applicant-notice">
              For new applicant and applicants who have not completed the requirements, click APPLY. The Apply button is only visible during the official application period.
            </p>

            <div>
              <button type="button" class="auth-action-btn" onclick="window.JOIApp.navigate('applicant-intake')">Apply</button>
            </div>

            <button type="button" class="auth-nav-link" onclick="window.JOIApp.navigate('landing')">
              &larr; Return to Academy Portal Gateway
            </button>
          </div>
        </div>
      </section>
    `;
  }

  // =========================================================================
  // VIEW 3: STUDENTS ACCESS MODULE (Matches Image 3 Mockup)
  // =========================================================================
  function renderStudentsAuthView() {
    const pwType = state.authInput.showPassword ? 'text' : 'password';
    return `
      <section class="campus-stage auth-tint">
        <div class="stage-content">
          <h1 class="auth-module-heading">Students Access Module</h1>

          <div class="auth-card">
            <div class="auth-card-title">User Authentication</div>

            <div class="auth-field-group">
              <label class="auth-field-label" for="stu-id-input">Student ID No.:</label>
              <div class="auth-input-wrap">
                <input
                  id="stu-id-input"
                  type="text"
                  class="auth-input"
                  value="${escapeHtml(state.authInput.identifier)}"
                  oninput="window.JOIApp.setAuthField('identifier', this.value)"
                  autocomplete="username"
                  autofocus
                />
              </div>
            </div>

            <div class="auth-field-group">
              <label class="auth-field-label" for="stu-password-input">Password:</label>
              <div class="auth-input-wrap">
                <input
                  id="stu-password-input"
                  type="${pwType}"
                  class="auth-input"
                  value="${escapeHtml(state.authInput.password)}"
                  oninput="window.JOIApp.setAuthField('password', this.value)"
                  onkeydown="if(event.key==='Enter') window.JOIApp.submitAuth('student')"
                  autocomplete="current-password"
                />
                <button type="button" class="eye-toggle-btn" onclick="window.JOIApp.togglePassword()" title="Toggle Password Visibility">
                  ${renderEyeSvg(state.authInput.showPassword)}
                </button>
              </div>
            </div>

            <div class="auth-btn-row">
              <button type="button" class="auth-action-btn" onclick="window.JOIApp.clearAuth()">Clear</button>
              <button type="button" class="auth-action-btn" onclick="window.JOIApp.submitAuth('student')">Enter</button>
            </div>

            <button type="button" class="auth-nav-link" onclick="window.JOIApp.navigate('landing')">
              &larr; Return to Academy Portal Gateway
            </button>
          </div>
        </div>
      </section>
    `;
  }

  // =========================================================================
  // VIEW 4: SCHOOL ACCESS MODULE (Two-Step: Employee ID Gate + Email/Password)
  // =========================================================================
  function renderFacultyAuthView() {
    const pwType = state.authInput.showPassword ? 'text' : 'password';
    const verified = state.authInput.staffVerified;
    return `
      <section class="campus-stage auth-tint">
        <div class="stage-content">
          <h1 class="auth-module-heading">School Access Module</h1>

          <div class="auth-card">
            <div class="auth-card-title">Two-Step Verified Staff Authentication</div>

            <div class="auth-field-group">
              <label class="auth-field-label" for="staff-empcode-input">Step 1 &mdash; Employee ID / Code (e.g., ADM-001, REG-001, FIN-001, FAC-001):</label>
              <div style="display:flex;gap:8px;align-items:center;">
                <input
                  id="staff-empcode-input"
                  type="text"
                  class="auth-input"
                  value="${escapeHtml(state.authInput.staffEmpCode)}"
                  placeholder="Enter Employee ID (e.g. REG-001)"
                  oninput="window.JOIApp.setAuthField('staffEmpCode', this.value)"
                  onkeydown="if(event.key==='Enter') window.JOIApp.verifyStaffEmployeeId()"
                  ${verified ? 'readonly' : 'autofocus'}
                />
                ${verified
                  ? `<button type="button" class="auth-action-btn" onclick="window.JOIApp.resetStaffVerification()" style="white-space:nowrap;">Change</button>`
                  : `<button type="button" class="auth-action-btn" onclick="window.JOIApp.verifyStaffEmployeeId()" style="white-space:nowrap;">Verify ID</button>`
                }
              </div>
            </div>

            ${verified ? `
              <div class="staff-verified-badge">
                <div>
                  <strong>Employee Verified:</strong> ${escapeHtml(verified.maskedName)}
                  <span class="role-pill">Role Detected: ${escapeHtml(verified.role)}</span>
                </div>
                <div style="margin-top:4px;color:#475569;font-size:11.5px;">
                  ${escapeHtml(verified.position || verified.role)} &bull; ${escapeHtml(verified.department || 'J.O.I Academy')}
                </div>
              </div>

              <div class="auth-field-group">
                <label class="auth-field-label" for="staff-email-input">Step 2 &mdash; Institutional Email:</label>
                <div class="auth-input-wrap">
                  <input
                    id="staff-email-input"
                    type="email"
                    class="auth-input"
                    value="${escapeHtml(state.authInput.staffEmail)}"
                    placeholder="staff@joi.edu.ph"
                    oninput="window.JOIApp.setAuthField('staffEmail', this.value)"
                    autocomplete="email"
                    autofocus
                  />
                </div>
              </div>

              <div class="auth-field-group">
                <label class="auth-field-label" for="staff-password-input">Password:</label>
                <div class="auth-input-wrap">
                  <input
                    id="staff-password-input"
                    type="${pwType}"
                    class="auth-input"
                    value="${escapeHtml(state.authInput.password)}"
                    oninput="window.JOIApp.setAuthField('password', this.value)"
                    onkeydown="if(event.key==='Enter') window.JOIApp.submitAuth('staff')"
                    autocomplete="current-password"
                  />
                  <button type="button" class="eye-toggle-btn" onclick="window.JOIApp.togglePassword()" title="Toggle Password Visibility">
                    ${renderEyeSvg(state.authInput.showPassword)}
                  </button>
                </div>
              </div>

              <div class="auth-btn-row">
                <button type="button" class="auth-action-btn" onclick="window.JOIApp.clearAuth()">Clear</button>
                <button type="button" class="auth-action-btn" onclick="window.JOIApp.submitAuth('staff')">Sign In</button>
              </div>
            ` : `
              <p class="auth-applicant-notice" style="margin-top:10px;margin-bottom:4px;">
                Enter your assigned Employee ID first. Your department and role (<strong>ADMIN</strong>, <strong>REGISTRAR</strong>, <strong>FINANCE</strong>, or <strong>FACULTY</strong>) will be auto-detected before credential entry.
              </p>
            `}

            <button type="button" class="auth-nav-link" onclick="window.JOIApp.navigate('landing')">
              &larr; Return to Academy Portal Gateway
            </button>
          </div>
        </div>
      </section>
    `;
  }

  function renderEyeSvg(isOpen) {
    if (isOpen) {
      return `<svg width="20" height="14" viewBox="0 0 24 16" fill="none" stroke="#111" stroke-width="1.8">
        <path d="M1 8C3.8 2.8 8 1 12 1C16 1 20.2 2.8 23 8C20.2 13.2 16 15 12 15C8 15 3.8 13.2 1 8Z"/>
        <circle cx="12" cy="8" r="3.5" fill="#111"/>
      </svg>`;
    }
    return `<svg width="20" height="14" viewBox="0 0 24 16" fill="none" stroke="#111" stroke-width="1.8">
      <path d="M1 8C3.8 2.8 8 1 12 1C16 1 20.2 2.8 23 8C20.2 13.2 16 15 12 15C8 15 3.8 13.2 1 8Z"/>
      <circle cx="12" cy="8" r="3.2"/>
    </svg>`;
  }

  // =========================================================================
  // VIEW 5: 4-PAGE DIGITAL APPLICANT INTAKE WIZARD + MANDATORY REVIEW (FR-001, FR-002, NFR-006, NFR-007)
  // =========================================================================
  function renderApplicantIntakeWizard() {
    const d = state.intakeDraft;
    const step = d.step || 1;
    const steps = [
      { num: 1, label: '1. Personal Details' },
      { num: 2, label: '2. Educational Background' },
      { num: 3, label: '3. Family Information' },
      { num: 4, label: '4. Document Uploads' },
      { num: 5, label: '5. Review & Confirm' }
    ];

    let stepBody = '';
    if (step === 1) {
      stepBody = `
        <div class="alert-banner alert-info">
          <div>
            <strong>Step 1 of 4 — Personal Profile &amp; Degree Selection :</strong>
            Enter your legal name and contact information as they appear on your PSA Birth Certificate.
          </div>
          <span class="badge badge-info"></span>
        </div>

        <div class="form-grid">
          <div class="form-field">
            <label>Applicant Classification </label>
            <select onchange="window.JOIApp.updateDraft('personal','applicantType',this.value)">
              <option value="Applicant" ${d.personal.applicantType === 'Applicant' ? 'selected' : ''}>New Applicant (Freshman)</option>
              <option value="Transferee" ${d.personal.applicantType === 'Transferee' ? 'selected' : ''}>Transferee Applicant</option>
            </select>
          </div>
          <div class="form-field">
            <label>Degree Program Applying For </label>
            <select onchange="window.JOIApp.updateDraftRoot('courseId', Number(this.value))">
              ${(function () {
                const courses = (state.publicCourses && state.publicCourses.length > 0) ? state.publicCourses : (window.JOI_FALLBACK_COURSES || []);
                return courses.map((c) => {
                  const id = c.lngCourseID !== undefined ? c.lngCourseID : c[0];
                  const code = c.strCourseCode !== undefined ? c.strCourseCode : c[1];
                  const desc = c.strCourseDescription !== undefined ? c.strCourseDescription : c[2];
                  return `<option value="${id}" ${Number(d.courseId) === Number(id) ? 'selected' : ''}>${escapeHtml(code)} — ${escapeHtml(desc)}</option>`;
                }).join('');
              })()}
            </select>
          </div>
          <div class="form-field">
            <label>Title </label>
            <select onchange="window.JOIApp.updateDraft('personal','title',this.value)">
              <option value="Mr." ${d.personal.title === 'Mr.' ? 'selected' : ''}>Mr.</option>
              <option value="Ms." ${d.personal.title === 'Ms.' ? 'selected' : ''}>Ms.</option>
              <option value="Mx." ${d.personal.title === 'Mx.' ? 'selected' : ''}>Mx.</option>
            </select>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-field">
            <label>First Name </label>
            <input type="text" value="${escapeHtml(d.personal.firstName)}" placeholder="e.g. Maria Clara" oninput="this.value=this.value.replace(/[^a-zA-ZÀ-ÿ\s-]/g,'');window.JOIApp.updateDraft('personal','firstName',this.value)" />
          </div>
          <div class="form-field">
            <label>Middle Name</label>
            <input type="text" value="${escapeHtml(d.personal.middleName)}" placeholder="e.g. Santos" oninput="this.value=this.value.replace(/[^a-zA-ZÀ-ÿ\s-]/g,'');window.JOIApp.updateDraft('personal','middleName',this.value)" />
          </div>
          <div class="form-field">
            <label>Last Name </label>
            <input type="text" value="${escapeHtml(d.personal.lastName)}" placeholder="e.g. Reyes" oninput="this.value=this.value.replace(/[^a-zA-ZÀ-ÿ\s-]/g,'');window.JOIApp.updateDraft('personal','lastName',this.value)" />
          </div>
          <div class="form-field">
            <label>Date of Birth </label>
            <input type="date" value="${escapeHtml(d.personal.dob)}" oninput="window.JOIApp.updateDraft('personal','dob',this.value)" />
          </div>
        </div>

        <div class="form-grid">
          <div class="form-field">
            <label>Email Address </label>
            <input type="email" value="${escapeHtml(d.personal.email)}" placeholder="applicant@email.com" oninput="window.JOIApp.updateDraft('personal','email',this.value)" />
          </div>
          <div class="form-field">
            <label>Mobile Telephone </label>
            <input type="tel" inputmode="numeric" class="tel-only" data-section="personal" data-key="telephone" value="${escapeHtml(d.personal.telephone)}" placeholder="e.g. 09175550192" />
          </div>
          <div class="form-field">
            <label>Alternate Telephone </label>
            <input type="tel" inputmode="numeric" class="tel-only" data-section="personal" data-key="altTelephone" value="${escapeHtml(d.personal.altTelephone)}" placeholder="e.g. 0288124400" />
          </div>
        </div>

        <div class="form-grid">
          <div class="form-field">
            <label>Street Address 1 </label>
            <input type="text" value="${escapeHtml(d.personal.address1)}" oninput="window.JOIApp.updateDraft('personal','address1',this.value)" />
          </div>
          <div class="form-field">
            <label>Village / Barangay </label>
            <input type="text" value="${escapeHtml(d.personal.address2)}" oninput="window.JOIApp.updateDraft('personal','address2',this.value)" />
          </div>
          <div class="form-field">
            <label>City </label>
            <input type="text" value="${escapeHtml(d.personal.city)}" oninput="window.JOIApp.updateDraft('personal','city',this.value)" />
          </div>
          <div class="form-field">
            <label>Postal Code </label>
            <input type="text" value="${escapeHtml(d.personal.postCode)}" oninput="window.JOIApp.updateDraft('personal','postCode',this.value)" />
          </div>
        </div>

        <div class="form-grid" style="padding-top:10px;border-top:1px solid #e2e8f0;">
          <div class="form-field">
            <label>Create Applicant Portal Username </label>
            <input type="text" value="${escapeHtml(d.username)}" placeholder="e.g. maria.reyes" oninput="window.JOIApp.updateDraftRoot('username',this.value)" />
          </div>
          <div class="form-field">
            <label>Create Portal Password </label>
            <div style="position:relative;display:flex;align-items:center;">
              <input type="password" id="intake-password-input" value="${escapeHtml(d.password)}" placeholder="Minimum 6 characters" oninput="window.JOIApp.updateDraftRoot('password',this.value)" style="flex:1;padding-right:30px;" data-show="false" />
              <button type="button" onclick="window.JOIApp.toggleIntakePassword()" style="position:absolute;right:4px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:4px;width:24px;height:24px;cursor:pointer;font-size:12px;line-height:1;display:flex;align-items:center;justify-content:center;">🙈</button>
            </div>
          </div>
        </div>
      `;
    } else if (step === 2) {
      stepBody = `
        <div class="alert-banner alert-info">
          <div>
            <strong>Step 2 of 4 — Educational Background:</strong>
            Provide your Senior High School (or previous college for transferees) academic credentials for Registrar evaluation.
          </div>
        </div>
        <div class="form-grid">
          <div class="form-field">
            <label>Senior High School / Last School Attended </label>
            <input type="text" value="${escapeHtml(d.education.highSchool)}" placeholder="e.g. Makati Science High School" oninput="this.value=this.value.replace(/[^a-zA-ZÀ-ÿ -]/g,'');window.JOIApp.updateDraft('education','highSchool',this.value)" />
          </div>
          <div class="form-field">
            <label>Learner Reference Number (LRN)</label>
            <input type="text" class="lrn-only" data-section="education" data-key="lrn" value="${escapeHtml(d.education.lrn)}" placeholder="12-digit DepEd LRN" />
          </div>
          <div class="form-field">
            <label>SHS Academic Track / Strand</label>
            <select onchange="window.JOIApp.updateDraft('education','strand',this.value)">
              <option value="STEM" ${d.education.strand.includes('STEM') ? 'selected' : ''}>STEM (Science, Technology, Engineering &amp; Math)</option>
              <option value="ABM" ${d.education.strand.includes('ABM') ? 'selected' : ''}>ABM (Accountancy, Business &amp; Management)</option>
              <option value="HUMSS" ${d.education.strand.includes('HUMSS') ? 'selected' : ''}>HUMSS</option>
              <option value="ICT / TVL" ${d.education.strand.includes('ICT') ? 'selected' : ''}>TVL - Information &amp; Communications Technology</option>
            </select>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-field">
            <label>Year Graduated</label>
            <input type="text" value="${escapeHtml(d.education.gradYear)}" oninput="window.JOIApp.updateDraft('education','gradYear',this.value)" />
          </div>
          <div class="form-field">
            <label>General Weighted Average (GWA %)</label>
            <input type="text" value="${escapeHtml(d.education.gwa)}" oninput="this.value=this.value.replace(/[^0-9.]/g,'');window.JOIApp.updateDraft('education','gwa',this.value)" />
          </div>
          <div class="form-field">
            <label>Academic Honors / Distinction</label>
            <input type="text" value="${escapeHtml(d.education.honors)}" oninput="window.JOIApp.updateDraft('education','honors',this.value)" />
          </div>
        </div>
      `;
    } else if (step === 3) {
      stepBody = `
        <div class="alert-banner alert-info">
          <div>
            <strong>Step 3 of 4 — Family &amp; Emergency Guardian Information:</strong>
            Required for scholarship evaluation, emergency contact notifications, and Promissory Note co-maker verification.
          </div>
        </div>
        <div class="form-grid">
          <div class="form-field">
            <label>Father's Full Name</label>
            <input type="text" class="name-only" data-section="family" data-key="fatherName" value="${escapeHtml(d.family.fatherName)}" placeholder="e.g. Roberto Reyes" />
          </div>
          <div class="form-field">
            <label>Father's Occupation</label>
            <input type="text" class="name-only" data-section="family" data-key="fatherOccupation" value="${escapeHtml(d.family.fatherOccupation)}" placeholder="e.g. Mechanical Engineer" />
          </div>
          <div class="form-field">
            <label>Mother's Full Name</label>
            <input type="text" class="name-only" data-section="family" data-key="motherName" value="${escapeHtml(d.family.motherName)}" placeholder="e.g. Teresa Santos-Reyes" />
          </div>
          <div class="form-field">
            <label>Mother's Occupation</label>
            <input type="text" class="name-only" data-section="family" data-key="motherOccupation" value="${escapeHtml(d.family.motherOccupation)}" placeholder="e.g. Certified Public Accountant" />
          </div>
        </div>
        <div class="form-grid">
          <div class="form-field">
            <label>Primary Emergency Guardian Contact No. *</label>
            <input type="tel" class="tel-only" data-section="family" data-key="guardianPhone" value="${escapeHtml(d.family.guardianPhone)}" placeholder="e.g. 09178880144" />
          </div>
          <div class="form-field">
            <label>Household Annual Income Bracket</label>
            <select onchange="window.JOIApp.updateDraft('family','annualIncome',this.value)">
              <option value="Below PHP 300,000">Below PHP 300,000</option>
              <option value="PHP 300,000 - PHP 600,000">PHP 300,000 - PHP 600,000</option>
              <option value="PHP 600,000 - PHP 900,000" selected>PHP 600,000 - PHP 900,000</option>
              <option value="Above PHP 900,000">Above PHP 900,000</option>
            </select>
          </div>
        </div>
      `;
    } else if (step === 4) {
      stepBody = `
        <div class="alert-banner alert-info">
          <div>
            <strong>Step 4 of 4 — Digital Admission Document Uploads:</strong>
            Upload digital copies of your required credentials (Form 138, Transcript of Records, Good Moral Certificate). These are routed directly to the Registrar Office for online review .
          </div>
        </div>

        <div class="data-table-wrap" style="margin-bottom:16px;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Requirement Type</th>
                <th>Selected Digital File</th>
                <th>File Size</th>
                <th>Upload Action</th>
              </tr>
            </thead>
            <tbody>
              ${d.documents.map((doc, idx) => `
                <tr>
                  <td><strong>${escapeHtml(doc.docType)}</strong></td>
                  <td><code>${escapeHtml(doc.fileName)}</code></td>
                  <td>${escapeHtml(doc.fileSize)}</td>
                  <td>
                    <label class="btn btn-outline btn-sm" style="cursor:pointer;">
                      Choose File
                      <input type="file" style="display:none;" onchange="window.JOIApp.handleIntakeFileSelect(${idx}, this)" />
                    </label>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else if (step === 5) {
      const selectedCourse = state.publicCourses.find((c) => Number(c.lngCourseID) === Number(d.courseId)) || { strCourseCode: 'BSCOE', strCourseDescription: 'BS Computer Engineering' };
      stepBody = `
        <div class="alert-banner alert-inc">
          <div>
            <strong>Mandatory Review &amp; Confirm Step:</strong>
            Please verify all information across the 4 intake pages below before final submission. Once submitted, returning student profile fields are locked against unauthorized edits.
          </div>
        </div>

        <div class="form-grid" style="background:#f8fafc;padding:16px;border-radius:10px;border:1px solid #cbd5e1;">
          <div>
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Applicant Name &amp; Type</div>
            <div style="font-size:14px;font-weight:700;margin-top:2px;">${escapeHtml(d.personal.title)} ${escapeHtml(d.personal.firstName)} ${escapeHtml(d.personal.middleName)} ${escapeHtml(d.personal.lastName)} (${escapeHtml(d.personal.applicantType)})</div>
          </div>
          <div>
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Selected Degree Program</div>
            <div style="font-size:14px;font-weight:700;margin-top:2px;">${escapeHtml(selectedCourse.strCourseCode)} — ${escapeHtml(selectedCourse.strCourseDescription)}</div>
          </div>
          <div>
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Contact &amp; Address</div>
            <div style="font-size:13px;margin-top:2px;">${escapeHtml(d.personal.email || 'N/A')} &bull; ${escapeHtml(d.personal.telephone || 'N/A')}<br/>${escapeHtml(d.personal.address1)}, ${escapeHtml(d.personal.city)}</div>
          </div>
          <div>
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Educational Background</div>
            <div style="font-size:13px;margin-top:2px;">${escapeHtml(d.education.highSchool || 'Not specified')} (${escapeHtml(d.education.strand)}) &bull; GWA: ${escapeHtml(d.education.gwa)}</div>
          </div>
          <div>
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Attached Admission Documents (${d.documents.length})</div>
            <div style="font-size:12.5px;margin-top:2px;">${d.documents.map((x) => escapeHtml(x.fileName)).join(', ')}</div>
          </div>
          <div>
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Portal Login Username</div>
            <div style="font-size:14px;font-weight:700;color:var(--joi-navy);margin-top:2px;">${escapeHtml(d.username || '(Please set on Step 1)')}</div>
          </div>
        </div>

        <label style="display:flex;align-items:center;gap:10px;margin-top:16px;font-size:13.5px;font-weight:600;cursor:pointer;">
          <input type="checkbox" ${d.confirmedReview ? 'checked' : ''} onchange="window.JOIApp.updateDraftRoot('confirmedReview', this.checked)" style="width:18px;height:18px;" />
          I certify that all personal, academic, family, and digital document submissions are true and accurate.
        </label>
      `;
    }

    return `
      <section class="campus-stage auth-tint">
        <div class="stage-content">
          <div class="wizard-container">
            <div class="wizard-header">
              <div>
                <h2>Jewel of Intellect Academy — 4-Page Digital Applicant Intake Form</h2>
                <p>121 H.V. Dela Costa Street, Salcedo Village, Barangay Bel-Air, Makati City &bull; AY 2026–2027</p>
              </div>
              <div>
                <button class="btn btn-outline btn-sm" onclick="window.JOIApp.navigate('applicants-auth')">Back to Login</button>
              </div>
            </div>

            <div class="wizard-steps-bar">
              ${steps.map((s) => `
                <div class="wizard-step-item ${step === s.num ? 'active' : (step > s.num ? 'completed' : '')}" onclick="window.JOIApp.setWizardStep(${s.num})">
                  ${s.label}
                </div>
              `).join('')}
            </div>

            <div class="wizard-body">
              ${stepBody}
            </div>

            <div class="wizard-footer">
              <div>
                ${step > 1 ? `<button class="btn btn-outline" onclick="window.JOIApp.setWizardStep(${step - 1})">&larr; Previous Page</button>` : `<span></span>`}
              </div>
              <div style="display:flex;gap:10px;">
                ${step < 5
                  ? `<button class="btn btn-primary" onclick="window.JOIApp.setWizardStep(${step + 1})">Save &amp; Continue to Page ${step + 1} &rarr;</button>`
                  : `<button class="btn btn-gold" onclick="window.JOIApp.submitApplicantIntake()">Confirm &amp; Submit Application</button>`
                }
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  // =========================================================================
  // VIEW 6: STUDENT & APPLICANT PORTAL WORKSPACE
  // =========================================================================
  function renderStudentPortal() {
    const b = state.studentBundle;
    if (!b) return `<div style="padding:40px;color:#fff;text-align:center;">Loading Student Portal...</div>`;
    const stu = b.student;
    const assess = b.assessment;
    const totalUnits = b.enrolledSubjects.reduce((acc, s) => acc + (s.intUnits || 0), 0);

    const statusBadgeClass = stu.strEnrollmentStatus.includes('Officially Enrolled')
      ? 'badge-success'
      : (stu.strEnrollmentStatus.includes('Conditional') ? 'badge-warning' : 'badge-info');

    const tabs = [
      { id: 'overview', label: 'Dashboard & Schedule' },
      { id: 'courses', label: `Course Selection & Advising ${totalUnits}/24 Units` },
      { id: 'payments', label: 'Online QR Payment & Promissory Note' },
      { id: 'documents', label: `Admission Documents ${b.documents.length}` },
      { id: 'profile', label: 'Student Profile' },
      { id: 'contacts', label: `Official Notices & Inquiries ${b.contacts.length}` }
    ];

    let tabContent = '';

    if (state.studentTab === 'overview') {
      tabContent = `
        ${stu.ysnHasINC ? `
          <div class="alert-banner alert-inc">
            <div>
              <strong>FR-004 Conditional Enrollment Active — Incomplete (INC) Grade Grace Period:</strong><br/>
              Record shows an active <strong>INC</strong> in <code>${escapeHtml(stu.strINCSubject)}</code> incurred on <strong>${escapeHtml(stu.dteINCIncurred)}</strong>.
              Under Academy policy, you are granted a <strong>1-Academic-Year Grace Period (Deadline: March 15, 2027)</strong> to complete missing requirements while conditionally enrolling in non-dependent subjects.
              Department Dean Pre-Registration Release Status: <strong>${stu.ysnDeanPreRegReleased ? 'RELEASED (Cleared for Payment)' : 'PENDING DEAN RELEASE'}</strong>.
            </div>
          </div>
        ` : ''}

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Enrollment Status</div>
            <div class="kpi-value" style="font-size:18px;">
              <span class="badge ${statusBadgeClass}" style="font-size:13px;padding:5px 12px;">${escapeHtml(stu.strEnrollmentStatus)}</span>
            </div>
            <div class="kpi-sub">${escapeHtml(stu.strSemester)} &bull; Year ${stu.intYearLevel}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Degree Program</div>
            <div class="kpi-value" style="font-size:18px;">${escapeHtml(stu.strCourseCode || 'BSCOE')}</div>
            <div class="kpi-sub">${escapeHtml(stu.strCourseDescription || 'BS Computer Engineering')}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Enrolled Credit Units</div>
            <div class="kpi-value">${totalUnits} <span style="font-size:14px;color:#64748b;">/ 24 Max Units</span></div>
            <div class="kpi-sub">${b.enrolledSubjects.length} subjects loaded</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Outstanding Balance</div>
            <div class="kpi-value" style="color:${assess.balance > 0 ? '#b45309' : '#157347'};">${formatPHP(assess.balance)}</div>
            <div class="kpi-sub">Total Assessment: ${formatPHP(assess.grossAssessment)}</div>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-header">
            <h3>Official Class Schedule, Room &amp; Professor Assignment ${escapeHtml(stu.strSemester)}</h3>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-outline btn-sm" onclick="window.print()">Print Pre-Registration / Assessment Form</button>
              <button class="btn btn-primary btn-sm" onclick="window.JOIApp.setStudentTab('courses')">Modify Subject Load</button>
            </div>
          </div>
          <div class="panel-body">
            <div class="data-table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Subject Code</th>
                    <th>Subject Description</th>
                    <th>Section</th>
                    <th>Units</th>
                    <th>Schedule</th>
                    <th>Assigned Room</th>
                    <th>Professor</th>
                    <th>Status / Grade</th>
                  </tr>
                </thead>
                <tbody>
                  ${b.enrolledSubjects.length === 0 ? `
                    <tr><td colspan="8" style="text-align:center;color:#64748b;padding:24px;">No subjects selected yet. Go to <strong>Course Selection &amp; Advising</strong> to add subjects.</td></tr>
                  ` : b.enrolledSubjects.map((s) => `
                    <tr>
                      <td><strong>${escapeHtml(s.strSubjectCode)}</strong></td>
                      <td>${escapeHtml(s.strSubjectTitle)}</td>
                      <td><span class="badge badge-navy">${escapeHtml(s.strSectionName)}</span></td>
                      <td>${s.intUnits}</td>
                      <td>${escapeHtml(s.strSchedule)}</td>
                      <td>${escapeHtml(s.strRoom)}</td>
                      <td>${escapeHtml(s.strProfessorName || 'TBA')}</td>
                      <td>
                        <span class="badge ${s.strStatus.includes('Conditional') || s.strGrade.includes('INC') ? 'badge-warning' : 'badge-success'}">
                          ${escapeHtml(s.strStatus)} ${escapeHtml(s.strGrade)}
                        </span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } else if (state.studentTab === 'courses') {
      const enrolledIds = new Set(b.enrolledSubjects.map((x) => x.lngSectionID));
      tabContent = `
        <div class="alert-banner alert-info">
          <div>
            <strong>Automated Prerequisite, Unit-Load &amp; Capacity Control Engine:</strong>
            The system automatically verifies prerequisite subjects, enforces the <strong>24-unit maximum load limit</strong>, checks <strong>INC grace-period restrictions (FR-004)</strong>, and locks class sections immediately when maximum capacity is reached.
          </div>
          <span class="badge badge-navy">Current Load: ${totalUnits} / 24 Units</span>
        </div>

        <div class="panel-card">
          <div class="panel-header">
            <h3>Current Pre-Registered / Enrolled Subject Load</h3>
          </div>
          <div class="panel-body">
            <div class="data-table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Title</th>
                    <th>Section</th>
                    <th>Units</th>
                    <th>Schedule &amp; Room</th>
                    <th>Tuition + Lab Fee</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${b.enrolledSubjects.map((s) => `
                    <tr>
                      <td><strong>${escapeHtml(s.strSubjectCode)}</strong></td>
                      <td>${escapeHtml(s.strSubjectTitle)}</td>
                      <td>${escapeHtml(s.strSectionName)}</td>
                      <td>${s.intUnits}</td>
                      <td>${escapeHtml(s.strSchedule)} &bull; ${escapeHtml(s.strRoom)}</td>
                      <td>${formatPHP(s.intUnits * s.curPerUnitFee + s.curLabFee)}</td>
                      <td>
                        <button class="btn btn-danger btn-sm" onclick="window.JOIApp.dropSubject(${s.lngLoadID})">Drop</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-header">
            <h3>Available Course Section Offerings (Real-Time Capacity &amp; Prerequisite Check)</h3>
          </div>
          <div class="panel-body">
            <div class="data-table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Subject Code</th>
                    <th>Subject Title</th>
                    <th>Section</th>
                    <th>Units</th>
                    <th>Prerequisite</th>
                    <th>Schedule &amp; Room</th>
                    <th>Professor</th>
                    <th>Section Capacity (NFR-005)</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${b.allSections.map((sec) => {
                    const isFull = sec.intEnrolledCount >= sec.intMaxCapacity;
                    const alreadyIn = enrolledIds.has(sec.lngSectionID);
                    const hasIncBlock = stu.ysnHasINC && sec.strPrerequisiteCode !== 'NONE' && stu.strINCSubject.includes(sec.strPrerequisiteCode);
                    return `
                      <tr>
                        <td><strong>${escapeHtml(sec.strSubjectCode)}</strong></td>
                        <td>${escapeHtml(sec.strSubjectTitle)}</td>
                        <td><span class="badge badge-navy">${escapeHtml(sec.strSectionName)}</span></td>
                        <td>${sec.intUnits}</td>
                        <td><code>${escapeHtml(sec.strPrerequisiteCode)}</code></td>
                        <td>${escapeHtml(sec.strSchedule)}<br/><small style="color:#64748b;">${escapeHtml(sec.strRoom)}</small></td>
                        <td>${escapeHtml(sec.strProfessorName || 'TBA')}</td>
                        <td>
                          <span class="badge ${isFull ? 'badge-danger' : 'badge-success'}">
                            ${sec.intEnrolledCount} / ${sec.intMaxCapacity} ${isFull ? 'LOCKED' : 'OPEN'}
                          </span>
                        </td>
                        <td>
                          ${alreadyIn
                            ? `<span class="badge badge-info">Added</span>`
                            : `<button class="btn ${isFull || hasIncBlock ? 'btn-outline' : 'btn-primary'} btn-sm" onclick="window.JOIApp.enrollSubject(${sec.lngSectionID})">
                                ${isFull ? 'Locked' : (hasIncBlock ? 'Blocked by INC' : '+ Add Section')}
                              </button>`
                          }
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } else if (state.studentTab === 'payments') {
      const refPreview = `JOI-QR-2026-${10000 + stu.lngStudentID * 337}`;
      const amountToPay = assess.balance > 0 ? assess.balance : assess.grossAssessment;
      const qrPayload = `JOI-ACADEMY|STU:${stu.strStudentNo}|AMT:${amountToPay.toFixed(2)}|REF:${refPreview}`;

      tabContent = `
        <div class="panel-card">
          <div class="panel-header">
            <h3>Online QR Payment &amp; Itemized Financial Assessment Breakdown</h3>
            <span class="badge ${assess.balance === 0 ? 'badge-success' : 'badge-warning'}">
              ${assess.balance === 0 ? 'Fully Settled' : `Outstanding: ${formatPHP(assess.balance)}`}
            </span>
          </div>
          <div class="panel-body">
            <div class="qr-payment-grid">
              <div class="qr-card">
                <div style="font-weight:700;font-size:13px;color:var(--joi-navy-dark);margin-bottom:8px;">
                  JOI ACADEMY DYNAMIC QR PH
                </div>
                <img src="assets/onlinepayment.jpg" alt="JOI Academy QR Code" style="width: 190px; height: 190px; object-fit: contain; border-radius: 12px; display: block; margin: 0 auto;" />
                <div style="font-size:11px;color:#475569;margin-top:8px;word-break:break-all;">
                  <code>${escapeHtml(qrPayload)}</code>
                </div>
                <div style="margin-top:10px;">
                  <span class="badge badge-navy">GCash &bull; Maya &bull; InstaPay</span>
                </div>
              </div>

              <div>
                <h4 style="margin-bottom:10px;color:var(--joi-navy-dark);">Itemized Semester Fee Breakdown</h4>
                <table class="data-table" style="margin-bottom:18px;">
                  <tbody>
                    <tr>
                      <td>Tuition Fees ${totalUnits} Credit Units &times; PHP 1,850.00</td>
                      <td style="text-align:right;font-weight:600;">${formatPHP(assess.tuitionTotal)}</td>
                    </tr>
                    <tr>
                      <td>Computer &amp; Engineering Laboratory Fees</td>
                      <td style="text-align:right;font-weight:600;">${formatPHP(assess.labTotal)}</td>
                    </tr>
                    <tr>
                      <td>Miscellaneous, Library, Medical &amp; Registration Fees</td>
                      <td style="text-align:right;font-weight:600;">${formatPHP(assess.miscFee)}</td>
                    </tr>
                    <tr style="background:#f8fafc;">
                      <td><strong>Gross Semester Assessment</strong></td>
                      <td style="text-align:right;font-weight:700;color:var(--joi-navy-dark);">${formatPHP(assess.grossAssessment)}</td>
                    </tr>
                    <tr>
                      <td>Less: Verified QR Payments</td>
                      <td style="text-align:right;font-weight:600;color:var(--joi-success);">- ${formatPHP(assess.verifiedPayments)}</td>
                    </tr>
                    <tr style="background:#fff8e6;">
                      <td><strong>Net Outstanding Balance</strong></td>
                      <td style="text-align:right;font-weight:700;font-size:15px;color:#b45309;">${formatPHP(assess.balance)}</td>
                    </tr>
                  </tbody>
                </table>

                <div style="background:#f8fafc;padding:16px;border-radius:10px;border:1px solid #cbd5e1;">
                  <h4 style="font-size:13.5px;margin-bottom:10px;color:var(--joi-navy-dark);">Submit QR Payment Transaction Receipt</h4>
                  <div class="form-grid">
                    <div class="form-field">
                      <label>Amount Paid (PHP)</label>
                      <input id="qr-pay-amount" type="number" step="0.01" value="${amountToPay}" />
                    </div>
                    <div class="form-field">
                      <label>QR Payment Channel</label>
                      <select id="qr-pay-method">
                        <option value="QR Ph Dynamic (GCash)">QR Ph Dynamic (GCash)</option>
                        <option value="QR Ph Dynamic (Maya)">QR Ph Dynamic (Maya)</option>
                        <option value="QR Ph Dynamic (BPI / InstaPay)">QR Ph Dynamic (BPI / InstaPay)</option>
                      </select>
                    </div>
                    <div class="form-field">
                      <label>Upload Digital Receipt Screenshot</label>
                      <input id="qr-pay-receipt" type="text" value="QR_Receipt_${stu.strStudentNo}.png" />
                    </div>
                  </div>
                  <button class="btn btn-primary" onclick="window.JOIApp.submitStudentQRPayment()">
                    Submit QR Payment Receipt for Finance Verification
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-header">
            <h3>Submitted QR Payment History &amp; Promissory Notes (FR-005)</h3>
          </div>
          <div class="panel-body">
            <div class="data-table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Reference No.</th>
                    <th>Payment Method</th>
                    <th>Amount</th>
                    <th>Receipt File</th>
                    <th>Status</th>
                    <th>Verified By / Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  ${b.payments.map((p) => `
                    <tr>
                      <td><code>${escapeHtml(p.strReferenceNo)}</code></td>
                      <td>${escapeHtml(p.strPaymentMethod)}</td>
                      <td><strong>${formatPHP(p.curAmount)}</strong></td>
                      <td>${escapeHtml(p.strReceiptFileName)}</td>
                      <td>
                        <span class="badge ${p.strStatus.includes('Paid') ? 'badge-success' : (p.strStatus.includes('Pending') ? 'badge-warning' : 'badge-danger')}">
                          ${escapeHtml(p.strStatus)}
                        </span>
                      </td>
                      <td>${escapeHtml(p.strVerifierName || 'Pending Finance Review')} &mdash; ${escapeHtml(p.strRemarks)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            ${b.promissoryNotes.length > 0 ? `
              <h4 style="margin:18px 0 10px;color:var(--joi-navy-dark);">Recorded Promissory Notes (FR-005)</h4>
              <div class="data-table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Promissory Note Ref</th>
                      <th>Covered Amount</th>
                      <th>Agreement Terms</th>
                      <th>Deferred Due Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${b.promissoryNotes.map((pn) => `
                      <tr>
                        <td><code>${escapeHtml(pn.strNoteReferenceNo)}</code></td>
                        <td><strong>${formatPHP(pn.curCoveredAmount)}</strong></td>
                        <td>${escapeHtml(pn.strAgreementTerms)}</td>
                        <td>${escapeHtml(pn.dteDeferredDueDate)}</td>
                        <td><span class="badge badge-success">${escapeHtml(pn.strStatus)}</span></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } else if (state.studentTab === 'documents') {
      tabContent = `
        <div class="panel-card">
          <div class="panel-header">
            <h3>Digital Admission Documents &amp; Registrar Verification Status (FR-002, FR-003)</h3>
          </div>
          <div class="panel-body">
            <div class="data-table-wrap" style="margin-bottom:20px;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Document Type</th>
                    <th>Digital File Name</th>
                    <th>Size</th>
                    <th>Verification Status</th>
                    <th>Registrar Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  ${b.documents.map((d) => `
                    <tr>
                      <td><strong>${escapeHtml(d.strDocType)}</strong></td>
                      <td><code>${escapeHtml(d.strFileName)}</code></td>
                      <td>${escapeHtml(d.strFileSize)}</td>
                      <td>
                        <span class="badge ${d.strStatus === 'Approved' ? 'badge-success' : (d.strStatus === 'Rejected' ? 'badge-danger' : 'badge-warning')}">
                          ${escapeHtml(d.strStatus)}
                        </span>
                      </td>
                      <td>${escapeHtml(d.strRemarks || 'Queued for review')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <div style="background:#f8fafc;padding:16px;border-radius:10px;border:1px solid #cbd5e1;">
              <h4 style="font-size:13.5px;margin-bottom:10px;color:var(--joi-navy-dark);">Upload Additional Admission Document (FR-002)</h4>
              <div class="form-grid">
                <div class="form-field">
                  <label>Document Category</label>
                  <select id="stu-doc-type">
                    <option value="Form 138 (Report Card)">Form 138 (Report Card)</option>
                    <option value="Transcript of Records (TOR)">Transcript of Records (TOR)</option>
                    <option value="Good Moral Certificate">Good Moral Certificate</option>
                    <option value="PSA Birth Certificate">PSA Birth Certificate</option>
                    <option value="Medical & Dental Clearance">Medical &amp; Dental Clearance</option>
                  </select>
                </div>
                <div class="form-field">
                  <label>Digital File Name</label>
                  <input id="stu-doc-file" type="text" value="${escapeHtml(stu.strLastName)}_Document_2026.pdf" />
                </div>
              </div>
              <button class="btn btn-primary" onclick="window.JOIApp.uploadStudentDocument()">Upload Digital Document</button>
            </div>
          </div>
        </div>
      `;
    } else if (state.studentTab === 'profile') {
      const isLocked = stu.strStudentType === 'Returning';
      tabContent = `
        <div class="alert-banner ${isLocked ? 'alert-inc' : 'alert-info'}">
          <div>
            <strong>Profile Integrity Enforcement:</strong>
            ${isLocked
              ? 'As a returning student, your core personal profile fields in <code>tblStudentInformation</code> are <strong>READ-ONLY</strong> to prevent unauthorized record alteration. Contact the Office of the University Registrar for official name or legal data amendments.'
              : 'Your applicant profile is currently under admissions processing.'}
          </div>
          <span class="badge ${isLocked ? 'badge-warning' : 'badge-info'}">${isLocked ? 'Profile Locked' : 'Applicant Record'}</span>
        </div>

        <div class="panel-card">
          <div class="panel-header">
            <h3>Master Student Record (tblStudentInformation)</h3>
          </div>
          <div class="panel-body">
            <div class="form-grid">
              <div class="form-field"><label>Student ID / Student Number</label><input readonly value="${stu.lngStudentID} / ${escapeHtml(stu.strStudentNo)}" /></div>
              <div class="form-field"><label>Full Name</label><input readonly value="${escapeHtml(stu.strTitle)} ${escapeHtml(stu.strFirstName)} ${escapeHtml(stu.strMiddleName)} ${escapeHtml(stu.strLastName)}" /></div>
              <div class="form-field"><label>Date of Birth</label><input readonly value="${escapeHtml(stu.dtmDOB)}" /></div>
              <div class="form-field"><label>Email</label><input readonly value="${escapeHtml(stu['hypE-mailAddress'])}" /></div>
              <div class="form-field"><label>Telephone</label><input readonly value="${escapeHtml(stu.strTelephone)}" /></div>
              <div class="form-field"><label>Alt Telephone</label><input readonly value="${escapeHtml(stu.strAltTelephone)}" /></div>
              <div class="form-field"><label>Address 1</label><input readonly value="${escapeHtml(stu.strAddress1)}" /></div>
              <div class="form-field"><label>Address 2</label><input readonly value="${escapeHtml(stu.strAddress2)}" /></div>
              <div class="form-field"><label>City &amp; County</label><input readonly value="${escapeHtml(stu.strCity)}, ${escapeHtml(stu.strCounty)}" /></div>
              <div class="form-field"><label>Post Code &amp; Country</label><input readonly value="${escapeHtml(stu.strPostCode)} &bull; ${escapeHtml(stu.strCountry)}" /></div>
              <div class="form-field"><label>Date Enrolled (dtmEnrolled)</label><input readonly value="${escapeHtml(stu.dtmEnrolled)}" /></div>
              <div class="form-field"><label>Last Updated By</label><input readonly value="${escapeHtml(stu.strUpdatedBy)} ${escapeHtml(stu.dtmLastChanged)}" /></div>
            </div>
          </div>
        </div>
      `;
    } else if (state.studentTab === 'contacts') {
      tabContent = `
        <div class="panel-card">
          <div class="panel-header">
            <h3>Submit Student Inquiry or Concern</h3>
          </div>
          <div class="panel-body">
            <div class="form-grid">
              <div class="form-field">
                <label>Concern Category</label>
                <select id="stu-inq-cat">
                  <option value="Registrar / Subject Loading">Registrar / Subject Loading</option>
                  <option value="Finance / QR Payment Verification">Finance / QR Payment Verification</option>
                  <option value="Dean / INC Conditional Clearance">Dean / INC Conditional Clearance</option>
                </select>
              </div>
              <div class="form-field" style="grid-column: span 2;">
                <label>Message Details</label>
                <input id="stu-inq-msg" type="text" placeholder="Enter your inquiry or follow-up message..." />
              </div>
            </div>
            <button class="btn btn-primary" onclick="window.JOIApp.submitStudentInquiry()">Send Inquiry to Office</button>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-header">
            <h3>Official Communication &amp; Automated Notification Trail</h3>
          </div>
          <div class="panel-body">
            <div class="data-table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Contact ID</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Handled By</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  ${b.contacts.map((c) => `
                    <tr>
                      <td><code>#${c.lngContactID}</code></td>
                      <td>${escapeHtml(c.dteContactDate)}</td>
                      <td><span class="badge badge-navy">${escapeHtml(c.strContactType)}</span></td>
                      <td>${escapeHtml(c.strEmpName || 'Automated System')}</td>
                      <td>${escapeHtml(c.memContactDetails)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="portal-shell">
        <div class="portal-topbar">
          <div class="portal-brand">
            <img src="/assets/crest.png" alt="JOI Crest" />
            <div>
              <h1>Jewel of Intellect Academy &mdash; Online Student Portal</h1>
              <p>Logged in as <strong>${escapeHtml(stu.strFirstName)} ${escapeHtml(stu.strLastName)}</strong> ${escapeHtml(stu.strStudentNo)} &bull; ${escapeHtml(stu.strCourseCode || 'BSCOE')}</p>
            </div>
          </div>
          <div class="portal-user-controls">
            <button class="btn btn-outline btn-sm" onclick="window.JOIApp.logout()">Sign Out</button>
          </div>
        </div>

        <div class="portal-container">
          <div class="portal-tabs">
            ${tabs.map((t) => `
              <button class="portal-tab-btn ${state.studentTab === t.id ? 'active' : ''}" onclick="window.JOIApp.setStudentTab('${t.id}')">
                ${escapeHtml(t.label)}
              </button>
            `).join('')}
          </div>

          ${tabContent}
        </div>
      </div>
    `;
  }

  // =========================================================================
  // VIEW 7: SCHOOL ACCESS PORTAL (Strict RBAC & Tab Isolation)
  // =========================================================================
  function renderStaffPortal() {
    const ov = state.staffOverview;
    if (!ov) return `<div style="padding:40px;color:#fff;text-align:center;">Loading Staff Management Console...</div>`;
    const u = state.currentUser;
    const tabs = ROLE_TABS[u.role] || [];
    if (tabs.length === 0) {
      return `<div style="padding:40px;color:#fff;text-align:center;">Unauthorized role: ${escapeHtml(u.role)}</div>`;
    }
    if (!tabs.some((t) => t.id === state.staffTab)) {
      state.staffTab = tabs[0].id;
    }

    let content = '';

    if (state.staffTab === 'registrar-documents') {
      content = `
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Total Student Records</div>
            <div class="kpi-value">${ov.students.length}</div>
            <div class="kpi-sub">Master Directory</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Pending Document Reviews</div>
            <div class="kpi-value" style="color:#b45309;">${ov.documents.filter((d) => d.strStatus === 'Pending Review').length}</div>
            <div class="kpi-sub">Admission Queue</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Conditional INC Students</div>
            <div class="kpi-value">${ov.students.filter((s) => s.ysnHasINC).length}</div>
            <div class="kpi-sub">1-Year Grace Period</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Auto-Locked Full Sections</div>
            <div class="kpi-value" style="color:#b02a37;">${ov.sections.filter((s) => s.intEnrolledCount >= s.intMaxCapacity).length}</div>
            <div class="kpi-sub">Capacity Control</div>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-header">
            <h3>Applicant &amp; Transferee Admission Document Verification Queue</h3>
            <span class="badge badge-info">Auto-Dispatches Notification on Review</span>
          </div>
          <div class="panel-body">
            <div class="data-table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Student / Applicant</th>
                    <th>Document Type</th>
                    <th>Digital File</th>
                    <th>Status</th>
                    <th>Remarks</th>
                    <th>Registrar Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${ov.documents.map((d) => `
                    <tr>
                      <td>
                        <strong>${escapeHtml(d.strFirstName)} ${escapeHtml(d.strLastName)}</strong><br/>
                        <small style="color:#64748b;">${escapeHtml(d.strStudentNo)} &bull; ${escapeHtml(d.strEmail)}</small>
                      </td>
                      <td>${escapeHtml(d.strDocType)}</td>
                      <td><code>${escapeHtml(d.strFileName)}</code></td>
                      <td>
                        <span class="badge ${d.strStatus === 'Approved' ? 'badge-success' : (d.strStatus === 'Rejected' ? 'badge-danger' : 'badge-warning')}">
                          ${escapeHtml(d.strStatus)}
                        </span>
                      </td>
                      <td>${escapeHtml(d.strRemarks)}</td>
                      <td>
                        <div style="display:flex;gap:6px;flex-wrap:wrap;">
                          <button class="btn btn-success btn-sm" onclick="window.JOIApp.registrarReviewDoc(${d.lngDocID}, 'Approved')">Approve</button>
                          <button class="btn btn-danger btn-sm" onclick="window.JOIApp.registrarReviewDoc(${d.lngDocID}, 'Rejected')">Reject</button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-header">
            <h3>Student Academic Clearance, INC Grace Period &amp; Pre-Registration Release</h3>
          </div>
          <div class="panel-body">
            <div class="data-table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Student No.</th>
                    <th>Student Name</th>
                    <th>Type &amp; Program</th>
                    <th>INC Grade Status</th>
                    <th>Pre-Reg Form</th>
                    <th>Enrollment Status</th>
                    <th>Registrar Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${ov.students.map((s) => `
                    <tr>
                      <td><code>${escapeHtml(s.strStudentNo)}</code></td>
                      <td><strong>${escapeHtml(s.strFirstName)} ${escapeHtml(s.strLastName)}</strong></td>
                      <td>${escapeHtml(s.strStudentType)} &bull; ${escapeHtml(s.strCourseCode || 'BSCOE')} (Yr ${s.intYearLevel || 1})</td>
                      <td>
                        ${s.ysnHasINC
                          ? `<span class="badge badge-warning">INC: ${escapeHtml(s.strINCSubject)}</span>`
                          : `<span class="badge badge-success">Cleared</span>`}
                      </td>
                      <td>
                        <span class="badge ${s.ysnDeanPreRegReleased ? 'badge-success' : 'badge-warning'}">
                          ${s.ysnDeanPreRegReleased ? 'Released' : 'Held'}
                        </span>
                      </td>
                      <td>
                        <select id="reg-stu-status-${s.lngStudentID}" style="padding:4px 6px;border-radius:4px;border:1px solid #cbd5e1;font-size:12px;">
                          ${['Applicant', 'Pre-Registered', 'Conditionally Enrolled (INC)', 'Awaiting Payment Verification', 'Officially Enrolled', 'Dropped / Inactive'].map((st) => `
                            <option value="${st}" ${s.strEnrollmentStatus === st ? 'selected' : ''}>${st}</option>
                          `).join('')}
                        </select>
                      </td>
                      <td>
                        <div style="display:flex;gap:6px;flex-wrap:wrap;">
                          <button class="btn btn-outline btn-sm" onclick="window.JOIApp.registrarUpdateStudentStatus(${s.lngStudentID})">Save Status</button>
                          <button class="btn btn-primary btn-sm" onclick="window.JOIApp.toggleDeanRelease(${s.lngStudentID}, ${s.ysnDeanPreRegReleased ? 0 : 1})">
                            ${s.ysnDeanPreRegReleased ? 'Hold Pre-Reg' : 'Release Pre-Reg'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } else if (state.staffTab === 'registrar-sections') {
      const editSec = state.registrarEditSection;
      content = `
        <div class="panel-card">
          <div class="panel-header">
            <h3>${editSec ? `Edit Section / Block #${editSec.lngSectionID}` : 'Create New Subject Section / Block'}</h3>
            ${editSec ? `<button class="btn btn-outline btn-sm" onclick="window.JOIApp.registrarClearSectionForm()">Cancel Edit</button>` : ''}
          </div>
          <div class="panel-body">
            <div class="form-grid">
              <div class="form-field">
                <label>Degree Program</label>
                <select id="sec-course-id">
                  ${ov.courses.map((c) => `
                    <option value="${c.lngCourseID}" ${editSec && Number(editSec.lngCourseID) === Number(c.lngCourseID) ? 'selected' : ''}>
                      ${escapeHtml(c.strCourseCode)} &mdash; ${escapeHtml(c.strCourseDescription)}
                    </option>
                  `).join('')}
                </select>
              </div>
              <div class="form-field">
                <label>Subject Code</label>
                <input id="sec-subj-code" type="text" value="${escapeHtml(editSec ? editSec.strSubjectCode : '')}" placeholder="e.g. CPE 301" />
              </div>
              <div class="form-field">
                <label>Subject Title</label>
                <input id="sec-subj-title" type="text" value="${escapeHtml(editSec ? editSec.strSubjectTitle : '')}" placeholder="e.g. Microprocessor Systems" />
              </div>
              <div class="form-field">
                <label>Block / Section Name</label>
                <input id="sec-name" type="text" value="${escapeHtml(editSec ? editSec.strSectionName : '')}" placeholder="e.g. BSCOE 3-1" />
              </div>
              <div class="form-field">
                <label>Units</label>
                <input id="sec-units" type="number" min="1" max="6" value="${editSec ? editSec.intUnits : 3}" />
              </div>
              <div class="form-field">
                <label>Schedule</label>
                <input id="sec-schedule" type="text" value="${escapeHtml(editSec ? editSec.strSchedule : 'MWF 09:00 AM - 10:30 AM')}" />
              </div>
              <div class="form-field">
                <label>Assigned Room</label>
                <input id="sec-room" type="text" value="${escapeHtml(editSec ? editSec.strRoom : 'Salcedo Hall 301')}" />
              </div>
              <div class="form-field">
                <label>Assigned Faculty</label>
                <select id="sec-faculty-id">
                  <option value="">-- TBA / Unassigned --</option>
                  ${(ov.facultyList || []).map((f) => `
                    <option value="${f.lngEmpID}" ${editSec && Number(editSec.lngFacultyEmpID) === Number(f.lngEmpID) ? 'selected' : ''}>
                      ${escapeHtml(f.strEmpName)}
                    </option>
                  `).join('')}
                </select>
              </div>
              <div class="form-field">
                <label>Prerequisite Code</label>
                <input id="sec-prereq" type="text" value="${escapeHtml(editSec ? editSec.strPrerequisiteCode : 'NONE')}" />
              </div>
              <div class="form-field">
                <label>Max Capacity</label>
                <input id="sec-capacity" type="number" min="1" value="${editSec ? editSec.intMaxCapacity : 35}" />
              </div>
              <div class="form-field">
                <label>Per-Unit Fee (PHP)</label>
                <input id="sec-unit-fee" type="number" step="0.01" value="${editSec ? editSec.curPerUnitFee : 1850}" />
              </div>
              <div class="form-field">
                <label>Lab Fee (PHP)</label>
                <input id="sec-lab-fee" type="number" step="0.01" value="${editSec ? editSec.curLabFee : 0}" />
              </div>
            </div>
            <button class="btn btn-primary" onclick="window.JOIApp.registrarSaveSection()">
              ${editSec ? 'Save Section Changes' : '+ Create Section / Block'}
            </button>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-header">
            <h3>Active Subject Sections &amp; Blocks (${ov.sections.length})</h3>
          </div>
          <div class="panel-body">
            <div class="data-table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Block / Section</th>
                    <th>Subject</th>
                    <th>Units</th>
                    <th>Schedule &amp; Room</th>
                    <th>Faculty</th>
                    <th>Prerequisite</th>
                    <th>Capacity</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${ov.sections.map((s) => `
                    <tr>
                      <td><span class="badge badge-navy">${escapeHtml(s.strSectionName)}</span></td>
                      <td><strong>${escapeHtml(s.strSubjectCode)}</strong> &mdash; ${escapeHtml(s.strSubjectTitle)}</td>
                      <td>${s.intUnits}</td>
                      <td>${escapeHtml(s.strSchedule)}<br/><small style="color:#64748b;">${escapeHtml(s.strRoom)}</small></td>
                      <td>${escapeHtml(s.strProfessorName || 'TBA')}</td>
                      <td><code>${escapeHtml(s.strPrerequisiteCode)}</code></td>
                      <td>
                        <span class="badge ${s.intEnrolledCount >= s.intMaxCapacity ? 'badge-danger' : 'badge-success'}">
                          ${s.intEnrolledCount} / ${s.intMaxCapacity}
                        </span>
                      </td>
                      <td>
                        <button class="btn btn-outline btn-sm" onclick="window.JOIApp.registrarEditSection(${s.lngSectionID})">Edit</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-header">
            <h3>Degree Programs / Course Catalog (${ov.courses.length})</h3>
          </div>
          <div class="panel-body">
            <div style="background:#f8fafc;padding:14px;border-radius:10px;border:1px solid #cbd5e1;margin-bottom:16px;">
              <h4 style="font-size:13.5px;margin-bottom:10px;color:var(--joi-navy-dark);">Add New Degree Program / Course</h4>
              <div class="form-grid">
                <div class="form-field">
                  <label>Course Code</label>
                  <input id="reg-course-code" type="text" placeholder="e.g. BSDS" />
                </div>
                <div class="form-field">
                  <label>Course Description</label>
                  <input id="reg-course-desc" type="text" placeholder="e.g. BS in Data Science" />
                </div>
                <div class="form-field">
                  <label>Base Cost (PHP)</label>
                  <input id="reg-course-cost" type="number" step="0.01" value="42500" />
                </div>
                <div class="form-field">
                  <label>Duration (Years)</label>
                  <input id="reg-course-years" type="number" min="1" max="6" value="4" />
                </div>
              </div>
              <button class="btn btn-primary btn-sm" onclick="window.JOIApp.registrarSaveCourse()">+ Add Course</button>
            </div>
            <div class="data-table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Description</th>
                    <th>Duration</th>
                    <th>Base Cost</th>
                  </tr>
                </thead>
                <tbody>
                  ${ov.courses.map((c) => `
                    <tr>
                      <td><strong>${escapeHtml(c.strCourseCode)}</strong></td>
                      <td>${escapeHtml(c.strCourseDescription)}</td>
                      <td>${c.intCourseDurationYears} yrs</td>
                      <td>${formatPHP(c.curCourseCost)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } else if (state.staffTab === 'registrar-placement') {
      const sectionNames = [...new Set(ov.sections.map((s) => s.strSectionName).filter(Boolean))];
      const filteredLoads = state.masterListSectionFilter === 'ALL'
        ? ov.subjectLoads
        : ov.subjectLoads.filter((l) => l.strSectionName === state.masterListSectionFilter);
      const transferLoad = state.registrarTransferLoad;

      content = `
        <div class="panel-card">
          <div class="panel-header">
            <h3>Place Student into Subject / Block</h3>
          </div>
          <div class="panel-body">
            <div class="form-grid">
              <div class="form-field">
                <label>Select Student</label>
                <select id="assign-student-id">
                  ${ov.students.map((s) => `
                    <option value="${s.lngStudentID}">${escapeHtml(s.strStudentNo)} &mdash; ${escapeHtml(s.strLastName)}, ${escapeHtml(s.strFirstName)} (${escapeHtml(s.strCourseCode || 'N/A')})</option>
                  `).join('')}
                </select>
              </div>
              <div class="form-field">
                <label>Target Section / Block</label>
                <select id="assign-section-id">
                  ${ov.sections.map((sec) => `
                    <option value="${sec.lngSectionID}">${escapeHtml(sec.strSectionName)} &bull; ${escapeHtml(sec.strSubjectCode)} (${sec.intEnrolledCount}/${sec.intMaxCapacity})</option>
                  `).join('')}
                </select>
              </div>
            </div>
            <button class="btn btn-primary" onclick="window.JOIApp.registrarAssignStudentSection()">Assign Student to Section</button>
          </div>
        </div>

        ${transferLoad ? `
          <div class="panel-card" style="border:2px solid var(--joi-gold);">
            <div class="panel-header">
              <h3>Transfer Student Between Sections</h3>
              <button class="btn btn-outline btn-sm" onclick="window.JOIApp.registrarCancelTransfer()">Cancel Transfer</button>
            </div>
            <div class="panel-body">
              <p style="font-size:13px;margin-bottom:12px;">
                Transferring <strong>${escapeHtml(transferLoad.strFirstName)} ${escapeHtml(transferLoad.strLastName)}</strong>
                (<code>${escapeHtml(transferLoad.strStudentNo)}</code>) from
                <span class="badge badge-navy">${escapeHtml(transferLoad.strSubjectCode)} (${escapeHtml(transferLoad.strSectionName)})</span>
              </p>
              <div class="form-grid">
                <div class="form-field">
                  <label>Destination Section / Block</label>
                  <select id="transfer-to-section-id">
                    ${ov.sections
                      .filter((sec) => Number(sec.lngSectionID) !== Number(transferLoad.lngSectionID))
                      .map((sec) => `
                        <option value="${sec.lngSectionID}">
                          ${escapeHtml(sec.strSectionName)} &bull; ${escapeHtml(sec.strSubjectCode)} (${sec.intEnrolledCount}/${sec.intMaxCapacity}) &mdash; ${escapeHtml(sec.strSchedule)}
                        </option>
                      `).join('')}
                  </select>
                </div>
              </div>
              <button class="btn btn-gold" onclick="window.JOIApp.registrarTransferStudent()">Confirm Section Transfer</button>
            </div>
          </div>
        ` : ''}

        <div class="panel-card">
          <div class="panel-header">
            <h3>Official Class Master Lists &amp; Section Transfers</h3>
            <div style="display:flex;gap:8px;align-items:center;">
              <select onchange="window.JOIApp.setMasterListFilter(this.value)" style="padding:5px 10px;border-radius:6px;border:1px solid #cbd5e1;">
                <option value="ALL" ${state.masterListSectionFilter === 'ALL' ? 'selected' : ''}>All Sections (${ov.subjectLoads.length})</option>
                ${sectionNames.map((name) => `
                  <option value="${escapeHtml(name)}" ${state.masterListSectionFilter === name ? 'selected' : ''}>${escapeHtml(name)}</option>
                `).join('')}
              </select>
              <button class="btn btn-outline btn-sm" onclick="window.print()">Export / Print Master List</button>
            </div>
          </div>
          <div class="panel-body">
            <div class="data-table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Section</th>
                    <th>Subject</th>
                    <th>Student ID No.</th>
                    <th>Student Name</th>
                    <th>Official Status</th>
                    <th>Schedule &amp; Room</th>
                    <th>Professor</th>
                    <th>Transfer</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredLoads.map((l) => `
                    <tr>
                      <td><span class="badge badge-navy">${escapeHtml(l.strSectionName)}</span></td>
                      <td><strong>${escapeHtml(l.strSubjectCode)}</strong> &mdash; ${escapeHtml(l.strSubjectTitle)}</td>
                      <td><code>${escapeHtml(l.strStudentNo)}</code></td>
                      <td><strong>${escapeHtml(l.strLastName)}, ${escapeHtml(l.strFirstName)}</strong></td>
                      <td>
                        <span class="badge ${l.strEnrollmentStatus.includes('Officially') ? 'badge-success' : 'badge-warning'}">
                          ${escapeHtml(l.strEnrollmentStatus)}
                        </span>
                      </td>
                      <td>${escapeHtml(l.strSchedule)} &bull; ${escapeHtml(l.strRoom)}</td>
                      <td>${escapeHtml(l.strProfessorName || 'TBA')}</td>
                      <td>
                        <button class="btn btn-outline btn-sm" onclick="window.JOIApp.registrarOpenTransfer(${l.lngLoadID})">Transfer</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } else if (state.staffTab === 'finance-payments') {
      content = `
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Pending QR Receipts</div>
            <div class="kpi-value" style="color:#b45309;">${ov.payments.filter((p) => p.strStatus === 'Pending Verification').length}</div>
            <div class="kpi-sub">Awaiting Finance verification</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Verified QR Collections</div>
            <div class="kpi-value" style="color:#157347;">
              ${formatPHP(ov.payments.filter((p) => p.strStatus === 'Paid / Verified').reduce((a, b) => a + Number(b.curAmount), 0))}
            </div>
            <div class="kpi-sub">Verified Collections</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Active Promissory Notes</div>
            <div class="kpi-value">${ov.promissoryNotes.length}</div>
            <div class="kpi-sub">Deferred Installment Registry</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Officially Enrolled Students</div>
            <div class="kpi-value">${ov.students.filter((s) => s.strEnrollmentStatus.includes('Officially Enrolled')).length}</div>
            <div class="kpi-sub">Cleared by Finance</div>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-header">
            <h3>Student Balances &amp; Assessment Overview</h3>
          </div>
          <div class="panel-body">
            <div class="data-table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Student No.</th>
                    <th>Student Name</th>
                    <th>Enrollment Status</th>
                    <th>Outstanding Balance</th>
                  </tr>
                </thead>
                <tbody>
                  ${ov.students.map((s) => `
                    <tr>
                      <td><code>${escapeHtml(s.strStudentNo)}</code></td>
                      <td><strong>${escapeHtml(s.strLastName)}, ${escapeHtml(s.strFirstName)}</strong></td>
                      <td><span class="badge badge-navy">${escapeHtml(s.strEnrollmentStatus)}</span></td>
                      <td><strong style="color:${Number(s.curOutstandingBalance) > 0 ? '#b45309' : '#157347'};">${formatPHP(s.curOutstandingBalance)}</strong></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-header">
            <h3>QR Payment Receipt Verification Queue</h3>
            <span class="badge badge-success">Verifying Payment Auto-Tags Student as "Officially Enrolled"</span>
          </div>
          <div class="panel-body">
            <div class="data-table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Reference No.</th>
                    <th>Student</th>
                    <th>Channel</th>
                    <th>Amount</th>
                    <th>Receipt File</th>
                    <th>Payment Status</th>
                    <th>Student Enrollment Tag</th>
                    <th>Finance Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${ov.payments.map((p) => `
                    <tr>
                      <td><code>${escapeHtml(p.strReferenceNo)}</code></td>
                      <td><strong>${escapeHtml(p.strFirstName)} ${escapeHtml(p.strLastName)}</strong><br/><small>${escapeHtml(p.strStudentNo)}</small></td>
                      <td>${escapeHtml(p.strPaymentMethod.replace(/\s*\([^)]*\)/g, ''))}</td>
                      <td><strong>${formatPHP(p.curAmount)}</strong></td>
                      <td><code>${escapeHtml(p.strReceiptFileName)}</code></td>
                      <td>
                        <span class="badge ${p.strStatus === 'Paid / Verified' ? 'badge-success' : (p.strStatus.includes('Pending') ? 'badge-warning' : 'badge-danger')}">
                          ${escapeHtml(p.strStatus)}
                        </span>
                      </td>
                      <td><span class="badge badge-navy">${escapeHtml(p.strEnrollmentStatus)}</span></td>
                      <td>
                        <div style="display:flex;gap:6px;">
                          <button class="btn btn-success btn-sm" onclick="window.JOIApp.financeVerifyPayment(${p.lngPaymentID}, 'Paid / Verified')">
                            Verify &amp; Tag Enrolled
                          </button>
                          <button class="btn btn-danger btn-sm" onclick="window.JOIApp.financeVerifyPayment(${p.lngPaymentID}, 'Failed / Rejected')">
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-header">
            <h3>Manual Promissory Note Logging &amp; Deferred Schedule Registry</h3>
          </div>
          <div class="panel-body">
            <div style="background:#f8fafc;padding:16px;border-radius:10px;border:1px solid #cbd5e1;margin-bottom:18px;">
              <h4 style="font-size:13.5px;margin-bottom:10px;color:var(--joi-navy-dark);">Record Approved Paper Promissory Note into Database</h4>
              <div class="form-grid">
                <div class="form-field">
                  <label>Select Student</label>
                  <select id="pn-student-id">
                    ${ov.students.map((s) => `
                      <option value="${s.lngStudentID}">${escapeHtml(s.strStudentNo)} &mdash; ${escapeHtml(s.strFirstName)} ${escapeHtml(s.strLastName)} &mdash; Balance: ${formatPHP(s.curOutstandingBalance)}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="form-field">
                  <label>Covered Deferred Amount &mdash; PHP</label>
                  <input id="pn-amount" type="number" step="0.01" value="19150.00" />
                </div>
                <div class="form-field">
                  <label>Deferred Payment Due Date</label>
                  <input id="pn-due-date" type="date" value="2026-12-15" />
                </div>
                <div class="form-field" style="grid-column: span 3;">
                  <label>Agreement Terms &amp; Co-Maker Details</label>
                  <input id="pn-terms" type="text" value="Approved paper Promissory Note signed by parent/guardian; payable prior to Final Examinations." />
                </div>
              </div>
              <button class="btn btn-primary" onclick="window.JOIApp.financeLogPromissoryNote()">
                Log Approved Promissory Note &amp; Tag "Officially Enrolled"
              </button>
            </div>

            <div class="data-table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Note Ref No.</th>
                    <th>Student</th>
                    <th>Covered Amount</th>
                    <th>Agreement Terms</th>
                    <th>Deferred Due Date</th>
                    <th>Logged By</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${ov.promissoryNotes.map((pn) => `
                    <tr>
                      <td><code>${escapeHtml(pn.strNoteReferenceNo)}</code></td>
                      <td><strong>${escapeHtml(pn.strFirstName)} ${escapeHtml(pn.strLastName)}</strong> ${escapeHtml(pn.strStudentNo)}</td>
                      <td><strong>${formatPHP(pn.curCoveredAmount)}</strong></td>
                      <td>${escapeHtml(pn.strAgreementTerms)}</td>
                      <td>${escapeHtml(pn.dteDeferredDueDate)}</td>
                      <td>${escapeHtml(pn.strLoggedByName || 'Finance Staff')}</td>
                      <td><span class="badge badge-success">${escapeHtml(pn.strStatus)}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } else if (state.staffTab === 'faculty-grades') {
      content = `
        <div class="alert-banner alert-info">
          <div>
            <strong>Faculty Instructional Dashboard:</strong>
            View your assigned teaching sections (<code>lngFacultyEmpID = ${escapeHtml(u.empId)}</code>), verify enrolled students, and encode grades or INC marks.
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-header">
            <h3>My Assigned Sections &amp; Teaching Schedules</h3>
          </div>
          <div class="panel-body">
            <div class="data-table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Subject Code</th>
                    <th>Subject Title</th>
                    <th>Section</th>
                    <th>Units</th>
                    <th>Schedule</th>
                    <th>Assigned Room</th>
                    <th>Enrolled / Capacity</th>
                  </tr>
                </thead>
                <tbody>
                  ${ov.sections.length === 0 ? `
                    <tr><td colspan="7" style="text-align:center;color:#64748b;padding:20px;">No sections are currently assigned to your faculty account.</td></tr>
                  ` : ov.sections.map((s) => `
                    <tr>
                      <td><strong>${escapeHtml(s.strSubjectCode)}</strong></td>
                      <td>${escapeHtml(s.strSubjectTitle)}</td>
                      <td><span class="badge badge-navy">${escapeHtml(s.strSectionName)}</span></td>
                      <td>${s.intUnits}</td>
                      <td>${escapeHtml(s.strSchedule)}</td>
                      <td>${escapeHtml(s.strRoom)}</td>
                      <td>
                        <span class="badge ${s.intEnrolledCount >= s.intMaxCapacity ? 'badge-danger' : 'badge-success'}">
                          ${s.intEnrolledCount} / ${s.intMaxCapacity}
                        </span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-header">
            <h3>Assigned Class Roster &amp; Grade / INC Encoding</h3>
          </div>
          <div class="panel-body">
            <div class="data-table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Section &amp; Subject</th>
                    <th>Student No.</th>
                    <th>Student Name</th>
                    <th>Enrollment Verification</th>
                    <th>Current Grade</th>
                    <th>Encode Grade / INC</th>
                  </tr>
                </thead>
                <tbody>
                  ${ov.subjectLoads.length === 0 ? `
                    <tr><td colspan="6" style="text-align:center;color:#64748b;padding:20px;">No enrolled students in your assigned sections yet.</td></tr>
                  ` : ov.subjectLoads.map((l) => `
                    <tr>
                      <td><strong>${escapeHtml(l.strSubjectCode)}</strong> ${escapeHtml(l.strSectionName)}</td>
                      <td><code>${escapeHtml(l.strStudentNo)}</code></td>
                      <td><strong>${escapeHtml(l.strLastName)}, ${escapeHtml(l.strFirstName)}</strong></td>
                      <td>
                        <span class="badge ${l.strEnrollmentStatus.includes('Officially') ? 'badge-success' : 'badge-warning'}">
                          ${escapeHtml(l.strEnrollmentStatus)}
                        </span>
                      </td>
                      <td><strong>${escapeHtml(l.strGrade)}</strong></td>
                      <td>
                        <div style="display:flex;gap:6px;align-items:center;">
                          <select id="grade-sel-${l.lngLoadID}" style="padding:4px 8px;border-radius:4px;border:1px solid #cbd5e1;font-size:12px;">
                            <option value="1.00">1.00 Excellent</option>
                            <option value="1.25" selected>1.25 Superior</option>
                            <option value="1.50">1.50 Very Good</option>
                            <option value="1.75">1.75 Good</option>
                            <option value="2.00">2.00 Satisfactory</option>
                            <option value="3.00">3.00 Passed</option>
                            <option value="INC">INC Incomplete</option>
                          </select>
                          <button class="btn btn-primary btn-sm" onclick="window.JOIApp.facultySaveGrade(${l.lngLoadID})">Save Grade</button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } else if (state.staffTab === 'admin-dashboard') {
      const cfg = ov.systemConfig || {
        strActiveSemester: '1st Semester AY 2026-2027',
        curDefaultPerUnitFee: 1850,
        curDefaultMiscFee: 6850,
        ysnApplicationsOpen: 1
      };
      content = `
        <div class="panel-card">
          <div class="panel-header">
            <h3>System Configuration &amp; Academic Parameters</h3>
            <span class="badge badge-navy">Admin Exclusive</span>
          </div>
          <div class="panel-body">
            <div class="form-grid">
              <div class="form-field">
                <label>Active Semester Label</label>
                <input id="cfg-semester" type="text" value="${escapeHtml(cfg.strActiveSemester)}" />
              </div>
              <div class="form-field">
                <label>Default Per-Unit Tuition Fee (PHP)</label>
                <input id="cfg-unit-fee" type="number" step="0.01" value="${Number(cfg.curDefaultPerUnitFee || 1850)}" />
              </div>
              <div class="form-field">
                <label>Default Miscellaneous Fee (PHP)</label>
                <input id="cfg-misc-fee" type="number" step="0.01" value="${Number(cfg.curDefaultMiscFee || 6850)}" />
              </div>
              <div class="form-field">
                <label>Online Applications Portal</label>
                <select id="cfg-apps-open">
                  <option value="1" ${Number(cfg.ysnApplicationsOpen) !== 0 ? 'selected' : ''}>Open (Accepting Applicants)</option>
                  <option value="0" ${Number(cfg.ysnApplicationsOpen) === 0 ? 'selected' : ''}>Closed</option>
                </select>
              </div>
            </div>
            <button class="btn btn-primary" onclick="window.JOIApp.adminSaveSystemConfig()">Save System Configuration</button>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-header">
            <h3>Employee Account &amp; RBAC Management (tblEmployees)</h3>
          </div>
          <div class="panel-body">
            <div class="data-table-wrap" style="margin-bottom:18px;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Emp ID</th>
                    <th>Employee Code</th>
                    <th>Full Name</th>
                    <th>Email</th>
                    <th>RBAC Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${ov.employees.map((e) => `
                    <tr>
                      <td><code>#${e.lngEmpID}</code></td>
                      <td>
                        <input id="adm-code-${e.lngEmpID}" type="text" value="${escapeHtml(e.strEmpCode || '')}" style="width:110px;padding:4px 6px;border:1px solid #cbd5e1;border-radius:4px;font-size:12px;" />
                      </td>
                      <td><strong>${escapeHtml(e.strEmpName)}</strong><br/><small style="color:#64748b;">${escapeHtml(e.strEmpPosition || '')}</small></td>
                      <td><small>${escapeHtml(e.strEmpEmail || 'N/A')}</small></td>
                      <td>
                        <select id="adm-role-${e.lngEmpID}" style="padding:4px 6px;border:1px solid #cbd5e1;border-radius:4px;font-size:12px;">
                          ${['ADMIN', 'REGISTRAR', 'FINANCE', 'FACULTY'].map((r) => `
                            <option value="${r}" ${e.strAccess === r ? 'selected' : ''}>${r}</option>
                          `).join('')}
                        </select>
                      </td>
                      <td>
                        <select id="adm-active-${e.lngEmpID}" style="padding:4px 6px;border:1px solid #cbd5e1;border-radius:4px;font-size:12px;">
                          <option value="1" ${e.ysnActive !== 0 ? 'selected' : ''}>Active</option>
                          <option value="0" ${e.ysnActive === 0 ? 'selected' : ''}>Deactivated</option>
                        </select>
                      </td>
                      <td>
                        <div style="display:flex;gap:6px;flex-wrap:wrap;">
                          <button class="btn btn-primary btn-sm" onclick="window.JOIApp.adminUpdateEmployee(${e.lngEmpID})">Save</button>
                          <button class="btn btn-outline btn-sm" onclick="window.JOIApp.adminResetPassword('staff', ${e.lngEmpID})">Reset PW</button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <div style="background:#f8fafc;padding:16px;border-radius:10px;border:1px solid #cbd5e1;">
              <h4 style="font-size:13.5px;margin-bottom:10px;color:var(--joi-navy-dark);">Provision New Staff Account (ADM / REG / FIN / FAC)</h4>
              <div class="form-grid">
                <div class="form-field">
                  <label>Employee Code (Optional, auto-prefixed if blank)</label>
                  <input id="adm-emp-code" type="text" placeholder="e.g. REG-002" />
                </div>
                <div class="form-field">
                  <label>Full Name</label>
                  <input id="adm-emp-name" type="text" placeholder="e.g. Engr. Beatrice L. Villanueva" />
                </div>
                <div class="form-field">
                  <label>Email &mdash; Supabase Auth invitation</label>
                  <input id="adm-emp-email" type="email" placeholder="employee@joi.edu.ph" autocomplete="email" />
                </div>
                <div class="form-field">
                  <label>Job Position</label>
                  <select id="adm-emp-pos">
                    ${ov.positions.map((p) => `<option value="${p.lngEmpPositionID}">${escapeHtml(p.strEmpPosition)}</option>`).join('')}
                  </select>
                </div>
                <div class="form-field">
                  <label>RBAC Access Level</label>
                  <select id="adm-emp-role">
                    <option value="FACULTY">FACULTY</option>
                    <option value="REGISTRAR">REGISTRAR</option>
                    <option value="FINANCE">FINANCE</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
                <div class="form-field">
                  <label>Department</label>
                  <input id="adm-emp-dept" type="text" value="Academic Affairs" />
                </div>
              </div>
              <button class="btn btn-primary" onclick="window.JOIApp.adminCreateEmployee()">Invite &amp; Create Staff Account</button>
            </div>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-header">
            <h3>Student Account Management (Password Reset &amp; Status)</h3>
          </div>
          <div class="panel-body">
            <div class="data-table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Student No.</th>
                    <th>Student Name</th>
                    <th>Email</th>
                    <th>Enrollment Status</th>
                    <th>Admin Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${ov.students.map((s) => `
                    <tr>
                      <td><code>${escapeHtml(s.strStudentNo)}</code></td>
                      <td><strong>${escapeHtml(s.strLastName)}, ${escapeHtml(s.strFirstName)}</strong></td>
                      <td><small>${escapeHtml(s['hypE-mailAddress'] || 'N/A')}</small></td>
                      <td><span class="badge badge-navy">${escapeHtml(s.strEnrollmentStatus)}</span></td>
                      <td>
                        <button class="btn btn-outline btn-sm" onclick="window.JOIApp.adminResetPassword('student', ${s.lngStudentID})">Reset Password</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } else if (state.staffTab === 'admin-database') {
      const tableMap = {
        tblEmployees: ov.employees,
        tblStudentInformation: ov.students,
        tblCourseList: ov.courses,
        tblSubjectSections: ov.sections,
        tblPayments: ov.payments,
        tblAdmissionDocuments: ov.documents,
        tblContacts: ov.contacts,
        tblDatabaseBackups: ov.backups
      };
      const rows = tableMap[state.adminSelectedTable] || [];
      const cols = rows.length > 0 ? Object.keys(rows[0]) : [];

      content = `
        <div class="panel-card">
          <div class="panel-header">
            <h3>Database Management &amp; Live Supabase Table Inspector</h3>
            <span class="badge badge-info">Backups managed in Supabase Dashboard</span>
          </div>
          <div class="panel-body">
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
              ${Object.keys(tableMap).map((tName) => `
                <button class="btn ${state.adminSelectedTable === tName ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="window.JOIApp.selectAdminTable('${tName}')">
                  ${tName} (${tableMap[tName].length})
                </button>
              `).join('')}
            </div>

            <div class="data-table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    ${cols.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${rows.length === 0 ? `
                    <tr><td colspan="${Math.max(1, cols.length)}" style="text-align:center;color:#64748b;padding:20px;">No rows in ${escapeHtml(state.adminSelectedTable)}.</td></tr>
                  ` : rows.map((r) => `
                    <tr>
                      ${cols.map((c) => `<td>${escapeHtml(typeof r[c] === 'object' ? JSON.stringify(r[c]) : r[c])}</td>`).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="portal-shell">
        <div class="portal-topbar">
          <div class="portal-brand">
            <img src="/assets/crest.png" alt="JOI Crest" />
            <div>
              <h1>Jewel of Intellect Academy &mdash; School Access Portal</h1>
              <p>Signed in as <strong>${escapeHtml(u.name)}</strong> (${escapeHtml(u.empCode || '')}) &bull; ${escapeHtml(u.position || u.role)} &bull; Role: <code>${escapeHtml(u.role)}</code></p>
            </div>
          </div>
          <div class="portal-user-controls">
            <button class="btn btn-outline btn-sm" onclick="window.JOIApp.logout()">Sign Out</button>
          </div>
        </div>

        <div class="portal-container">
          <div class="portal-tabs">
            ${tabs.map((t) => `
              <button class="portal-tab-btn ${state.staffTab === t.id ? 'active' : ''}" onclick="window.JOIApp.setStaffTab('${t.id}')">
                ${escapeHtml(t.label)}
              </button>
            `).join('')}
          </div>

          ${content}
        </div>
      </div>
    `;
  }

  function render() {
    const root = document.getElementById('app-root');
    if (!root) return;

    if (state.view === 'landing') {
      root.innerHTML = renderLandingView();
    } else if (state.view === 'applicants-auth') {
      root.innerHTML = renderApplicantsAuthView();
    } else if (state.view === 'students-auth') {
      root.innerHTML = renderStudentsAuthView();
    } else if (state.view === 'faculty-auth') {
      root.innerHTML = renderFacultyAuthView();
    } else if (state.view === 'applicant-intake') {
      root.innerHTML = renderApplicantIntakeWizard();
    } else if (state.view === 'student-portal') {
      root.innerHTML = renderStudentPortal();
    } else if (state.view === 'staff-portal') {
      root.innerHTML = renderStaffPortal();
    }
  }

  // =========================================================================
  // EXPORTED GLOBAL CONTROLLER ACTIONS
  // =========================================================================
  window.JOIApp = {
    navigate,
    setAuthField(field, value) {
      state.authInput[field] = value;
    },
    togglePassword() {
      state.authInput.showPassword = !state.authInput.showPassword;
      render();
    },
    toggleIntakePassword() {
      const el = document.getElementById('intake-password-input');
      if (!el) return;
      const show = el.dataset.show === 'true';
      el.type = show ? 'password' : 'text';
      el.dataset.show = String(!show);
      const btn = el.parentElement.querySelector('button');
      if (btn) btn.textContent = show ? '🙈' : '👁';
    },
    clearAuth() {
      state.authInput.identifier = '';
      state.authInput.password = '';
      state.authInput.staffEmail = '';
      render();
    },
    verifyStaffEmployeeId,
    resetStaffVerification() {
      state.authInput.staffVerified = null;
      state.authInput.staffEmail = '';
      state.authInput.password = '';
      render();
    },
    submitAuth(mode) {
      loginWithCredentials(mode, state.authInput.identifier, state.authInput.password);
    },
    logout() {
      state.currentUser = null;
      state.studentBundle = null;
      navigate('landing');
      showToast('You have been signed out safely.');
    },

    // Wizard actions
    setWizardStep(stepNum) {
      state.intakeDraft.step = stepNum;
      saveDraft();
      render();
    },
    updateDraft(section, key, val) {
      state.intakeDraft[section][key] = val;
      saveDraft();
    },
    updateDraftRoot(key, val) {
      state.intakeDraft[key] = val;
      saveDraft();
      if (key === 'confirmedReview' || key === 'courseId') render();
    },
    handleIntakeFileSelect(idx, inputEl) {
      if (inputEl.files && inputEl.files[0]) {
        const f = inputEl.files[0];
        state.intakeDraft.documents[idx].fileName = f.name;
        state.intakeDraft.documents[idx].fileSize = `${Math.max(100, Math.round(f.size / 1024))} KB`;
        saveDraft();
        render();
        showToast(`Attached digital document: ${f.name}`, 'success');
      }
    },
    async submitApplicantIntake() {
      try {
        const d = state.intakeDraft;
        if (!d.confirmedReview) {
          showToast('Please check if the documents you submitted are correct in order to proceed.', 'error');
          return;
        }
        const res = await apiFetch('/api/applicant/apply', {
          method: 'POST',
          body: JSON.stringify(d)
        });
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        state.intakeDraft = JSON.parse(JSON.stringify(defaultDraft));
        if (res.requiresEmailConfirmation) {
          state.view = 'applicants-auth';
          render();
          showToast('Application submitted. Check your email to confirm your Supabase Auth account, then sign in.', 'info');
          return;
        }
        state.currentUser = {
          token: res.token,
          refreshToken: res.refreshToken,
          userType: 'student',
          role: 'APPLICANT',
          studentId: res.studentId,
          name: `${d.personal.firstName} ${d.personal.lastName}`,
          studentNo: res.studentNo
        };
        await refreshStudentPortal();
        state.view = 'student-portal';
        state.studentTab = 'overview';
        render();
        showToast(`Application ${res.studentNo} submitted! You are now in your Applicant Portal.`, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    },

    // Student Portal actions
    setStudentTab(tabId) {
      state.studentTab = tabId;
      render();
    },
    async enrollSubject(sectionId) {
      try {
        const res = await apiFetch('/api/student/enroll-subject', {
          method: 'POST',
          body: JSON.stringify({
            studentId: state.currentUser.studentId,
            sectionId
          })
        });
        state.studentBundle = res.bundle;
        render();
        showToast(res.message, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    async dropSubject(loadId) {
      try {
        const res = await apiFetch('/api/student/drop-subject', {
          method: 'POST',
          body: JSON.stringify({
            studentId: state.currentUser.studentId,
            loadId
          })
        });
        state.studentBundle = res.bundle;
        render();
        showToast(res.message, 'info');
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    async submitStudentQRPayment() {
      try {
        const amount = document.getElementById('qr-pay-amount').value;
        const paymentMethod = document.getElementById('qr-pay-method').value;
        const receiptFileName = document.getElementById('qr-pay-receipt').value;
        const res = await apiFetch('/api/student/submit-qr-payment', {
          method: 'POST',
          body: JSON.stringify({
            studentId: state.currentUser.studentId,
            amount,
            paymentMethod,
            receiptFileName
          })
        });
        state.studentBundle = res.bundle;
        render();
        showToast(res.message, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    async uploadStudentDocument() {
      try {
        const docType = document.getElementById('stu-doc-type').value;
        const fileName = document.getElementById('stu-doc-file').value;
        const res = await apiFetch('/api/student/upload-document', {
          method: 'POST',
          body: JSON.stringify({
            studentId: state.currentUser.studentId,
            docType,
            fileName
          })
        });
        state.studentBundle = res.bundle;
        render();
        showToast(res.message, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    async submitStudentInquiry() {
      try {
        const category = document.getElementById('stu-inq-cat').value;
        const message = document.getElementById('stu-inq-msg').value;
        const res = await apiFetch('/api/student/inquiry', {
          method: 'POST',
          body: JSON.stringify({
            studentId: state.currentUser.studentId,
            category,
            message
          })
        });
        state.studentBundle = res.bundle;
        render();
        showToast(res.message, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    },

    // Staff Portal actions
    setStaffTab(tabId) {
      const allowed = ROLE_TABS[state.currentUser?.role] || [];
      if (!allowed.some((t) => t.id === tabId)) return;
      state.staffTab = tabId;
      render();
    },
    setMasterListFilter(val) {
      state.masterListSectionFilter = val;
      render();
    },
    selectAdminTable(tName) {
      state.adminSelectedTable = tName;
      render();
    },
    async registrarReviewDoc(docId, status) {
      try {
        const res = await apiFetch('/api/registrar/review-document', {
          method: 'POST',
          body: JSON.stringify({ docId, status })
        });
        await refreshStaffPortal();
        showToast(res.message, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    async toggleDeanRelease(studentId, releasePreReg) {
      try {
        const res = await apiFetch('/api/registrar/dean-approval', {
          method: 'POST',
          body: JSON.stringify({
            studentId,
            releasePreReg: Boolean(releasePreReg)
          })
        });
        await refreshStaffPortal();
        showToast(res.message, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    async registrarUpdateStudentStatus(studentId) {
      try {
        const sel = document.getElementById(`reg-stu-status-${studentId}`);
        const enrollmentStatus = sel ? sel.value : '';
        const res = await apiFetch('/api/registrar/student-status', {
          method: 'POST',
          body: JSON.stringify({ studentId, enrollmentStatus })
        });
        await refreshStaffPortal();
        showToast(res.message, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    registrarEditSection(sectionId) {
      const sec = (state.staffOverview?.sections || []).find((s) => Number(s.lngSectionID) === Number(sectionId));
      state.registrarEditSection = sec || null;
      render();
    },
    registrarClearSectionForm() {
      state.registrarEditSection = null;
      render();
    },
    async registrarSaveSection() {
      try {
        const payload = {
          sectionId: state.registrarEditSection?.lngSectionID || undefined,
          courseId: Number(document.getElementById('sec-course-id').value),
          subjectCode: document.getElementById('sec-subj-code').value,
          subjectTitle: document.getElementById('sec-subj-title').value,
          sectionName: document.getElementById('sec-name').value,
          units: Number(document.getElementById('sec-units').value),
          schedule: document.getElementById('sec-schedule').value,
          room: document.getElementById('sec-room').value,
          facultyEmpId: document.getElementById('sec-faculty-id').value,
          prerequisiteCode: document.getElementById('sec-prereq').value,
          maxCapacity: Number(document.getElementById('sec-capacity').value),
          perUnitFee: Number(document.getElementById('sec-unit-fee').value),
          labFee: Number(document.getElementById('sec-lab-fee').value)
        };
        const res = await apiFetch('/api/registrar/section', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        state.registrarEditSection = null;
        await refreshStaffPortal();
        showToast(res.message, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    async registrarSaveCourse() {
      try {
        const courseCode = document.getElementById('reg-course-code').value;
        const courseDescription = document.getElementById('reg-course-desc').value;
        const courseCost = document.getElementById('reg-course-cost').value;
        const durationYears = document.getElementById('reg-course-years').value;
        const res = await apiFetch('/api/registrar/course', {
          method: 'POST',
          body: JSON.stringify({ courseCode, courseDescription, courseCost, durationYears })
        });
        await refreshStaffPortal();
        showToast(res.message, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    async registrarAssignStudentSection() {
      try {
        const studentId = document.getElementById('assign-student-id').value;
        const sectionId = document.getElementById('assign-section-id').value;
        const res = await apiFetch('/api/registrar/assign-student-section', {
          method: 'POST',
          body: JSON.stringify({ studentId, sectionId })
        });
        await refreshStaffPortal();
        showToast(res.message, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    registrarOpenTransfer(loadId) {
      const load = (state.staffOverview?.subjectLoads || []).find((l) => Number(l.lngLoadID) === Number(loadId));
      state.registrarTransferLoad = load || null;
      render();
    },
    registrarCancelTransfer() {
      state.registrarTransferLoad = null;
      render();
    },
    async registrarTransferStudent() {
      try {
        const load = state.registrarTransferLoad;
        if (!load) return;
        const toSectionId = document.getElementById('transfer-to-section-id').value;
        const res = await apiFetch('/api/registrar/transfer-student', {
          method: 'POST',
          body: JSON.stringify({
            studentId: load.lngStudentID,
            fromLoadId: load.lngLoadID,
            toSectionId
          })
        });
        state.registrarTransferLoad = null;
        await refreshStaffPortal();
        showToast(res.message, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    async financeVerifyPayment(paymentId, status) {
      try {
        const res = await apiFetch('/api/finance/verify-payment', {
          method: 'POST',
          body: JSON.stringify({ paymentId, status })
        });
        await refreshStaffPortal();
        showToast(res.message, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    async financeLogPromissoryNote() {
      try {
        const studentId = document.getElementById('pn-student-id').value;
        const coveredAmount = document.getElementById('pn-amount').value;
        const deferredDueDate = document.getElementById('pn-due-date').value;
        const agreementTerms = document.getElementById('pn-terms').value;
        const res = await apiFetch('/api/finance/promissory-note', {
          method: 'POST',
          body: JSON.stringify({
            studentId,
            coveredAmount,
            deferredDueDate,
            agreementTerms
          })
        });
        await refreshStaffPortal();
        showToast(res.message, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    async facultySaveGrade(loadId) {
      try {
        const sel = document.getElementById(`grade-sel-${loadId}`);
        const grade = sel ? sel.value : '1.25';
        const res = await apiFetch('/api/faculty/encode-grade', {
          method: 'POST',
          body: JSON.stringify({ loadId, grade })
        });
        await refreshStaffPortal();
        showToast(res.message, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    async adminSaveSystemConfig() {
      try {
        const activeSemester = document.getElementById('cfg-semester').value;
        const defaultPerUnitFee = document.getElementById('cfg-unit-fee').value;
        const defaultMiscFee = document.getElementById('cfg-misc-fee').value;
        const applicationsOpen = document.getElementById('cfg-apps-open').value;
        const res = await apiFetch('/api/admin/system-config', {
          method: 'POST',
          body: JSON.stringify({ activeSemester, defaultPerUnitFee, defaultMiscFee, applicationsOpen })
        });
        await refreshStaffPortal();
        showToast(res.message, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    async adminCreateEmployee() {
      try {
        const empCode = document.getElementById('adm-emp-code').value;
        const empName = document.getElementById('adm-emp-name').value;
        const email = document.getElementById('adm-emp-email').value;
        const positionId = document.getElementById('adm-emp-pos').value;
        const accessRole = document.getElementById('adm-emp-role').value;
        const department = document.getElementById('adm-emp-dept').value;
        if (!empName || !email) return showToast('Please enter the employee full name and email.', 'error');
        const res = await apiFetch('/api/admin/employee', {
          method: 'POST',
          body: JSON.stringify({ empCode, empName, email, positionId, accessRole, department })
        });
        await refreshStaffPortal();
        showToast(res.message, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    async adminUpdateEmployee(empId) {
      try {
        const empCode = document.getElementById(`adm-code-${empId}`).value;
        const accessRole = document.getElementById(`adm-role-${empId}`).value;
        const ysnActive = document.getElementById(`adm-active-${empId}`).value;
        const res = await apiFetch('/api/admin/manage-account', {
          method: 'POST',
          body: JSON.stringify({
            accountType: 'staff',
            accountId: empId,
            action: 'update',
            empCode,
            accessRole,
            ysnActive
          })
        });
        await refreshStaffPortal();
        showToast(res.message, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    async adminResetPassword(accountType, accountId) {
      const newPassword = window.prompt('Enter new password (minimum 8 characters):');
      if (!newPassword) return;
      try {
        const res = await apiFetch('/api/admin/manage-account', {
          method: 'POST',
          body: JSON.stringify({
            accountType,
            accountId,
            action: 'reset-password',
            newPassword
          })
        });
        showToast(res.message, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  };

  // Initialize portal on DOM load
  document.addEventListener('DOMContentLoaded', () => {
    render();
    loadPublicBootstrap();
  });
})();

