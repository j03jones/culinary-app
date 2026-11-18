/* ==========================================================================
   Instructor Admin & Canvas Importer Logic
   ASU–Newport Culinary Arts · Chef Joseph Jones
   ========================================================================== */

(() => {
  'use strict';

  const CLASSES = ['culinary2', 'baking', 'bar'];
  const CLASS_NAMES = {
    culinary2: 'Culinary 2',
    baking: 'Baking & Pastry',
    bar: 'Bar & Beverage'
  };

  let activeClass = 'culinary2';
  let courseState = {};
  let pendingImport = null;

  // Initialize course data from custom storage or defaults
  function loadCourseState(id) {
    let custom = null;
    try {
      const saved = localStorage.getItem('CULINARY_CUSTOM_DATA_' + id);
      if (saved) custom = JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse custom data for', id, e);
    }

    if (custom) return custom;

    const defaults = {
      culinary2: window.CULINARY2_DEFAULT_DATA,
      baking: window.BAKING_DEFAULT_DATA,
      bar: window.BAR_DEFAULT_DATA
    };

    const d = defaults[id];
    return d ? JSON.parse(JSON.stringify(d)) : null;
  }

  function initAllState() {
    CLASSES.forEach(id => {
      courseState[id] = loadCourseState(id);
    });
  }

  // Save current active class data to localStorage
  function saveCourseData(id, showNotice = true) {
    if (!courseState[id]) return;
    try {
      localStorage.setItem('CULINARY_CUSTOM_DATA_' + id, JSON.stringify(courseState[id]));
      syncScheduleData();
      if (window.reloadClass) window.reloadClass(id);
      if (showNotice) showToast('Saved ' + CLASS_NAMES[id] + ' changes successfully!');
    } catch (e) {
      console.error(e);
      alert('Error saving data: ' + e.message);
    }
  }

  // Synchronize master schedule across all courses
  function syncScheduleData() {
    try {
      const schedule = CLASSES.map(id => {
        const c = courseState[id];
        if (!c) return null;
        return {
          id: id,
          name: c.course ? (c.course.short || c.course.name) : CLASS_NAMES[id],
          time: c.course ? c.course.time : '',
          room: c.course ? c.course.room : '',
          sessions: (c.sessions || []).map(s => {
            let rNames = [];
            if (Array.isArray(s.recipes)) {
              rNames = s.recipes.map(rId => {
                if (typeof rId === 'string') {
                  const found = (c.recipes || []).find(r => r.id === rId);
                  return found ? found.name : rId;
                }
                return rId.name || String(rId);
              });
            }
            return {
              date: s.date || '',
              title: s.title || '',
              recipes: rNames
            };
          })
        };
      }).filter(Boolean);

      localStorage.setItem('CULINARY_CUSTOM_SCHEDULE', JSON.stringify(schedule));
    } catch (e) {
      console.warn('Error syncing schedule data:', e);
    }
  }

  // Toast notification
  function showToast(msg) {
    let t = document.getElementById('adminToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'adminToast';
      t.className = 'admin-toast';
      document.body.appendChild(t);
    }
    t.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> <span>${msg}</span>`;
    t.classList.add('is-active');
    setTimeout(() => t.classList.remove('is-active'), 3200);
  }

  // Build the Admin Modal UI
  function renderAdminModal() {
    if (document.getElementById('adminModalBackdrop')) return;

    const backdrop = document.createElement('div');
    backdrop.id = 'adminModalBackdrop';
    backdrop.className = 'admin-modal-backdrop';

    backdrop.innerHTML = `
      <div class="admin-modal" role="dialog" aria-modal="true" aria-labelledby="adminHeaderTitle">
        
        <header class="admin-header">
          <div class="admin-header-title">
            <span class="admin-badge">Instructor Admin</span>
            <div>
              <h2 id="adminHeaderTitle">Course Manager &amp; Canvas Importer</h2>
              <p>Arkansas State University – Newport · Chef Joseph Jones</p>
            </div>
          </div>
          <button class="admin-close-btn" id="closeAdminBtn" aria-label="Close Admin Modal">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </header>

        <div class="admin-course-bar">
          <div class="admin-course-selector">
            <label>Editing Course:</label>
            <div class="admin-pill-group" id="adminCoursePills">
              <button class="admin-pill is-active" data-class="culinary2">Culinary 2</button>
              <button class="admin-pill" data-class="baking">Baking &amp; Pastry</button>
              <button class="admin-pill" data-class="bar">Bar &amp; Beverage</button>
            </div>
          </div>
          <div class="admin-course-badge">
            <span class="dot"></span>
            <span id="adminActiveBadge">Culinary 2 (Flex I)</span>
          </div>
        </div>

        <nav class="admin-tabs" role="tablist">
          <button class="admin-tab is-active" data-tab="tab-course">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            <span>Course &amp; Instructor</span>
          </button>
          <button class="admin-tab" data-tab="tab-canvas">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Canvas Importer</span>
          </button>
          <button class="admin-tab" data-tab="tab-sessions">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>Sessions &amp; Labs</span>
          </button>
          <button class="admin-tab" data-tab="tab-recipes">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11h14v4a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z"/><path d="M17 13h4M7 4c0 1.5 1 1.5 1 3M11 4c0 1.5 1 1.5 1 3"/></svg>
            <span>Lab Recipes</span>
          </button>
          <button class="admin-tab" data-tab="tab-export">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            <span>Export &amp; Sync</span>
          </button>
        </nav>

        <div class="admin-body">
          
          <!-- TAB 1: Course & Instructor -->
          <div class="admin-panel is-active" id="panel-tab-course">
            <div class="admin-section">
              <div class="admin-section-title">Instructor Information</div>
              <div class="admin-grid-3">
                <div class="admin-form-group">
                  <label>Instructor Name &amp; Title</label>
                  <input type="text" class="admin-input" id="inpInstructor" placeholder="Chef Joseph Jones">
                </div>
                <div class="admin-form-group">
                  <label>Institution / School</label>
                  <input type="text" class="admin-input" id="inpSchool" placeholder="Arkansas State University – Newport">
                </div>
                <div class="admin-form-group">
                  <label>Department</label>
                  <input type="text" class="admin-input" id="inpDept" placeholder="Culinary Department">
                </div>
              </div>
            </div>

            <div class="admin-section">
              <div class="admin-section-title">Course Details</div>
              <div class="admin-grid-2">
                <div class="admin-form-group">
                  <label>Course Title</label>
                  <input type="text" class="admin-input" id="inpCourseName">
                </div>
                <div class="admin-form-group">
                  <label>Short Title (Navigation)</label>
                  <input type="text" class="admin-input" id="inpCourseShort">
                </div>
              </div>
              <div class="admin-grid-3">
                <div class="admin-form-group">
                  <label>Term / Semester</label>
                  <input type="text" class="admin-input" id="inpTerm" placeholder="Spring 2027">
                </div>
                <div class="admin-form-group">
                  <label>Class Room / Kitchen</label>
                  <input type="text" class="admin-input" id="inpRoom" placeholder="D508">
                </div>
                <div class="admin-form-group">
                  <label>Meeting Time &amp; Days</label>
                  <input type="text" class="admin-input" id="inpTime" placeholder="Mon–Thu · 9:30 AM–1:00 PM">
                </div>
              </div>
              <div class="admin-grid-2">
                <div class="admin-form-group">
                  <label>Start Date (YYYY-MM-DD)</label>
                  <input type="date" class="admin-input" id="inpStartDate">
                </div>
                <div class="admin-form-group">
                  <label>End Date (YYYY-MM-DD)</label>
                  <input type="date" class="admin-input" id="inpEndDate">
                </div>
              </div>
              <div class="admin-form-group">
                <label>Textbook &amp; Required Readings</label>
                <input type="text" class="admin-input" id="inpTextbook">
              </div>
            </div>

            <div class="admin-actions">
              <button class="admin-btn admin-btn-primary" id="btnSaveCourseInfo">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
                <span>Save Course Info</span>
              </button>
            </div>
          </div>

          <!-- TAB 2: Canvas Importer -->
          <div class="admin-panel" id="panel-tab-canvas">
            <div class="admin-section">
              <div class="admin-section-title">Import Canvas Course Files</div>
              <p style="font-size:13px;color:var(--admin-muted);margin:0 0 16px;">
                Upload files exported directly from Canvas LMS to automatically populate or update your syllabus, dates, class sessions, and assignments.
              </p>

              <div class="canvas-dropzone" id="canvasDropzone">
                <input type="file" id="canvasFileInput" style="display:none" accept=".imscc,.zip,.ics,.csv,.json">
                <svg class="canvas-dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <h3>Choose a Canvas file or drag &amp; drop it here</h3>
                <p>Supports Canvas Course Export (.imscc / .zip), Canvas Calendar (.ics), CSV schedules, and JSON backups.</p>
                <div class="canvas-format-tags">
                  <span class="canvas-tag">.imscc (Canvas Export)</span>
                  <span class="canvas-tag">.ics (Canvas Calendar Feed)</span>
                  <span class="canvas-tag">.zip</span>
                  <span class="canvas-tag">.csv</span>
                  <span class="canvas-tag">.json</span>
                </div>
              </div>

              <!-- Canvas Instructions Accordion -->
              <details style="background:var(--admin-bg);border:1px solid var(--admin-border);border-radius:6px;padding:12px;font-size:12px;color:var(--admin-muted);">
                <summary style="cursor:pointer;font-weight:600;color:var(--admin-ink);">How to export from Canvas LMS</summary>
                <div style="margin-top:10px;line-height:1.6;">
                  <strong>Option A: Canvas Course Export (.imscc)</strong><br>
                  1. In Canvas, open your course.<br>
                  2. Click <strong>Settings</strong> at the bottom of course navigation.<br>
                  3. In the right sidebar, click <strong>Export Course Content</strong>.<br>
                  4. Choose <strong>Course</strong> as export type and click <strong>Create Export</strong>.<br>
                  5. Download the <code>.imscc</code> file and drop it above!<br><br>
                  <strong>Option B: Canvas Calendar (.ics)</strong><br>
                  1. In Canvas, click <strong>Calendar</strong> in the global left navigation.<br>
                  2. In the right sidebar, click <strong>Calendar Feed</strong>.<br>
                  3. Download the <code>.ics</code> link or file and drop it above.
                </div>
              </details>
            </div>

            <!-- Import Preview Card -->
            <div class="import-preview" id="importPreviewCard">
              <div class="admin-section-title">
                <span>Detected Canvas Content</span>
                <span id="importFileName" style="font-size:12px;color:var(--admin-accent);font-weight:normal;"></span>
              </div>

              <div class="import-stats">
                <div class="import-stat-card">
                  <div class="import-stat-val" id="statSessionsCount">0</div>
                  <div class="import-stat-label">Class Sessions / Events</div>
                </div>
                <div class="import-stat-card">
                  <div class="import-stat-val" id="statWeeksCount">0</div>
                  <div class="import-stat-label">Course Weeks / Modules</div>
                </div>
                <div class="import-stat-card">
                  <div class="import-stat-val" id="statAssignmentsCount">0</div>
                  <div class="import-stat-label">Assignments / Quizzes</div>
                </div>
              </div>

              <div class="import-preview-table-wrap">
                <table class="import-table">
                  <thead>
                    <tr>
                      <th style="width:100px;">Date</th>
                      <th>Title / Lab Event</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody id="importPreviewTableBody"></tbody>
                </table>
              </div>

              <div class="admin-actions">
                <button class="admin-btn admin-btn-secondary" id="btnCancelImport">Discard</button>
                <button class="admin-btn admin-btn-primary" id="btnApplyImportMerge">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Merge into Active Course</span>
                </button>
                <button class="admin-btn admin-btn-primary" style="background:#2563eb;" id="btnApplyImportReplace">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  <span>Replace Course Sessions</span>
                </button>
              </div>
            </div>
          </div>

          <!-- TAB 3: Sessions & Labs -->
          <div class="admin-panel" id="panel-tab-sessions">
            <div class="admin-section">
              <div class="admin-section-title">
                <span>Class Sessions &amp; Kitchen Labs (<span id="sessionsTotalCount">0</span>)</span>
                <button class="admin-btn admin-btn-primary" id="btnAddSessionBtn" style="font-size:12px;padding:5px 12px;">+ Add Session</button>
              </div>
              <div style="margin-bottom:14px;">
                <input type="text" class="admin-input" id="searchSessionsInp" placeholder="Search sessions by date, title, or topic...">
              </div>
              <div class="admin-sessions-list" id="adminSessionsList"></div>
            </div>
          </div>

          <!-- TAB 4: Lab Recipes -->
          <div class="admin-panel" id="panel-tab-recipes">
            <div class="admin-section">
              <div class="admin-section-title">
                <span>Course Recipes &amp; Formulas (<span id="recipesTotalCount">0</span>)</span>
                <button class="admin-btn admin-btn-primary" id="btnAddRecipeBtn" style="font-size:12px;padding:5px 12px;">+ Add Recipe</button>
              </div>
              <div style="margin-bottom:14px;">
                <input type="text" class="admin-input" id="searchRecipesInp" placeholder="Search recipes by name or category...">
              </div>
              <div class="admin-sessions-list" id="adminRecipesList"></div>
            </div>
          </div>

          <!-- TAB 5: Export & Sync -->
          <div class="admin-panel" id="panel-tab-export">
            <div class="admin-section">
              <div class="admin-section-title">Download &amp; Publish Changes</div>
              <p style="font-size:13px;color:var(--admin-muted);margin:0 0 16px;">
                Your edits are saved immediately in your browser. To make changes permanent in your project files or for hosting on GitHub / web hosting, you can download the updated data files below:
              </p>
              <div class="admin-grid-2">
                <div style="background:var(--admin-bg);border:1px solid var(--admin-border);padding:14px;border-radius:6px;">
                  <h4 style="margin:0 0 6px;font-size:14px;">Current Course Data (data.js)</h4>
                  <p style="margin:0 0 12px;font-size:12px;color:var(--admin-muted);">Downloads the standalone <code>data.js</code> file for <strong id="exportCourseNameLabel">Culinary 2</strong>.</p>
                  <button class="admin-btn admin-btn-secondary" id="btnDownloadDataJs">Download data.js</button>
                </div>
                <div style="background:var(--admin-bg);border:1px solid var(--admin-border);padding:14px;border-radius:6px;">
                  <h4 style="margin:0 0 6px;font-size:14px;">Master Schedule (schedule-data.js)</h4>
                  <p style="margin:0 0 12px;font-size:12px;color:var(--admin-muted);">Synchronizes all 3 courses and downloads the updated <code>schedule-data.js</code> for the weekly schedule &amp; PDF.</p>
                  <button class="admin-btn admin-btn-secondary" id="btnDownloadScheduleJs">Download schedule-data.js</button>
                </div>
              </div>
            </div>

            <div class="admin-section">
              <div class="admin-section-title">App Backup &amp; Reset</div>
              <div class="admin-grid-2">
                <div style="background:var(--admin-bg);border:1px solid var(--admin-border);padding:14px;border-radius:6px;">
                  <h4 style="margin:0 0 6px;font-size:14px;">Complete App Backup</h4>
                  <p style="margin:0 0 12px;font-size:12px;color:var(--admin-muted);">Exports all 3 courses and instructor settings into a single JSON file.</p>
                  <button class="admin-btn admin-btn-primary" id="btnExportFullBackup">Export Backup (.json)</button>
                </div>
                <div style="background:var(--admin-bg);border:1px solid var(--admin-border);padding:14px;border-radius:6px;">
                  <h4 style="margin:0 0 6px;font-size:14px;color:var(--admin-danger);">Reset to Defaults</h4>
                  <p style="margin:0 0 12px;font-size:12px;color:var(--admin-muted);">Clears your browser customizations for the active course and restores the original ASU-Newport files.</p>
                  <button class="admin-btn admin-btn-danger" id="btnResetToDefaults">Reset to Defaults</button>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    `;

    document.body.appendChild(backdrop);
    bindAdminEvents(backdrop);
  }

  // Populate Course Tab fields
  function populateCourseForm() {
    const c = courseState[activeClass];
    if (!c || !c.course) return;
    const info = c.course;

    document.getElementById('inpInstructor').value = info.instructor || 'Chef Joseph Jones';
    document.getElementById('inpSchool').value = info.school || 'Arkansas State University – Newport';
    document.getElementById('inpDept').value = info.dept || 'Culinary Department';
    document.getElementById('inpCourseName').value = info.name || '';
    document.getElementById('inpCourseShort').value = info.short || '';
    document.getElementById('inpTerm').value = info.term || '';
    document.getElementById('inpRoom').value = info.room || '';
    document.getElementById('inpTime').value = info.time || '';
    document.getElementById('inpStartDate').value = info.start || '';
    document.getElementById('inpEndDate').value = info.end || '';
    document.getElementById('inpTextbook').value = info.textbook || '';

    const badge = document.getElementById('adminActiveBadge');
    if (badge) badge.textContent = `${CLASS_NAMES[activeClass]} (${info.term || 'Active'})`;

    const expLabel = document.getElementById('exportCourseNameLabel');
    if (expLabel) expLabel.textContent = CLASS_NAMES[activeClass];
  }

  // Populate Sessions List
  function renderSessionsList(filterText = '') {
    const container = document.getElementById('adminSessionsList');
    if (!container) return;
    const c = courseState[activeClass];
    if (!c || !c.sessions) {
      container.innerHTML = '<p style="color:var(--admin-muted);font-size:13px;">No sessions found.</p>';
      return;
    }

    const countSpan = document.getElementById('sessionsTotalCount');
    if (countSpan) countSpan.textContent = c.sessions.length;

    const query = filterText.toLowerCase().trim();
    const filtered = c.sessions.filter(s => {
      if (!query) return true;
      return (s.title && s.title.toLowerCase().includes(query)) ||
             (s.date && s.date.includes(query)) ||
             (s.topic && s.topic.toLowerCase().includes(query));
    });

    if (filtered.length === 0) {
      container.innerHTML = '<p style="color:var(--admin-muted);font-size:13px;padding:12px;">No matching sessions found.</p>';
      return;
    }

    container.innerHTML = filtered.map((s, idx) => {
      const rCount = Array.isArray(s.recipes) ? s.recipes.length : 0;
      return `
        <div class="session-item">
          <div class="session-meta">
            <span class="session-date-badge">${s.date || 'TBA'}</span>
            <div>
              <div class="session-title-text">${s.title || 'Untitled Session'}</div>
              <div class="session-recipes-count">
                ${s.topic ? s.topic.slice(0, 60) + '... · ' : ''}
                ${rCount} recipe${rCount === 1 ? '' : 's'}
              </div>
            </div>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="admin-btn admin-btn-secondary edit-session-btn" data-index="${idx}" style="font-size:11px;padding:4px 8px;">Edit</button>
            <button class="admin-btn admin-btn-danger del-session-btn" data-index="${idx}" style="font-size:11px;padding:4px 8px;">Delete</button>
          </div>
        </div>
      `;
    }).join('');

    // Bind session edit/delete
    container.querySelectorAll('.edit-session-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.index, 10);
        editSessionPrompt(filtered[i]);
      });
    });

    container.querySelectorAll('.del-session-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.index, 10);
        if (confirm(`Delete session "${filtered[i].title}"?`)) {
          const actualIndex = c.sessions.indexOf(filtered[i]);
          if (actualIndex > -1) {
            c.sessions.splice(actualIndex, 1);
            saveCourseData(activeClass);
            renderSessionsList(filterText);
          }
        }
      });
    });
  }

  // Edit / Add Session Prompt
  function editSessionPrompt(session = null) {
    const isNew = !session;
    const title = prompt('Session Title:', session ? session.title : 'New Culinary Lab');
    if (!title) return;
    const date = prompt('Session Date (YYYY-MM-DD):', session ? session.date : new Date().toISOString().slice(0, 10));
    if (!date) return;
    const topic = prompt('Topic / Reading:', session ? (session.topic || '') : '');

    const c = courseState[activeClass];
    if (isNew) {
      c.sessions = c.sessions || [];
      c.sessions.push({
        n: c.sessions.length + 1,
        date: date,
        title: title,
        topic: topic,
        recipes: []
      });
    } else {
      session.title = title;
      session.date = date;
      session.topic = topic;
    }
    saveCourseData(activeClass);
    renderSessionsList();
  }

  // Populate Recipes List
  function renderRecipesList(filterText = '') {
    const container = document.getElementById('adminRecipesList');
    if (!container) return;
    const c = courseState[activeClass];
    if (!c || !c.recipes) {
      container.innerHTML = '<p style="color:var(--admin-muted);font-size:13px;">No recipes found.</p>';
      return;
    }

    const countSpan = document.getElementById('recipesTotalCount');
    if (countSpan) countSpan.textContent = c.recipes.length;

    const query = filterText.toLowerCase().trim();
    const filtered = c.recipes.filter(r => {
      if (!query) return true;
      return (r.name && r.name.toLowerCase().includes(query)) ||
             (r.category && r.category.toLowerCase().includes(query));
    });

    if (filtered.length === 0) {
      container.innerHTML = '<p style="color:var(--admin-muted);font-size:13px;padding:12px;">No matching recipes found.</p>';
      return;
    }

    container.innerHTML = filtered.map((r, idx) => {
      return `
        <div class="session-item">
          <div>
            <div class="session-title-text">${r.name || 'Untitled Recipe'}</div>
            <div class="session-recipes-count">${r.category || 'General'} · Yield: ${r.yield_ || 'N/A'}</div>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="admin-btn admin-btn-secondary edit-recipe-btn" data-index="${idx}" style="font-size:11px;padding:4px 8px;">Edit</button>
            <button class="admin-btn admin-btn-danger del-recipe-btn" data-index="${idx}" style="font-size:11px;padding:4px 8px;">Delete</button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.del-recipe-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.index, 10);
        if (confirm(`Delete recipe "${filtered[i].name}"?`)) {
          const actualIndex = c.recipes.indexOf(filtered[i]);
          if (actualIndex > -1) {
            c.recipes.splice(actualIndex, 1);
            saveCourseData(activeClass);
            renderRecipesList(filterText);
          }
        }
      });
    });
  }

  // Canvas File Parsers
  async function parseCanvasFile(file) {
    const name = file.name.toLowerCase();

    // 1. Canvas Common Cartridge or Zip (.imscc / .zip)
    if (name.endsWith('.imscc') || name.endsWith('.zip')) {
      return await parseCanvasZip(file);
    }

    // 2. Canvas Calendar iCal (.ics)
    if (name.endsWith('.ics')) {
      const text = await file.text();
      return parseCanvasICS(text, file.name);
    }

    // 3. CSV File
    if (name.endsWith('.csv')) {
      const text = await file.text();
      return parseCanvasCSV(text, file.name);
    }

    // 4. JSON App Backup
    if (name.endsWith('.json')) {
      const text = await file.text();
      return parseCanvasJSON(text, file.name);
    }

    throw new Error('Unsupported file format. Please upload .imscc, .zip, .ics, .csv, or .json.');
  }

  // Parse .imscc / .zip using JSZip
  async function parseCanvasZip(file) {
    if (!window.JSZip) {
      throw new Error('JSZip library not loaded. Please ensure vendor/jszip.min.js is present.');
    }

    const zip = await window.JSZip.loadAsync(file);
    let title = file.name.replace(/\.(imscc|zip)$/i, '');
    let syllabusBody = '';
    let startAt = '';
    let endAt = '';
    let detectedSessions = [];
    let assignmentGroups = [];

    // Check course_settings/course_settings.xml
    const settingsFile = zip.file('course_settings/course_settings.xml');
    if (settingsFile) {
      const xmlStr = await settingsFile.async('string');
      const parser = new DOMParser();
      const xml = parser.parseFromString(xmlStr, 'application/xml');
      const tNode = xml.querySelector('title');
      if (tNode && tNode.textContent) title = tNode.textContent.trim();
      const sylNode = xml.querySelector('syllabus_body');
      if (sylNode && sylNode.textContent) syllabusBody = sylNode.textContent.trim();
      const sNode = xml.querySelector('start_at');
      if (sNode && sNode.textContent) startAt = sNode.textContent.slice(0, 10);
      const eNode = xml.querySelector('conclude_at');
      if (eNode && eNode.textContent) endAt = eNode.textContent.slice(0, 10);
    }

    // Check assignment_groups.xml
    const groupFile = zip.file('course_settings/assignment_groups.xml');
    if (groupFile) {
      const xmlStr = await groupFile.async('string');
      const xml = new DOMParser().parseFromString(xmlStr, 'application/xml');
      xml.querySelectorAll('assignment_group').forEach(ag => {
        const n = ag.querySelector('name');
        const w = ag.querySelector('group_weight');
        if (n && w) {
          assignmentGroups.push([n.textContent.trim(), parseFloat(w.textContent) + '%']);
        }
      });
    }

    // Check assignments
    const assignmentFiles = Object.keys(zip.files).filter(k => k.startsWith('assignments/') && k.endsWith('.xml'));
    for (const af of assignmentFiles) {
      try {
        const xmlStr = await zip.file(af).async('string');
        const xml = new DOMParser().parseFromString(xmlStr, 'application/xml');
        const aTitle = xml.querySelector('title') ? xml.querySelector('title').textContent.trim() : '';
        const aDue = xml.querySelector('due_at') ? xml.querySelector('due_at').textContent.slice(0, 10) : '';
        const aDesc = xml.querySelector('description') ? xml.querySelector('description').textContent.trim() : '';
        if (aTitle) {
          detectedSessions.push({
            date: aDue || startAt || '',
            title: aTitle,
            topic: aDesc.replace(/<[^>]+>/g, ' ').slice(0, 160),
            recipes: []
          });
        }
      } catch (e) {}
    }

    // Check learning modules
    const modulesFile = zip.file('learning_modules.xml');
    let moduleWeeks = 0;
    if (modulesFile) {
      const xmlStr = await modulesFile.async('string');
      const xml = new DOMParser().parseFromString(xmlStr, 'application/xml');
      const mods = xml.querySelectorAll('module');
      moduleWeeks = mods.length;
      mods.forEach((m, mIdx) => {
        const mTitle = m.querySelector('title') ? m.querySelector('title').textContent.trim() : `Week ${mIdx + 1}`;
        m.querySelectorAll('item').forEach(it => {
          const itTitle = it.querySelector('title') ? it.querySelector('title').textContent.trim() : '';
          if (itTitle && !detectedSessions.some(ds => ds.title === itTitle)) {
            detectedSessions.push({
              date: '',
              title: itTitle,
              weekTitle: mTitle,
              recipes: []
            });
          }
        });
      });
    }

    // Sort detected sessions by date
    detectedSessions.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));

    return {
      fileName: file.name,
      courseTitle: title,
      syllabus: syllabusBody,
      start: startAt,
      end: endAt,
      grading: assignmentGroups,
      weeksCount: moduleWeeks || Math.ceil(detectedSessions.length / 4) || 8,
      sessions: detectedSessions,
      assignmentsCount: assignmentFiles.length
    };
  }

  // Parse Canvas Calendar .ics
  function parseCanvasICS(text, fileName) {
    const lines = text.split(/\r?\n/);
    const sessions = [];
    let inEvent = false;
    let cur = {};

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      // Unfold wrapped lines
      while (i + 1 < lines.length && /^[ \t]/.test(lines[i + 1])) {
        line += lines[++i].slice(1);
      }

      if (line.startsWith('BEGIN:VEVENT')) {
        inEvent = true;
        cur = {};
      } else if (line.startsWith('END:VEVENT')) {
        inEvent = false;
        if (cur.title && cur.date) {
          sessions.push(cur);
        }
      } else if (inEvent) {
        if (line.startsWith('SUMMARY:')) {
          cur.title = line.replace('SUMMARY:', '').replace(/\\,/g, ',').trim();
        } else if (line.startsWith('DTSTART')) {
          const val = line.split(':')[1] || '';
          if (val.length >= 8) {
            cur.date = `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}`;
          }
        } else if (line.startsWith('DESCRIPTION:')) {
          const desc = line.replace('DESCRIPTION:', '').replace(/\\n/g, '\n').replace(/\\,/g, ',');
          cur.topic = desc.slice(0, 180);
          cur.recipes = [];
          // Search for recipe names
          const match = desc.match(/(?:recipes?|formulas?|menu|specs?):\s*([^\n\r]+)/i);
          if (match && match[1]) {
            cur.recipes = match[1].split(/[,;]/).map(r => r.trim()).filter(Boolean);
          }
        } else if (line.startsWith('LOCATION:')) {
          cur.room = line.replace('LOCATION:', '').trim();
        }
      }
    }

    sessions.sort((a, b) => a.date.localeCompare(b.date));

    return {
      fileName: fileName,
      courseTitle: 'Canvas Calendar Course',
      sessions: sessions,
      weeksCount: Math.ceil(sessions.length / 4) || 1,
      assignmentsCount: sessions.length
    };
  }

  // Parse CSV
  function parseCanvasCSV(text, fileName) {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) throw new Error('CSV is empty or missing headers');

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const dateIdx = headers.findIndex(h => h.includes('date'));
    const titleIdx = headers.findIndex(h => h.includes('title') || h.includes('assignment') || h.includes('name'));
    const topicIdx = headers.findIndex(h => h.includes('topic') || h.includes('description') || h.includes('notes'));

    const sessions = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
      const d = dateIdx > -1 ? parts[dateIdx] : '';
      const t = titleIdx > -1 ? parts[titleIdx] : parts[0];
      const desc = topicIdx > -1 ? parts[topicIdx] : '';
      if (t) {
        sessions.push({
          date: d,
          title: t,
          topic: desc,
          recipes: []
        });
      }
    }

    return {
      fileName: fileName,
      courseTitle: 'Imported CSV Course',
      sessions: sessions,
      weeksCount: Math.ceil(sessions.length / 4) || 1,
      assignmentsCount: sessions.length
    };
  }

  // Parse JSON Backup
  function parseCanvasJSON(text, fileName) {
    const data = JSON.parse(text);
    return {
      fileName: fileName,
      courseTitle: (data.course && data.course.name) || 'Imported JSON Backup',
      fullData: data,
      sessions: data.sessions || [],
      weeksCount: (data.weeks && data.weeks.length) || 8,
      assignmentsCount: (data.sessions && data.sessions.length) || 0
    };
  }

  // Display Import Preview
  function showImportPreview(parsed) {
    pendingImport = parsed;
    const card = document.getElementById('importPreviewCard');
    if (!card) return;

    card.classList.add('is-visible');
    document.getElementById('importFileName').textContent = `File: ${parsed.fileName} · Detected "${parsed.courseTitle}"`;
    document.getElementById('statSessionsCount').textContent = parsed.sessions.length;
    document.getElementById('statWeeksCount').textContent = parsed.weeksCount;
    document.getElementById('statAssignmentsCount').textContent = parsed.assignmentsCount;

    const tbody = document.getElementById('importPreviewTableBody');
    tbody.innerHTML = parsed.sessions.slice(0, 10).map(s => `
      <tr>
        <td style="color:var(--admin-accent);font-weight:600;">${s.date || '—'}</td>
        <td style="font-weight:500;">${s.title}</td>
        <td style="color:var(--admin-muted);font-size:11px;">${(s.topic || s.weekTitle || '').slice(0, 70)}</td>
      </tr>
    `).join('');

    if (parsed.sessions.length > 10) {
      tbody.innerHTML += `<tr><td colspan="3" style="text-align:center;color:var(--admin-muted);font-size:11px;padding:8px;">+ ${parsed.sessions.length - 10} more sessions detected...</td></tr>`;
    }
  }

  // Apply Imported Data
  function applyImport(mode) {
    if (!pendingImport) return;
    const c = courseState[activeClass];
    if (!c) return;

    if (pendingImport.fullData) {
      // Complete restore
      courseState[activeClass] = pendingImport.fullData;
      saveCourseData(activeClass);
      populateCourseForm();
      renderSessionsList();
      renderRecipesList();
      document.getElementById('importPreviewCard').classList.remove('is-visible');
      showToast(`Restored full backup for ${CLASS_NAMES[activeClass]}`);
      return;
    }

    // Update course metadata if detected
    if (pendingImport.courseTitle && pendingImport.courseTitle !== 'Canvas Calendar Course') {
      if (!c.course) c.course = {};
      c.course.name = pendingImport.courseTitle;
    }
    if (pendingImport.start) c.course.start = pendingImport.start;
    if (pendingImport.end) c.course.end = pendingImport.end;
    if (pendingImport.grading && pendingImport.grading.length > 0) {
      c.course.grading = pendingImport.grading;
    }

    if (mode === 'replace') {
      c.sessions = pendingImport.sessions.map((s, idx) => ({
        n: idx + 1,
        date: s.date || '',
        title: s.title || '',
        topic: s.topic || '',
        recipes: s.recipes || []
      }));
    } else {
      // Merge
      c.sessions = c.sessions || [];
      pendingImport.sessions.forEach(ps => {
        const match = c.sessions.find(s => (s.date && s.date === ps.date) || (s.title && s.title.toLowerCase() === ps.title.toLowerCase()));
        if (match) {
          if (ps.topic) match.topic = ps.topic;
          if (ps.recipes && ps.recipes.length > 0) match.recipes = ps.recipes;
        } else {
          c.sessions.push({
            n: c.sessions.length + 1,
            date: ps.date || '',
            title: ps.title || '',
            topic: ps.topic || '',
            recipes: ps.recipes || []
          });
        }
      });
      c.sessions.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
    }

    saveCourseData(activeClass);
    populateCourseForm();
    renderSessionsList();
    document.getElementById('importPreviewCard').classList.remove('is-visible');
    pendingImport = null;
    showToast(`Successfully imported into ${CLASS_NAMES[activeClass]}!`);
  }

  // Bind Events
  function bindAdminEvents(backdrop) {
    // Close button & backdrop click
    document.getElementById('closeAdminBtn').addEventListener('click', closeAdminModal);
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) closeAdminModal();
    });

    // Course selector pills
    document.getElementById('adminCoursePills').querySelectorAll('.admin-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('adminCoursePills').querySelectorAll('.admin-pill').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        activeClass = btn.dataset.class;
        populateCourseForm();
        renderSessionsList();
        renderRecipesList();
      });
    });

    // Tabs
    backdrop.querySelectorAll('.admin-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        backdrop.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('is-active'));
        backdrop.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('is-active'));
        tab.classList.add('is-active');
        const targetId = 'panel-' + tab.dataset.tab;
        const panel = document.getElementById(targetId);
        if (panel) panel.classList.add('is-active');
      });
    });

    // Save Course Info
    document.getElementById('btnSaveCourseInfo').addEventListener('click', () => {
      const c = courseState[activeClass];
      if (!c) return;
      c.course = c.course || {};
      c.course.instructor = document.getElementById('inpInstructor').value.trim();
      c.course.school = document.getElementById('inpSchool').value.trim();
      c.course.dept = document.getElementById('inpDept').value.trim();
      c.course.name = document.getElementById('inpCourseName').value.trim();
      c.course.short = document.getElementById('inpCourseShort').value.trim();
      c.course.term = document.getElementById('inpTerm').value.trim();
      c.course.room = document.getElementById('inpRoom').value.trim();
      c.course.time = document.getElementById('inpTime').value.trim();
      c.course.start = document.getElementById('inpStartDate').value;
      c.course.end = document.getElementById('inpEndDate').value;
      c.course.textbook = document.getElementById('inpTextbook').value.trim();

      saveCourseData(activeClass);
      populateCourseForm();
    });

    // Canvas Dropzone & File Input
    const dropzone = document.getElementById('canvasDropzone');
    const fileInput = document.getElementById('canvasFileInput');

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', e => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', async e => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelection(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        handleFileSelection(fileInput.files[0]);
      }
    });

    async function handleFileSelection(file) {
      try {
        const parsed = await parseCanvasFile(file);
        showImportPreview(parsed);
      } catch (err) {
        alert('Canvas Import Error: ' + err.message);
      }
    }

    document.getElementById('btnCancelImport').addEventListener('click', () => {
      document.getElementById('importPreviewCard').classList.remove('is-visible');
      pendingImport = null;
    });

    document.getElementById('btnApplyImportMerge').addEventListener('click', () => applyImport('merge'));
    document.getElementById('btnApplyImportReplace').addEventListener('click', () => {
      if (confirm('Are you sure you want to replace all sessions in ' + CLASS_NAMES[activeClass] + ' with this import?')) {
        applyImport('replace');
      }
    });

    // Search sessions
    document.getElementById('searchSessionsInp').addEventListener('input', e => {
      renderSessionsList(e.target.value);
    });

    // Add session
    document.getElementById('btnAddSessionBtn').addEventListener('click', () => editSessionPrompt());

    // Search recipes
    document.getElementById('searchRecipesInp').addEventListener('input', e => {
      renderRecipesList(e.target.value);
    });

    // Download data.js
    document.getElementById('btnDownloadDataJs').addEventListener('click', () => {
      const c = courseState[activeClass];
      const code = `window.DATA=${JSON.stringify(c, null, 2)};\n`;
      downloadTextFile(`${activeClass}-data.js`, code);
    });

    // Download schedule-data.js
    document.getElementById('btnDownloadScheduleJs').addEventListener('click', () => {
      syncScheduleData();
      const s = localStorage.getItem('CULINARY_CUSTOM_SCHEDULE') || '[]';
      const code = `// Master weekly schedule generated for Chef Joseph Jones\nwindow.SCHEDULE_DATA=${JSON.stringify(JSON.parse(s), null, 2)};\n`;
      downloadTextFile('schedule-data.js', code);
    });

    // Full Backup
    document.getElementById('btnExportFullBackup').addEventListener('click', () => {
      const backup = {
        exportedAt: new Date().toISOString(),
        instructor: 'Chef Joseph Jones',
        school: 'Arkansas State University – Newport',
        courses: courseState
      };
      downloadTextFile('asu-culinary-backup.json', JSON.stringify(backup, null, 2));
    });

    // Reset Defaults
    document.getElementById('btnResetToDefaults').addEventListener('click', () => {
      if (confirm(`Reset all custom data for ${CLASS_NAMES[activeClass]} back to original defaults?`)) {
        localStorage.removeItem('CULINARY_CUSTOM_DATA_' + activeClass);
        courseState[activeClass] = loadCourseState(activeClass);
        syncScheduleData();
        if (window.reloadClass) window.reloadClass(activeClass);
        populateCourseForm();
        renderSessionsList();
        renderRecipesList();
        showToast('Restored default settings for ' + CLASS_NAMES[activeClass]);
      }
    });
  }

  function downloadTextFile(filename, text) {
    const blob = new Blob([text], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function openAdminModal() {
    renderAdminModal();
    initAllState();
    populateCourseForm();
    renderSessionsList();
    renderRecipesList();
    const backdrop = document.getElementById('adminModalBackdrop');
    if (backdrop) backdrop.classList.add('is-open');
  }

  function closeAdminModal() {
    const backdrop = document.getElementById('adminModalBackdrop');
    if (backdrop) backdrop.classList.remove('is-open');
  }

  // Expose API globally
  window.openAdminModal = openAdminModal;
  window.closeAdminModal = closeAdminModal;

  // Initialize on DOM load
  document.addEventListener('DOMContentLoaded', () => {
    initAllState();

    // Attach trigger to Admin button if exists
    const btn = document.getElementById('openAdminBtn');
    if (btn) btn.addEventListener('click', openAdminModal);

    // Keyboard shortcut: Shift + A to open Admin
    document.addEventListener('keydown', e => {
      if (e.shiftKey && (e.key === 'A' || e.key === 'a') && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        openAdminModal();
      }
    });
  });

})();
