// app.js — Main application logic

// ===== STATE =====
let currentScreen = 'home';
let currentSubject = null;
let currentFormat = null;
let qwiseMarks = {};  // { partIndex_questionIndex: value }
let pwiseMarks = {};  // { pageNum: value }
let adminSessionTimeout = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  await initDB();
  updateTopbarTitle('Mark Verification');
  registerServiceWorker();
});

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// ===== NAVIGATION =====
function navigate(screen) {
  const screens = document.querySelectorAll('.screen');
  screens.forEach(s => s.classList.remove('active'));
  const target = document.getElementById('screen-' + screen);
  if (target) { target.classList.add('active'); currentScreen = screen; }
  closeMenu();

  const titles = {
    'home': 'Mark Verification', 'admin-login': 'Admin Login',
    'format-setup': 'Format Setup', 'user-subject': 'Select Subject',
    'qwise': 'Mark Entry', 'pwise': 'Page-wise Entry'
  };
  updateTopbarTitle(titles[screen] || 'Mark Verification');

  if (screen === 'user-subject') loadUserSubjectDropdown();
  if (screen === 'pwise') buildPageGrid();
}

function updateTopbarTitle(title) {
  document.getElementById('topbar-title').textContent = title;
}

// ===== SIDEBAR =====
function openMenu() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.remove('hidden');
}
function closeMenu() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.add('hidden');
}

// ===== MODAL =====
function showModal({ icon, title, message, buttons }) {
  document.getElementById('modal-icon').textContent = icon || '';
  document.getElementById('modal-title').textContent = title || '';
  document.getElementById('modal-message').textContent = message || '';
  const btnContainer = document.getElementById('modal-buttons');
  btnContainer.innerHTML = '';
  (buttons || []).forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'modal-btn ' + (b.cls || 'primary');
    btn.textContent = b.label;
    btn.onclick = () => { closeModal(); b.action && b.action(); };
    btnContainer.appendChild(btn);
  });
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

// ===== ADMIN LOGIN =====
function togglePassword(fieldId, btn) {
  const field = document.getElementById(fieldId);
  if (field.type === 'password') { field.type = 'text'; btn.textContent = '🙈'; }
  else { field.type = 'password'; btn.textContent = '👁️'; }
}

let loginAttempts = 0;
let lockoutUntil = 0;

function adminLogin() {
  const now = Date.now();
  if (now < lockoutUntil) {
    const secs = Math.ceil((lockoutUntil - now) / 1000);
    showModal({ icon: '🔒', title: 'Locked', message: `Too many failed attempts. Try again in ${secs} seconds.`, buttons: [{ label: 'OK', cls: 'primary' }] });
    return;
  }
  const user = document.getElementById('admin-username').value.trim();
  const pass = document.getElementById('admin-password').value;
  const errEl = document.getElementById('login-error');
  if (user === 'DGEExam' && pass === 'Dgeexam@2026') {
    loginAttempts = 0; errEl.classList.add('hidden');
    document.getElementById('admin-username').value = '';
    document.getElementById('admin-password').value = '';
    startAdminSession();
    resetFormatSetup();
    navigate('format-setup');
  } else {
    loginAttempts++;
    errEl.classList.remove('hidden');
    if (loginAttempts >= 5) {
      lockoutUntil = Date.now() + 15 * 60 * 1000; // 15 min
      loginAttempts = 0;
      errEl.textContent = 'Too many attempts. Locked for 15 minutes.';
    }
  }
}

function startAdminSession() {
  clearTimeout(adminSessionTimeout);
  adminSessionTimeout = setTimeout(() => {
    showModal({ icon: '⏰', title: 'Session Expired', message: 'Admin session timed out after 15 minutes of inactivity.', buttons: [{ label: 'OK', cls: 'primary', action: () => navigate('home') }] });
  }, 15 * 60 * 1000);
}

// ===== FORMAT SETUP =====
let selectedSubjectForFormat = null;
let partCount = 0;

function resetFormatSetup() {
  selectedSubjectForFormat = null;
  partCount = 0;
  document.getElementById('format-subject-input').value = '';
  document.getElementById('selected-subject-display').classList.add('hidden');
  document.getElementById('format-parts-card').style.display = 'none';
  document.getElementById('parts-container').innerHTML = '';
  document.getElementById('subject-dropdown').classList.add('hidden');
}

async function filterSubjects(val) {
  const dd = document.getElementById('subject-dropdown');
  if (!val || val.length < 1) { dd.classList.add('hidden'); return; }
  const all = await getSubjects();
  const filtered = all.filter(s => s.toLowerCase().includes(val.toLowerCase()));
  if (!filtered.length) { dd.classList.add('hidden'); return; }
  dd.innerHTML = filtered.map(s =>
    `<div class="subject-option" onclick="selectFormatSubject('${s.replace(/'/g, "\\'")}')">${s}</div>`
  ).join('');
  dd.classList.remove('hidden');
}

async function selectFormatSubject(subject) {
  document.getElementById('format-subject-input').value = subject;
  document.getElementById('subject-dropdown').classList.add('hidden');
  const exists = await checkFormatExists(subject);
  if (exists) {
    showModal({
      icon: '⚠️', title: 'Format Exists',
      message: `Format for "${subject}" is already entered.`,
      buttons: [{ label: 'OK', cls: 'primary', action: () => {
        document.getElementById('format-subject-input').value = '';
        document.getElementById('selected-subject-display').classList.add('hidden');
        document.getElementById('format-parts-card').style.display = 'none';
      }}]
    });
    return;
  }
  selectedSubjectForFormat = subject;
  const display = document.getElementById('selected-subject-display');
  display.textContent = '📚 ' + subject;
  display.classList.remove('hidden');
  document.getElementById('format-parts-card').style.display = 'block';
  document.getElementById('parts-container').innerHTML = '';
  partCount = 0;
  addPart();
}

function addPart() {
  if (partCount >= 9) {
    showModal({ icon: '⚠️', title: 'Limit Reached', message: 'Maximum 9 parts allowed.', buttons: [{ label: 'OK', cls: 'primary' }] });
    return;
  }
  partCount++;
  const pc = document.getElementById('parts-container');
  const div = document.createElement('div');
  div.className = 'part-card';
  div.id = 'part-' + partCount;
  div.innerHTML = `
    <div class="part-card-title">Part ${partCount}</div>
    <div class="form-group">
      <label>Part Number / Name</label>
      <input type="text" id="pnum-${partCount}" placeholder="e.g. Part A, Section I" />
    </div>
    <div class="form-group">
      <label>Either-or Choice</label>
      <div class="radio-group">
        <label class="radio-label"><input type="radio" name="eoc-${partCount}" value="No" checked /> No</label>
        <label class="radio-label"><input type="radio" name="eoc-${partCount}" value="Yes" /> Yes</label>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Marks / Question</label>
        <input type="number" id="mpq-${partCount}" placeholder="e.g. 5" min="0.5" step="0.5" />
      </div>
      <div class="form-group">
        <label>Total Questions</label>
        <input type="number" id="tq-${partCount}" placeholder="e.g. 10" min="1" step="1" />
      </div>
      <div class="form-group">
        <label>Qs Answered</label>
        <input type="number" id="qa-${partCount}" placeholder="e.g. 5" min="1" step="1" />
      </div>
    </div>
  `;
  pc.appendChild(div);
}

function removePart() {
  if (partCount < 1) return;
  const el = document.getElementById('part-' + partCount);
  if (el) el.remove();
  partCount--;
}

async function saveFormat() {
  if (!selectedSubjectForFormat) {
    showModal({ icon: '⚠️', title: 'No Subject', message: 'Please select a subject first.', buttons: [{ label: 'OK', cls: 'primary' }] });
    return;
  }
  if (partCount < 1) {
    showModal({ icon: '⚠️', title: 'No Parts', message: 'Please add at least one part.', buttons: [{ label: 'OK', cls: 'primary' }] });
    return;
  }
  // Validate
  for (let i = 1; i <= partCount; i++) {
    const pnum = document.getElementById('pnum-' + i)?.value?.trim();
    const mpq = parseFloat(document.getElementById('mpq-' + i)?.value);
    const tq = parseInt(document.getElementById('tq-' + i)?.value);
    const qa = parseInt(document.getElementById('qa-' + i)?.value);
    if (!pnum) { showModal({ icon: '❌', title: 'Validation Error', message: `Part ${i}: Part Number is required.`, buttons: [{ label: 'OK', cls: 'danger' }] }); return; }
    if (isNaN(mpq) || mpq <= 0) { showModal({ icon: '❌', title: 'Validation Error', message: `Part ${i}: Marks per question must be > 0.`, buttons: [{ label: 'OK', cls: 'danger' }] }); return; }
    if (isNaN(tq) || tq < 1) { showModal({ icon: '❌', title: 'Validation Error', message: `Part ${i}: Total questions must be ≥ 1.`, buttons: [{ label: 'OK', cls: 'danger' }] }); return; }
    if (isNaN(qa) || qa < 1 || qa > tq) { showModal({ icon: '❌', title: 'Validation Error', message: `Part ${i}: Questions answered must be between 1 and ${tq}.`, buttons: [{ label: 'OK', cls: 'danger' }] }); return; }
  }
  // Build format object
  const fmt = { Subject: selectedSubjectForFormat };
  for (let i = 1; i <= partCount; i++) {
    const eoc = document.querySelector(`input[name="eoc-${i}"]:checked`)?.value || 'No';
    fmt[`part_number${i}`] = document.getElementById('pnum-' + i).value.trim();
    fmt[`either_or_choice${i}`] = eoc;
    fmt[`Marks_per_Questions${i}`] = parseFloat(document.getElementById('mpq-' + i).value);
    fmt[`Total_Questions${i}`] = parseInt(document.getElementById('tq-' + i).value);
    fmt[`Questions_Answered${i}`] = parseInt(document.getElementById('qa-' + i).value);
  }
  fmt._partCount = partCount;
  await saveFormat(fmt);

  // Ask about replication
  showModal({
    icon: '📋', title: 'Copy Format?',
    message: 'Is this format the same as another subject? Would you like to copy it?',
    buttons: [
      { label: 'Yes', cls: 'primary', action: () => showReplicationModal(fmt) },
      { label: 'No', cls: 'secondary', action: () => {
        showModal({ icon: '✅', title: 'Saved!', message: `Format saved successfully for "${selectedSubjectForFormat}".`,
          buttons: [{ label: 'OK', cls: 'success', action: () => { resetFormatSetup(); navigate('format-setup'); } }] });
      }}
    ]
  });
}

async function showReplicationModal(fmt) {
  const allSubjects = await getSubjects();
  const existingFormats = await getAllFormats();
  const alreadyHasFormat = existingFormats.map(f => f.Subject);
  const available = allSubjects.filter(s => s !== fmt.Subject && !alreadyHasFormat.includes(s));

  if (!available.length) {
    showModal({ icon: 'ℹ️', title: 'No Subjects', message: 'No other subjects available for copying.', buttons: [{ label: 'OK', cls: 'primary' }] });
    return;
  }

  let checkboxHTML = '<div class="replication-list">';
  available.forEach(s => {
    const sid = 'rep-' + s.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    checkboxHTML += `<div class="replication-item"><input type="checkbox" id="${sid}" value="${s}" /><label for="${sid}">${s}</label></div>`;
  });
  checkboxHTML += '</div>';

  document.getElementById('modal-icon').textContent = '📑';
  document.getElementById('modal-title').textContent = 'Select Subjects to Copy';
  document.getElementById('modal-message').innerHTML = checkboxHTML;
  const btnContainer = document.getElementById('modal-buttons');
  btnContainer.innerHTML = '';

  const applyBtn = document.createElement('button');
  applyBtn.className = 'modal-btn success'; applyBtn.textContent = 'Copy Format';
  applyBtn.onclick = async () => {
    const checked = Array.from(document.querySelectorAll('.replication-list input:checked')).map(c => c.value);
    if (!checked.length) { alert('Select at least one subject.'); return; }
    for (const subj of checked) {
      const copy = { ...fmt, Subject: subj };
      await saveFormat(copy);
    }
    closeModal();
    showModal({ icon: '✅', title: 'Saved!',
      message: `Format copied to: ${checked.join(', ')}`,
      buttons: [{ label: 'OK', cls: 'success', action: () => { resetFormatSetup(); navigate('format-setup'); } }]
    });
  };

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'modal-btn secondary'; cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = () => { closeModal(); resetFormatSetup(); navigate('format-setup'); };

  btnContainer.appendChild(applyBtn); btnContainer.appendChild(cancelBtn);
  document.getElementById('modal-overlay').classList.remove('hidden');
}

// ===== USER - SUBJECT SELECTION =====
async function loadUserSubjectDropdown() {
  const sel = document.getElementById('user-subject-select');
  sel.innerHTML = '<option value="">-- Select Subject --</option>';
  const subjects = await getSubjects();
  subjects.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    sel.appendChild(opt);
  });
}

async function userSelectSubject() {
  const sel = document.getElementById('user-subject-select');
  const subject = sel.value;
  if (!subject) {
    showModal({ icon: '⚠️', title: 'No Subject', message: 'Please select a subject.', buttons: [{ label: 'OK', cls: 'primary' }] });
    return;
  }
  const fmt = await getFormat(subject);
  if (!fmt) {
    showModal({ icon: '❌', title: 'Format Not Found', message: 'Format not configured for this subject. Please contact admin.', buttons: [{ label: 'OK', cls: 'danger' }] });
    return;
  }
  showModal({
    icon: '📋', title: 'Format Ready',
    message: `Format is already stored for "${subject}". Proceeding with this format.`,
    buttons: [{ label: 'OK', cls: 'success', action: () => {
      currentSubject = subject;
      currentFormat = fmt;
      qwiseMarks = {}; pwiseMarks = {};
      buildQwiseForm();
      navigate('qwise');
    }}]
  });
}

// ===== QUESTION-WISE ENTRY =====
function buildQwiseForm() {
  document.getElementById('qwise-title').textContent = `Q-wise Entry — ${currentSubject}`;
  const container = document.getElementById('qwise-form');
  container.innerHTML = '';
  const partCount = currentFormat._partCount || 9;

  for (let i = 1; i <= partCount; i++) {
    if (!currentFormat[`part_number${i}`]) break;
    const pnum = currentFormat[`part_number${i}`];
    const eoc = currentFormat[`either_or_choice${i}`] === 'Yes';
    const mpq = currentFormat[`Marks_per_Questions${i}`];
    const tq = currentFormat[`Total_Questions${i}`];
    const qa = currentFormat[`Questions_Answered${i}`];
    const maxTotal = mpq * qa;

    const card = document.createElement('div');
    card.className = 'qpart-card';
    card.innerHTML = `
      <div class="qpart-title">
        ${pnum}
        <span class="qpart-maxmarks">Max: ${maxTotal}</span>
      </div>
    `;

    for (let q = 1; q <= tq; q++) {
      const row = document.createElement('div');
      row.className = 'question-row';
      const qLabel = eoc ? `Q${Math.ceil(q / 2)}${q % 2 === 1 ? 'a' : 'b'}` : `Q${q}`;
      const key = `${i}_${q}`;
      row.innerHTML = `
        <div class="question-num">${q}</div>
        <div class="question-label">${qLabel}${eoc ? ' (Either/Or)' : ''}</div>
        <input type="number" class="question-input" id="qmark-${key}"
          min="0" max="${mpq}" step="0.01" placeholder="0"
          oninput="onQmarkInput(${i},${q},${mpq},${tq},${qa})" inputmode="decimal" />
        <div class="question-max">/ ${mpq}</div>
      `;
      card.appendChild(row);
    }
    container.appendChild(card);
  }
  updateQwiseTotal();
}

function onQmarkInput(partIdx, qIdx, mpq, tq, qa) {
  const key = `${partIdx}_${qIdx}`;
  const input = document.getElementById('qmark-' + key);
  let val = parseFloat(input.value);
  if (isNaN(val) || val < 0) { input.value = ''; qwiseMarks[key] = 0; }
  else if (val > mpq) { input.value = mpq; qwiseMarks[key] = mpq; }
  else { qwiseMarks[key] = val; }

  // Count non-zero answers in this part
  let filledCount = 0;
  for (let q = 1; q <= tq; q++) {
    const v = parseFloat(document.getElementById(`qmark-${partIdx}_${q}`)?.value) || 0;
    if (v > 0) filledCount++;
  }
  // Disable remaining if answered enough
  for (let q = 1; q <= tq; q++) {
    const el = document.getElementById(`qmark-${partIdx}_${q}`);
    if (!el) continue;
    const v = parseFloat(el.value) || 0;
    if (filledCount >= qa && v === 0) el.disabled = true;
    else el.disabled = false;
  }
  updateQwiseTotal();
}

function updateQwiseTotal() {
  let total = 0;
  document.querySelectorAll('.question-input').forEach(inp => {
    total += parseFloat(inp.value) || 0;
  });
  document.getElementById('qwise-total').value = total.toFixed(2);
}

// ===== PAGE-WISE ENTRY =====
function buildPageGrid() {
  document.getElementById('pwise-title').textContent = `Page-wise Entry — ${currentSubject}`;
  const grid = document.getElementById('page-grid');
  grid.innerHTML = '';
  for (let p = 1; p <= 70; p++) {
    const cell = document.createElement('div');
    cell.className = 'page-cell';
    cell.innerHTML = `
      <span class="page-num">P${p}</span>
      <input type="number" class="page-input" id="pmark-${p}"
        min="0" step="0.01" placeholder="0" inputmode="decimal"
        oninput="onPmarkInput(${p})" />
    `;
    grid.appendChild(cell);
  }
  // Restore saved values
  Object.entries(pwiseMarks).forEach(([p, v]) => {
    const el = document.getElementById('pmark-' + p);
    if (el) el.value = v;
  });
  updatePwiseTotal();
}

function onPmarkInput(page) {
  const el = document.getElementById('pmark-' + page);
  let val = parseFloat(el.value);
  if (isNaN(val) || val < 0) { el.value = ''; pwiseMarks[page] = 0; }
  else { pwiseMarks[page] = val; }
  updatePwiseTotal();
}

function updatePwiseTotal() {
  let total = 0;
  for (let p = 1; p <= 70; p++) {
    total += parseFloat(document.getElementById('pmark-' + p)?.value) || 0;
  }
  document.getElementById('pwise-total').value = total.toFixed(2);
}

// ===== VERIFICATION =====
function verifyTotals() {
  const qTotal = parseFloat(document.getElementById('qwise-total')?.value) || 0;
  const pTotal = parseFloat(document.getElementById('pwise-total')?.value) || 0;

  if (Math.abs(qTotal - pTotal) < 0.001) {
    showModal({
      icon: '🎉', title: 'Success!',
      message: `Totals match! (Q-wise: ${qTotal.toFixed(2)} = P-wise: ${pTotal.toFixed(2)})\n\nProceed to Next Script.`,
      buttons: [{ label: 'OK — Next Script', cls: 'success', action: () => {
        qwiseMarks = {}; pwiseMarks = {};
        currentSubject = null; currentFormat = null;
        navigate('user-subject');
      }}]
    });
  } else {
    showModal({
      icon: '❌', title: 'Mismatch!',
      message: `Totals do not match!\n\nQ-wise Total: ${qTotal.toFixed(2)}\nPage-wise Total: ${pTotal.toFixed(2)}\n\nDifference: ${Math.abs(qTotal - pTotal).toFixed(2)}\n\nPlease review and correct.`,
      buttons: [{ label: 'Review Q-wise', cls: 'danger', action: () => navigate('qwise') },
                { label: 'Review P-wise', cls: 'secondary', action: () => navigate('pwise') }]
    });
  }
}
