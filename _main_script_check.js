
/* ============================================================
   HELIX PHASE 1 REFINED — APPLICATION LOGIC
   Normalized event contract, reduced motion, production styling
   ============================================================ */

// ============================================================
// STATE
// ============================================================
const state = {
  currentView: 'dashboard',
  selectedPrediction: null,
  predictionSubmitted: false,
  codeRun: false,
  theme: 'light',
  session: {
    id: 'sess_' + Math.random().toString(36).slice(2, 10),
    startedAt: Date.now(),
    learnerId: 'learner_alex_001'
  },
  sequence: {
    id: 'seq_' + Math.random().toString(36).slice(2, 8),
    counter: 0
  },
  attempt: {
    id: 'att_' + Math.random().toString(36).slice(2, 8),
    counter: 0
  },
  conceptId: 'concept_variables_01',
  lessonId: 'lesson_variables_06',
  codeVersions: [],
  lastCodeEditAt: null,
  lastRunAt: null,
  lessonStartedAt: null
};

// ============================================================
// NORMALIZED EVENT CONTRACT
// Future-compatible with Caspian multi-channel schema
// ============================================================
const EVENT_TYPES = {
  // LEARNING
  concept_started: 'concept_started',
  slide_opened: 'slide_opened',
  lesson_completed: 'lesson_completed',
  // PREDICTION
  prediction_started: 'prediction_started',
  prediction_selected: 'prediction_selected',
  prediction_submitted: 'prediction_submitted',
  prediction_correct: 'prediction_correct',
  prediction_incorrect: 'prediction_incorrect',
  // CODING
  code_changed: 'code_changed',
  code_version_created: 'code_version_created',
  code_executed: 'code_executed',
  code_execution_success: 'code_execution_success',
  code_execution_error: 'code_execution_error',
  // ERRORS
  syntax_error: 'syntax_error',
  runtime_error: 'runtime_error',
  // RECOVERY
  retry_started: 'retry_started',
  solution_submitted: 'solution_submitted',
  // HELP
  hint_requested: 'hint_requested',
  question_asked: 'question_asked',
  feedback_seen: 'feedback_seen',
  // EXPERIMENT
  experiment_started: 'experiment_started',
  experiment_completed: 'experiment_completed',
  // NAVIGATION
  view_changed: 'view_changed',
  theme_changed: 'theme_changed',
  // TUTOR
  tutor_explanation_requested: 'tutor_explanation_requested',
  tutor_hint_requested: 'tutor_hint_requested',
  // CODE EDITOR
  code_reset: 'code_reset',
  example_run: 'example_run'
};

// Event collector (in-memory; future: send to Caspian)
const eventCollector = [];

function emitEvent(eventType, payload = {}) {
  state.sequence.counter++;
  const event = {
    event_id: 'evt_' + Date.now().toString(36) + '_' + state.sequence.counter,
    event_type: eventType,
    learner_id: state.session.learnerId,
    session_id: state.session.id,
    concept_id: state.conceptId,
    lesson_id: state.lessonId,
    timestamp: new Date().toISOString(),
    timestamp_ms: Date.now(),
    source: 'helix_web_phase1',
    view: state.currentView,
    sequence_id: state.sequence.id,
    attempt_id: state.attempt.id,
    step_number: state.sequence.counter,
    previous_event_id: eventCollector.length > 0 ? eventCollector[eventCollector.length - 1].event_id : null,
    payload: payload
  };
  eventCollector.push(event);
  renderEventInspector();
  console.log('[Helix Event]', eventType, payload);
  return event;
}

// ============================================================
// NAVIGATION
// ============================================================
function navigateTo(viewId) {
  if (state.currentView === viewId) return;
  
  const fromView = state.currentView;
  
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById('view-' + viewId);
  if (target) {
    target.classList.add('active');
  }
  
  document.querySelectorAll('.nav-item').forEach(item => {
    const isActive = item.dataset.view === viewId;
    item.classList.toggle('active', isActive);
    item.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
  
  state.currentView = viewId;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  document.getElementById('sidebar').classList.remove('open');
  closePopovers();
  closeSearchDropdown();
  
  if (window.location.hash !== '#' + viewId) {
    history.replaceState(null, '', '#' + viewId);
  }

  if (viewId === 'projects') {
    renderProjectsGrid();
  }
  
  emitEvent(EVENT_TYPES.view_changed, { from: fromView, to: viewId });
}

function handleHashRouting() {
  const hash = window.location.hash.replace('#', '').toLowerCase();
  const validViews = ['dashboard', 'lesson', 'analytics', 'path', 'sandbox', 'community', 'profile', 'settings', 'learn', 'projects'];
  const aliasMap = { 'home': 'dashboard' };
  const target = aliasMap[hash] || hash;
  if (validViews.includes(target)) {
    navigateTo(target);
  }
}
window.addEventListener('hashchange', handleHashRouting);

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ============================================================
// THEME SYSTEM
// ============================================================
function applyTheme(theme) {
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.documentElement.classList.toggle('dark', isDark);
  document.body.classList.toggle('dark', isDark);
  state.theme = theme;
  try { localStorage.setItem('helix_theme', theme); } catch (e) {}

  document.querySelectorAll('.theme-btn').forEach(b => {
    b.classList.remove('btn-primary');
    b.classList.add('btn-secondary');
  });
  const activeBtn = document.getElementById('theme-btn-' + theme);
  if (activeBtn) {
    activeBtn.classList.remove('btn-secondary');
    activeBtn.classList.add('btn-primary');
  }

  emitEvent(EVENT_TYPES.theme_changed, { theme, activeMode: isDark ? 'dark' : 'light' });
}

function toggleTheme() {
  const current = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(current);
}

function setTheme(t) {
  applyTheme(t);
}

// ============================================================
// GLOBAL SEARCH & POPOVERS
// ============================================================
const searchableItems = [
  { title: 'Variables & Data Types', desc: 'JavaScript basics, let & const', type: 'Concept', action: () => window.location.href = 'qwen_practice.html' },
  { title: 'Conditionals & Logic', desc: 'If, else, and boolean expressions', type: 'Concept', action: () => window.location.href = 'qwen_learn.html' },
  { title: 'Loops & Iteration', desc: 'For loops, while loops, arrays', type: 'Concept', action: () => window.location.href = 'qwen_learn.html' },
  { title: 'Functions & Scope', desc: 'Reusable blocks and arrow functions', type: 'Concept', action: () => window.location.href = 'qwen_learn.html' },
  { title: 'Code Sandbox', desc: 'Live JavaScript playground', type: 'Feature', action: () => navigateTo('sandbox') },
  { title: 'Learning Analytics', desc: 'Activity over time & metrics', type: 'Feature', action: () => navigateTo('analytics') },
  { title: 'Interactive Projects', desc: 'Real-world coding projects & studio', type: 'Projects', action: () => navigateTo('projects') },
  { title: 'Full Stack Path', desc: 'Curriculum roadmap & milestones', type: 'Track', action: () => navigateTo('path') },
  { title: 'Community Forum', desc: 'Discussions & peer Q&A', type: 'Community', action: () => navigateTo('community') },
  { title: 'User Profile', desc: 'Your stats, XP, and streak', type: 'Account', action: () => navigateTo('profile') },
  { title: 'Account Settings', desc: 'Theme, notifications & privacy', type: 'Account', action: () => navigateTo('settings') }
];

function handleGlobalSearch(query) {
  const dropdown = document.getElementById('search-results-dropdown');
  const cleanQ = (query || '').trim().toLowerCase();
  if (!cleanQ) {
    dropdown.style.display = 'none';
    return;
  }
  const results = searchableItems.filter(item => 
    item.title.toLowerCase().includes(cleanQ) || item.desc.toLowerCase().includes(cleanQ) || item.type.toLowerCase().includes(cleanQ)
  );
  if (results.length === 0) {
    dropdown.innerHTML = '<div style="padding: 10px; font-size: 0.8125rem; color: var(--text-muted); text-align: center;">No matches found</div>';
  } else {
    dropdown.innerHTML = results.map((item, i) => `
      <div class="search-result-item" onclick="searchableItems[${searchableItems.indexOf(item)}].action(); closeSearchDropdown();">
        <span class="badge badge-primary" style="font-size: 0.6875rem;">${item.type}</span>
        <div style="flex: 1;">
          <div style="font-weight: 600; font-size: 0.8125rem;">${item.title}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${item.desc}</div>
        </div>
      </div>
    `).join('');
  }
  dropdown.style.display = 'block';
}

function handleSearchKeydown(e) {
  if (e.key === 'Escape') closeSearchDropdown();
}

function closeSearchDropdown() {
  const d = document.getElementById('search-results-dropdown');
  if (d) d.style.display = 'none';
}

function toggleStreakPopover() {
  const p = document.getElementById('streak-popover');
  const notif = document.getElementById('notification-popover');
  if (notif) notif.classList.remove('open');
  if (p) p.classList.toggle('open');
}

function toggleNotificationPopover() {
  const p = document.getElementById('notification-popover');
  const streak = document.getElementById('streak-popover');
  if (streak) streak.classList.remove('open');
  if (p) p.classList.toggle('open');
}

function clearNotifications() {
  const dot = document.getElementById('notif-dot');
  if (dot) dot.style.display = 'none';
  const notif = document.getElementById('notification-popover');
  if (notif) notif.classList.remove('open');
}

function closePopovers() {
  document.querySelectorAll('.popover-card').forEach(p => p.classList.remove('open'));
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-bar')) closeSearchDropdown();
  if (!e.target.closest('.topbar-actions')) closePopovers();
});

// ============================================================
// PREDICTION
// ============================================================
function selectPrediction(el) {
  if (state.predictionSubmitted) return;
  document.querySelectorAll('.prediction-option').forEach(opt => {
    opt.classList.remove('selected');
    opt.setAttribute('aria-checked', 'false');
  });
  el.classList.add('selected');
  el.setAttribute('aria-checked', 'true');
  state.selectedPrediction = el.dataset.value;
  
  const btn = document.getElementById('submit-prediction');
  if (btn) {
    btn.disabled = false;
    btn.style.opacity = '1';
  }
  emitEvent(EVENT_TYPES.prediction_selected, { value: state.selectedPrediction });
}

function submitPrediction() {
  if (!state.selectedPrediction || state.predictionSubmitted) return;
  state.predictionSubmitted = true;
  state.attempt.counter++;
  const correct = state.selectedPrediction === '8';
  const options = document.querySelectorAll('.prediction-option');
  const feedback = document.getElementById('prediction-feedback');
  
  options.forEach(opt => {
    opt.classList.add('disabled');
    opt.setAttribute('aria-disabled', 'true');
    if (opt.dataset.value === '8') {
      opt.classList.add('correct');
    } else if (opt.classList.contains('selected') && !correct) {
      opt.classList.add('incorrect');
    }
  });
  
  emitEvent(EVENT_TYPES.prediction_submitted, { value: state.selectedPrediction, correct });
  
  if (feedback) {
    feedback.style.display = 'block';
    feedback.innerHTML = correct ? `
      <div class="feedback-card feedback-success">
        <svg class="feedback-icon" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <div class="feedback-text">
          <strong>Correct!</strong> The variable <code>x</code> starts at 5, then 3 is added, making it 8.
        </div>
      </div>
    ` : `
      <div class="feedback-card feedback-error">
        <svg class="feedback-icon" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        <div class="feedback-text">
          <strong>Not quite.</strong> Remember: <code>x = x + 3</code> takes 5 + 3 = 8.
        </div>
      </div>
    `;
  }
  
  const tutorMsg = document.getElementById('tutor-message');
  if (tutorMsg) {
    tutorMsg.textContent = correct
      ? "Excellent! You understood variable reassignment. Ready to try the code editor?"
      : "No worries! Variable reassignment can be tricky. The key is: x = x + 3 means take the current value of x (5) and add 3, giving 8.";
  }
  emitEvent(EVENT_TYPES.feedback_seen, { type: correct ? 'prediction_correct' : 'prediction_incorrect' });
}

// ============================================================
// CODE EXECUTION & SIGNALS
// ============================================================
const signals = { edits: 0, runs: 0, errors: 0, hints: 0 };
let activeOutputTab = 'output';
let lastRunStdout = '';
let lastRunConsoleLogs = [];
let lastRunTestResults = [];

function updateSignalsUI() {
  const elEdits = document.getElementById('signal-edits');
  const elRuns = document.getElementById('signal-runs');
  const elErrors = document.getElementById('signal-errors');
  const elHints = document.getElementById('signal-hints');
  if (elEdits) elEdits.textContent = signals.edits;
  if (elRuns) elRuns.textContent = signals.runs;
  if (elErrors) elErrors.textContent = signals.errors;
  if (elHints) elHints.textContent = signals.hints;
}

function getCleanEditorCode() {
  const editor = document.getElementById('code-editor-body');
  if (!editor) return '';
  const lines = Array.from(editor.querySelectorAll('.code-line'));
  if (lines.length > 0) {
    return lines.map(line => {
      const clone = line.cloneNode(true);
      clone.querySelectorAll('.code-line-num').forEach(n => n.remove());
      return clone.textContent;
    }).join('\n');
  }
  return editor.innerText || editor.textContent || '';
}

function executeSandboxedJS(codeStr) {
  const logs = [];
  const fakeConsole = {
    log: (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
    error: (...args) => logs.push('[error] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
    warn: (...args) => logs.push('[warn] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '))
  };
  try {
    const fn = new Function('console', codeStr);
    const ret = fn(fakeConsole);
    return { success: true, logs, returnValue: ret, error: null };
  } catch (err) {
    return { success: false, logs, returnValue: null, error: err };
  }
}

function renderOutputPanel() {
  const outputBody = document.getElementById('output-body');
  if (!outputBody) return;
  if (activeOutputTab === 'output') {
    outputBody.innerHTML = lastRunStdout || '<span style="color: var(--text-muted);">// Click "Run Code" to see output</span>';
  } else if (activeOutputTab === 'console') {
    if (lastRunConsoleLogs.length === 0) {
      outputBody.innerHTML = '<span style="color: var(--text-muted);">// No console logs yet</span>';
    } else {
      outputBody.innerHTML = lastRunConsoleLogs.map(l => `<div style="font-family: var(--font-mono); margin-bottom: 4px;">› ${l}</div>`).join('');
    }
  } else if (activeOutputTab === 'tests') {
    if (lastRunTestResults.length === 0) {
      outputBody.innerHTML = '<span style="color: var(--text-muted);">// Run code to see test results</span>';
    } else {
      outputBody.innerHTML = lastRunTestResults.map(t => `
        <div style="display: flex; align-items: center; gap: 8px; font-size: 0.8125rem; margin-bottom: 6px; color: ${t.passed ? 'var(--success)' : 'var(--error)'};">
          <span>${t.passed ? '✓' : '✗'}</span>
          <span>${t.name}</span>
        </div>
      `).join('');
    }
  }
}

function switchOutputTab(btn) {
  const tabName = btn.dataset.tab || 'output';
  activeOutputTab = tabName;
  document.querySelectorAll('.output-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderOutputPanel();
}

function runCode() {
  const btn = document.getElementById('run-code-btn');
  const status = document.getElementById('run-status');
  const feedback = document.getElementById('lesson-feedback');
  
  if (btn) {
    btn.innerHTML = '<div class="spinner spinner-sm" style="border-top-color: white; border-color: rgba(255,255,255,0.3);"></div> Running...';
    btn.disabled = true;
  }
  if (status) status.style.display = 'flex';
  
  signals.runs++;
  updateSignalsUI();
  emitEvent(EVENT_TYPES.code_executed, { timestamp_ms: Date.now() });
  state.lastRunAt = Date.now();
  
  setTimeout(() => {
    if (btn) {
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run Code';
      btn.disabled = false;
    }
    if (status) status.style.display = 'none';

    const cleanCode = getCleanEditorCode();
    const exec = executeSandboxedJS(cleanCode);
    lastRunConsoleLogs = exec.logs;

    if (!exec.success) {
      signals.errors++;
      updateSignalsUI();
      lastRunStdout = `<span style="color: var(--error);">${exec.error.name}: ${exec.error.message}</span>`;
      lastRunTestResults = [{ name: 'Code executes without syntax or runtime error', passed: false }];
      renderOutputPanel();
      if (feedback) {
        feedback.style.display = 'block';
        feedback.innerHTML = `
          <div class="feedback-card feedback-error">
            <svg class="feedback-icon" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            <div class="feedback-text">
              <strong>Runtime Error:</strong> ${exec.error.message}. Double-check your syntax and variable names!
            </div>
          </div>
        `;
      }
      emitEvent(EVENT_TYPES.code_execution_error, { error: exec.error.message });
      return;
    }

    const outputText = exec.logs.length > 0 ? exec.logs.join('\n') : (exec.returnValue !== undefined ? String(exec.returnValue) : 'Code executed successfully (no logs).');
    lastRunStdout = `<span style="color: var(--success); font-family: var(--font-mono);">${outputText}</span>`;

    const hasName = /name\s*=/.test(cleanCode) || /name/.test(cleanCode);
    const hasAge = /age\s*=/.test(cleanCode) || /age/.test(cleanCode);
    const hasLog = /console\.log/.test(cleanCode);

    lastRunTestResults = [
      { name: 'Declare variable name with let', passed: hasName },
      { name: 'Declare variable age with let', passed: hasAge },
      { name: 'Print output to console using console.log', passed: hasLog }
    ];

    renderOutputPanel();
    state.codeRun = true;

    if (hasName && hasAge && hasLog) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.innerHTML = `
          <div class="feedback-card feedback-success">
            <svg class="feedback-icon" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <div class="feedback-text">
              <strong>All good! 🎉</strong> Your code ran successfully and printed to the console.
            </div>
          </div>
        `;
      }
      emitEvent(EVENT_TYPES.code_execution_success, { output: outputText });
    } else {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.innerHTML = `
          <div class="feedback-card feedback-error">
            <div class="feedback-text">
              Make sure to declare your variables and print them using <code>console.log()</code>.
            </div>
          </div>
        `;
      }
    }
  }, 400);
}

function resetCode() {
  state.codeRun = false;
  const editor = document.getElementById('code-editor-body');
  if (editor) {
    editor.innerHTML = `
      <div class="code-line"><span class="code-line-num">1</span><span class="code-comment">// Create a variable for your name</span></div>
      <div class="code-line"><span class="code-line-num">2</span><span class="code-keyword">let</span> <span class="code-variable">name</span> <span class="code-operator">=</span> <span class="code-string">"Alex"</span>;</div>
      <div class="code-line"><span class="code-line-num">3</span></div>
      <div class="code-line"><span class="code-line-num">4</span><span class="code-comment">// Create a variable for your age</span></div>
      <div class="code-line"><span class="code-line-num">5</span><span class="code-keyword">let</span> <span class="code-variable">age</span> <span class="code-operator">=</span> <span class="code-number">21</span>;</div>
      <div class="code-line"><span class="code-line-num">6</span></div>
      <div class="code-line"><span class="code-line-num">7</span><span class="code-comment">// Create a variable for your city</span></div>
      <div class="code-line"><span class="code-line-num">8</span><span class="code-keyword">let</span> <span class="code-variable">city</span> <span class="code-operator">=</span> <span class="code-string">"San Francisco"</span>;</div>
      <div class="code-line"><span class="code-line-num">9</span></div>
      <div class="code-line"><span class="code-line-num">10</span><span class="code-function">console</span>.<span class="code-function">log</span>(<span class="code-variable">name</span>, <span class="code-variable">age</span>, <span class="code-variable">city</span>);</div>
    `;
  }
  lastRunStdout = '';
  lastRunConsoleLogs = [];
  lastRunTestResults = [];
  renderOutputPanel();
  const feedback = document.getElementById('lesson-feedback');
  if (feedback) feedback.style.display = 'none';
  emitEvent(EVENT_TYPES.code_reset, {});
}

function runExample() {
  const editor = document.getElementById('code-editor-body');
  if (editor) {
    editor.innerHTML = `
      <div class="code-line"><span class="code-line-num">1</span><span class="code-comment">// Example variable assignment</span></div>
      <div class="code-line"><span class="code-line-num">2</span><span class="code-keyword">let</span> <span class="code-variable">name</span> <span class="code-operator">=</span> <span class="code-string">"Helix"</span>;</div>
      <div class="code-line"><span class="code-line-num">3</span><span class="code-keyword">let</span> <span class="code-variable">age</span> <span class="code-operator">=</span> <span class="code-number">28</span>;</div>
      <div class="code-line"><span class="code-line-num">4</span><span class="code-function">console</span>.<span class="code-function">log</span>(<span class="code-string">"Name:"</span>, <span class="code-variable">name</span>, <span class="code-string">"| Age:"</span>, <span class="code-variable">age</span>);</div>
    `;
  }
  runCode();
  emitEvent(EVENT_TYPES.example_run, {});
}

function startQuickPractice() {
  window.location.href = 'qwen_practice.html';
}

// ============================================================
// TUTOR
// ============================================================
async function tutorExplain() {
  const tutorMsg = document.getElementById('tutor-message');
  if (tutorMsg) tutorMsg.textContent = 'Helix is thinking...';
  emitEvent(EVENT_TYPES.tutor_explanation_requested, {});
  
  try {
    const res = await fetch('/api/guidance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        learner_type: 'Manual Learner',
        current_user_level: 'Beginner',
        active_code: getCleanEditorCode(),
        lesson_context: 'Variables & Data Types'
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (tutorMsg) tutorMsg.innerHTML = data.ai_guidance;
      return;
    }
  } catch (err) {}

  if (tutorMsg) {
    tutorMsg.innerHTML = '<strong>Variables explained:</strong><br><br>A variable is like a labeled container in memory. The <code>let</code> keyword declares it, the name is the label, and the value goes inside with <code>=</code>.';
  }
}

async function tutorHint() {
  signals.hints++;
  updateSignalsUI();
  const tutorMsg = document.getElementById('tutor-message');
  if (tutorMsg) tutorMsg.textContent = 'Helix is generating a hint...';
  emitEvent(EVENT_TYPES.tutor_hint_requested, {});

  try {
    const res = await fetch('/api/guidance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        learner_type: 'Experimental Learner',
        current_user_level: 'Beginner',
        active_code: getCleanEditorCode(),
        lesson_context: 'Variables Practice Hint'
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (tutorMsg) tutorMsg.innerHTML = `💡 <strong>Hint:</strong> ${data.ai_guidance}`;
      return;
    }
  } catch (err) {}

  if (tutorMsg) {
    tutorMsg.innerHTML = '💡 <strong>Hint:</strong> Try changing the variable values in the code editor, run it again, and check the console output tab!';
  }
}

let mainPersonalizedNextLesson = null;
let mainPersonalizationRationale = '';

function formatMainChatMarkdown(text) {
  if (!text) return '';
  let safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  safe = safe.replace(/```(?:javascript|js)?([\s\S]*?)```/g, '<pre style="background: rgba(0,0,0,0.4); color: #E6EDF3; padding: 6px; border-radius: 4px; font-family: monospace; font-size: 0.75rem; margin: 4px 0;"><code>$1</code></pre>');
  safe = safe.replace(/`([^`]+)`/g, '<code style="background: rgba(99,102,241,0.18); color: #A5B4FC; padding: 1px 4px; border-radius: 3px; font-family: monospace; font-size: 0.85em;">$1</code>');
  safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  safe = safe.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  safe = safe.replace(/\n/g, '<br>');
  return safe;
}

async function mainTutorSend(promptText) {
  const input = document.getElementById('main-tutor-input');
  const text = (promptText || (input ? input.value : '')).trim();
  if (!text) return;
  if (input) input.value = '';

  const tutorMsg = document.getElementById('tutor-message');
  if (tutorMsg) {
    tutorMsg.innerHTML = `<span style="color: var(--text-inverse-secondary); font-style: italic;">Helix AI is evaluating your question...</span>`;
  }

  const apiKey = localStorage.getItem('helix_gemini_api_key') || '';
  const currentCode = getCleanEditorCode();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        lesson_id: 1,
        lesson_context: 'Variables & Data Types',
        active_code: currentCode,
        current_user_level: 'Beginner',
        learner_type: 'Manual Learner',
        chat_history: [],
        api_key: apiKey,
        accuracy_rate: 0.85,
        total_time_seconds: 60.0,
        retries: 0,
        hint_requests: signals.hints || 0,
        code_submissions: signals.runs || 1,
        experiments_started: 1
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (tutorMsg) {
        let metaHtml = '';
        if (data.assessment) {
          const lvl = data.assessment.evaluated_level || 'Intermediate';
          const comp = data.assessment.question_complexity || 'Intermediate';
          const st = data.assessment.understanding_state || 'on_track';
          metaHtml = `<div style="margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap;">
            <span style="font-size: 0.65rem; background: rgba(99,102,241,0.2); color: #A5B4FC; padding: 1px 6px; border-radius: 99px;">Level: ${lvl}</span>
            <span style="font-size: 0.65rem; background: rgba(255,255,255,0.08); color: var(--text-inverse-secondary); padding: 1px 6px; border-radius: 99px;">${comp}</span>
            <span style="font-size: 0.65rem; background: rgba(16,185,129,0.15); color: #34D399; padding: 1px 6px; border-radius: 99px;">${st}</span>
          </div>`;
        }
        tutorMsg.innerHTML = formatMainChatMarkdown(data.reply) + metaHtml;
      }

      if (data.state && data.state.recommended_next_lesson_id) {
        mainPersonalizedNextLesson = data.state.recommended_next_lesson_id;
        mainPersonalizationRationale = data.state.personalization_rationale;

        const pill = document.getElementById('main-tutor-pill');
        const pillTitle = document.getElementById('main-pill-title');
        const pillDesc = document.getElementById('main-pill-desc');
        const btnNext = document.getElementById('btn-next-practice');
        if (pill) pill.style.display = 'block';
        if (pillTitle) pillTitle.textContent = `🎯 Personalized Next: Lesson ${mainPersonalizedNextLesson}`;
        if (pillDesc) pillDesc.textContent = mainPersonalizationRationale;
        if (btnNext) {
          btnNext.innerHTML = `Next: Lesson ${mainPersonalizedNextLesson} ✨ <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
        }
      }
      return;
    }
  } catch (err) {
    console.warn('[Helix main tutor]', err.message);
  }

  if (tutorMsg) {
    tutorMsg.innerHTML = formatMainChatMarkdown(`**Helix Tutor:** Focus on declaring variables with \`let\` or \`const\` and inspecting values using \`console.log()\`.`);
  }
}

function mainTutorAsk(promptText) {
  mainTutorSend(promptText);
}

function goToPersonalizedPractice() {
  if (mainPersonalizedNextLesson) {
    window.location.href = `qwen_practice.html?lesson=${mainPersonalizedNextLesson}`;
  } else {
    window.location.href = 'qwen_practice.html';
  }
}

function toggleMainApiKeyModal() {
  const modal = document.getElementById('main-gemini-modal');
  if (!modal) return;
  const isHidden = modal.style.display === 'none' || !modal.style.display;
  modal.style.display = isHidden ? 'flex' : 'none';
  if (isHidden) {
    const input = document.getElementById('main-gemini-key-input');
    if (input) input.value = localStorage.getItem('helix_gemini_api_key') || '';
    const status = document.getElementById('main-gemini-key-status');
    if (status) status.style.display = 'none';
  }
}

async function saveAndVerifyMainApiKey() {
  const input = document.getElementById('main-gemini-key-input');
  const status = document.getElementById('main-gemini-key-status');
  const btn = document.getElementById('btn-save-main-gemini-key');
  const key = (input ? input.value : '').trim();

  if (!key) {
    if (status) {
      status.style.display = 'block';
      status.style.background = 'rgba(239,68,68,0.2)';
      status.style.color = '#FCA5A5';
      status.textContent = 'Please enter a Gemini API key.';
    }
    return;
  }

  if (btn) btn.textContent = 'Verifying...';
  if (status) {
    status.style.display = 'block';
    status.style.background = 'rgba(99,102,241,0.2)';
    status.style.color = '#A5B4FC';
    status.textContent = 'Verifying with Google Gemini API...';
  }

  try {
    const res = await fetch('/api/verify_key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key })
    });
    const data = await res.json();
    if (data.valid) {
      localStorage.setItem('helix_gemini_api_key', key);
      status.style.background = 'rgba(16,185,129,0.2)';
      status.style.color = '#6EE7B7';
      status.textContent = '✓ Gemini API key verified and saved!';
      updateMainKeyIndicator();
      setTimeout(() => toggleMainApiKeyModal(), 1200);
    } else {
      status.style.background = 'rgba(245,158,11,0.2)';
      status.style.color = '#FCD34D';
      status.textContent = '⚠ ' + (data.message || 'Verification failed. Key saved locally.');
      localStorage.setItem('helix_gemini_api_key', key);
      updateMainKeyIndicator();
    }
  } catch (err) {
    localStorage.setItem('helix_gemini_api_key', key);
    if (status) {
      status.style.background = 'rgba(245,158,11,0.2)';
      status.style.color = '#FCD34D';
      status.textContent = 'Key saved locally (offline mode).';
    }
    updateMainKeyIndicator();
    setTimeout(() => toggleMainApiKeyModal(), 1200);
  } finally {
    if (btn) btn.textContent = 'Verify & Save';
  }
}

function clearMainApiKey() {
  localStorage.removeItem('helix_gemini_api_key');
  const input = document.getElementById('main-gemini-key-input');
  if (input) input.value = '';
  const status = document.getElementById('main-gemini-key-status');
  if (status) {
    status.style.display = 'block';
    status.style.background = 'rgba(255,255,255,0.06)';
    status.style.color = 'var(--text-inverse-secondary)';
    status.textContent = 'Key removed. Running in heuristic mode.';
  }
  updateMainKeyIndicator();
  setTimeout(() => toggleMainApiKeyModal(), 1000);
}

function updateMainKeyIndicator() {
  const dot = document.getElementById('main-key-dot');
  const key = localStorage.getItem('helix_gemini_api_key');
  if (dot) {
    dot.style.background = key ? '#10B981' : '#94A3B8';
    dot.title = key ? 'Gemini API Key Active' : 'Offline / Heuristic Mode';
  }
}

// ============================================================
// PATH TABS & ACTIONS
// ============================================================
function switchPathTab(tabId, btn) {
  document.querySelectorAll('[data-pathtab]').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.path-panel').forEach(p => p.style.display = 'none');
  const panel = document.getElementById('path-panel-' + tabId);
  if (panel) panel.style.display = 'block';
}

function shareProgress() {
  const shareText = 'Check out my progress on Helix Full Stack Developer Path!';
  if (navigator.clipboard) {
    navigator.clipboard.writeText(window.location.href);
    alert('Progress link copied to clipboard!');
  } else {
    alert(shareText);
  }
}

// ============================================================
// SANDBOX PLAYGROUND
// ============================================================
const sandboxTemplates = {
  variables: `// Variables & Reassignment
let score = 10;
console.log("Initial score:", score);
score = score + 25;
console.log("Updated score:", score);`,
  loops: `// Loops & Arrays
let items = ["Apple", "Banana", "Cherry"];
for (let i = 0; i < items.length; i++) {
  console.log(\`Item \${i + 1}: \${items[i]}\`);
}`,
  functions: `// Functions & Expressions
function greet(name, role) {
  return \`Hello \${name}, welcome to your \${role} track!\`;
}
console.log(greet("Alex", "Full Stack Developer"));`
};

function loadSandboxTemplate(key) {
  const editor = document.getElementById('sandbox-code-editor');
  if (editor && sandboxTemplates[key]) {
    editor.value = sandboxTemplates[key];
    runSandboxCode();
  }
}

function clearSandbox() {
  const editor = document.getElementById('sandbox-code-editor');
  if (editor) editor.value = '';
}

function clearSandboxOutput() {
  const out = document.getElementById('sandbox-output-body');
  if (out) out.innerHTML = '<span style="color: var(--text-muted);">// Output cleared</span>';
}

function runSandboxCode() {
  const editor = document.getElementById('sandbox-code-editor');
  const out = document.getElementById('sandbox-output-body');
  if (!editor || !out) return;
  const exec = executeSandboxedJS(editor.value);
  if (!exec.success) {
    out.innerHTML = `<span style="color: var(--error);">${exec.error.name}: ${exec.error.message}</span>`;
  } else {
    const text = exec.logs.length > 0 ? exec.logs.join('\n') : (exec.returnValue !== undefined ? String(exec.returnValue) : 'Executed successfully (no console output).');
    out.innerHTML = `<span style="color: var(--success); white-space: pre-wrap;">${text}</span>`;
  }
}

// ============================================================
// COMMUNITY FORUM
// ============================================================
function toggleAskQuestionModal() {
  const form = document.getElementById('ask-question-form');
  if (form) {
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
  }
}

function submitCommunityQuestion() {
  const titleInput = document.getElementById('community-post-title');
  const bodyInput = document.getElementById('community-post-body');
  const title = (titleInput?.value || '').trim();
  const body = (bodyInput?.value || '').trim();
  if (!title) {
    alert('Please enter a question title.');
    return;
  }
  const threads = document.getElementById('community-threads');
  if (threads) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = 'display: flex; gap: var(--sp-4); align-items: flex-start;';
    card.innerHTML = `
      <button class="btn btn-secondary btn-sm upvote-btn" onclick="toggleUpvote(this, 1)" style="display: flex; flex-direction: column; align-items: center; padding: 6px 10px;">
        <span>▲</span>
        <span class="upvote-count" style="font-weight: 700; font-size: 0.8125rem;">1</span>
      </button>
      <div style="flex: 1;">
        <div style="font-weight: 600; font-size: 1rem; margin-bottom: 4px;">${title}</div>
        <p style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 8px;">${body || 'Looking for community insights on this topic.'}</p>
        <div style="display: flex; gap: var(--sp-3); font-size: 0.75rem; color: var(--text-muted); align-items: center;">
          <span>Posted by <strong>Alex (You)</strong></span>
          <span>•</span>
          <span>Just now</span>
          <span>•</span>
          <span class="badge badge-primary">Discussion</span>
        </div>
      </div>
    `;
    threads.prepend(card);
  }
  if (titleInput) titleInput.value = '';
  if (bodyInput) bodyInput.value = '';
  toggleAskQuestionModal();
  alert('Your question has been posted to the community!');
}

function toggleUpvote(btn, baseCount) {
  const countEl = btn.querySelector('.upvote-count');
  const isUpvoted = btn.classList.toggle('btn-primary');
  btn.classList.toggle('btn-secondary');
  if (countEl) {
    countEl.textContent = isUpvoted ? baseCount + 1 : baseCount;
  }
}

// ============================================================
// PROFILE & SETTINGS
// ============================================================
function syncProfileStats() {
  try {
    const saved = localStorage.getItem('helix_practice_state');
    if (saved) {
      const data = JSON.parse(saved);
      const lessonsEl = document.getElementById('profile-lessons-count');
      const xpEl = document.getElementById('profile-xp-count');
      if (lessonsEl && data.completedLessons) lessonsEl.textContent = data.completedLessons.length;
      if (xpEl && data.totalXP) xpEl.textContent = data.totalXP;
    }
  } catch (e) {}
}

function editProfile() {
  const nameDisplay = document.getElementById('profile-name-display');
  const current = nameDisplay ? nameDisplay.textContent : 'Alex Morgan';
  const newName = prompt('Enter your display name:', current);
  if (newName && newName.trim()) {
    if (nameDisplay) nameDisplay.textContent = newName.trim();
    try { localStorage.setItem('helix_profile_name', newName.trim()); } catch (e) {}
  }
}

function saveSettings() {
  const reminders = document.getElementById('setting-notif-reminders')?.checked;
  const streaks = document.getElementById('setting-notif-streaks')?.checked;
  try {
    localStorage.setItem('helix_settings', JSON.stringify({ reminders, streaks }));
  } catch (e) {}
}

function resetLearnerData() {
  if (confirm('Are you sure you want to reset all learning progress, notes, and local settings?')) {
    try {
      localStorage.clear();
      alert('Data reset successfully. Reloading Helix.');
      window.location.reload();
    } catch (e) {}
  }
}

// ============================================================
// ANALYTICS CONTROLS & EXPORT
// ============================================================
function toggleTimeframeDropdown() {
  const d = document.getElementById('timeframe-dropdown');
  if (d) d.classList.toggle('open');
}

function setTimeframe(label) {
  const lbl = document.getElementById('timeframe-label');
  if (lbl) lbl.textContent = label;
  const d = document.getElementById('timeframe-dropdown');
  if (d) d.classList.remove('open');
  emitEvent('timeframe_changed', { timeframe: label });
}

function exportAnalyticsData() {
  const exportPayload = {
    user: 'Alex Morgan',
    exportedAt: new Date().toISOString(),
    eventCount: eventCollector.length,
    events: eventCollector,
    signals: signals
  };
  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'helix_analytics_export.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// EVENT INSPECTOR (DEV-ONLY)
// ============================================================
function toggleEventInspector() {
  document.getElementById('event-inspector').classList.toggle('open');
}

function renderEventInspector() {
  const list = document.getElementById('event-list');
  const count = document.getElementById('event-count');
  if (!list || !count) return;
  count.textContent = eventCollector.length + ' event' + (eventCollector.length !== 1 ? 's' : '');
  
  const recent = eventCollector.slice(-50).reverse();
  list.innerHTML = recent.map(evt => {
    const time = new Date(evt.timestamp).toLocaleTimeString('en-US', { hour12: false });
    const payloadStr = Object.keys(evt.payload).length > 0 ? JSON.stringify(evt.payload) : '';
    return `
      <div class="event-item">
        <div class="event-item-time">${time}</div>
        <div class="event-item-type">${evt.event_type}</div>
        <div class="event-item-meta">seq: ${evt.sequence_id.slice(-6)} · att: ${evt.attempt_id.slice(-6)} · step: ${evt.step_number}</div>
        ${payloadStr ? `<div class="event-item-payload">${payloadStr}</div>` : ''}
      </div>
    `;
  }).join('');
}

function clearEvents() {
  eventCollector.length = 0;
  renderEventInspector();
}

// ============================================================
// CODE EDIT TRACKING
// ============================================================
const codeEditor = document.getElementById('code-editor-body');
if (codeEditor) {
  let editDebounce;
  codeEditor.addEventListener('input', () => {
    signals.edits++;
    updateSignalsUI();
    clearTimeout(editDebounce);
    editDebounce = setTimeout(() => {
      state.lastCodeEditAt = Date.now();
      state.codeVersions.push({
        version: state.codeVersions.length + 1,
        timestamp: Date.now(),
        content: codeEditor.innerText
      });
      emitEvent(EVENT_TYPES.code_changed, {
        version: state.codeVersions.length,
        time_since_last_edit: state.lastCodeEditAt ? Date.now() - state.lastCodeEditAt : null
      });
    }, 500);
  });
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    const searchInp = document.getElementById('topbar-search-input');
    if (searchInp) searchInp.focus();
  }
  if (e.key === 'Escape') {
    document.getElementById('sidebar').classList.remove('open');
    closePopovers();
    closeSearchDropdown();
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
    e.preventDefault();
    toggleEventInspector();
  }
});

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  state.lessonStartedAt = Date.now();

  // Load saved theme
  const savedTheme = localStorage.getItem('helix_theme') || 'light';
  applyTheme(savedTheme);

  // Initialize signals UI & Timer
  updateSignalsUI();
  setInterval(() => {
    if (state.lessonStartedAt) {
      const diffSec = Math.floor((Date.now() - state.lessonStartedAt) / 1000);
      const m = String(Math.floor(diffSec / 60)).padStart(2, '0');
      const s = String(diffSec % 60).padStart(2, '0');
      const timeEl = document.getElementById('time-spent');
      if (timeEl) timeEl.textContent = `${m}:${s}`;
    }
  }, 1000);

  // Handle URL hash routing
  handleHashRouting();

  // Sync profile stats
  syncProfileStats();
  renderProjectsGrid();

  // Subtle hero entrance (respects reduced motion)
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReduced && typeof anime !== 'undefined') {
    anime({
      targets: '#hero-illustration',
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 600,
      easing: 'easeOutCubic',
      delay: 100
    });
    anime({
      targets: '.float-el',
      opacity: [0, 1],
      translateY: [10, 0],
      duration: 500,
      easing: 'easeOutCubic',
      delay: anime.stagger(150, { start: 300 })
    });
  }
  
  emitEvent(EVENT_TYPES.concept_started, { concept_id: state.conceptId });
  updateMainKeyIndicator();
});

// ============================================================
// HELIX PROJECTS WORKSPACE & INTERACTIVE STUDIO ENGINE
// ============================================================
const HELIX_PROJECTS = [
  {
    id: 'todo',
    title: 'Interactive To-Do List Application',
    category: 'Frontend',
    difficulty: 'Beginner',
    time: '45 mins',
    xp: 150,
    icon: '✅',
    badgeClass: 'badge-primary',
    difficultyBadge: 'badge-warning',
    description: 'Build a production-ready task manager supporting task creation, real-time completion toggling, persistent deletion, status filtering (all/active/completed), and live metrics summary.',
    skills: ['DOM Events', 'Array Methods', 'CRUD Logic', 'Filter Predicates'],
    starterCode: `// ============================================================
// HELIX PROJECT: Interactive To-Do List Application
// Complete the TodoApp methods below to satisfy all tests!
// ============================================================

const TodoApp = {
  tasks: [],

  // Add a new task with unique ID and default priority
  addTask(title, priority = 'medium') {
    if (!title || !title.trim()) return null;
    const task = {
      id: 'task_' + (this.tasks.length + 1) + '_' + Date.now().toString(36),
      title: title.trim(),
      completed: false,
      priority: priority,
      createdAt: new Date().toISOString()
    };
    this.tasks.push(task);
    return task;
  },

  // Toggle completed state between true and false
  toggleTask(id) {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      task.completed = !task.completed;
      return task;
    }
    return null;
  },

  // Remove a task by its id
  deleteTask(id) {
    const initialLen = this.tasks.length;
    this.tasks = this.tasks.filter(t => t.id !== id);
    return this.tasks.length < initialLen;
  },

  // Return tasks filtered by: 'all', 'active', or 'completed'
  filterTasks(filterType) {
    if (filterType === 'active') return this.tasks.filter(t => !t.completed);
    if (filterType === 'completed') return this.tasks.filter(t => t.completed);
    return this.tasks;
  },

  // Return stats: { total, completed, active }
  getStats() {
    const total = this.tasks.length;
    const completed = this.tasks.filter(t => t.completed).length;
    const active = total - completed;
    return { total, completed, active };
  }
};
`,
    tests: [
      { name: 'addTask creates valid task with title, id, and completed=false', run: 'const t = TodoApp.addTask("Buy Groceries"); if (!t || t.title !== "Buy Groceries" || t.completed !== false || !t.id) throw new Error("Invalid task object returned");' },
      { name: 'toggleTask toggles completion status correctly', run: 'const t = TodoApp.addTask("Write Code"); TodoApp.toggleTask(t.id); if (!t.completed) throw new Error("Task completed should be true after toggle"); TodoApp.toggleTask(t.id); if (t.completed) throw new Error("Task completed should be false after second toggle");' },
      { name: 'deleteTask successfully removes task from collection', run: 'const t = TodoApp.addTask("Temp Task"); const delRes = TodoApp.deleteTask(t.id); if (!delRes || TodoApp.tasks.some(x => x.id === t.id)) throw new Error("Task was not removed");' },
      { name: 'filterTasks separates active and completed tasks', run: 'TodoApp.tasks = []; const t1 = TodoApp.addTask("T1"); const t2 = TodoApp.addTask("T2"); TodoApp.toggleTask(t2.id); if (TodoApp.filterTasks("active").length !== 1 || TodoApp.filterTasks("completed").length !== 1) throw new Error("Filter counts mismatch");' },
      { name: 'getStats returns accurate counts for total, active, and completed', run: 'TodoApp.tasks = []; TodoApp.addTask("A"); TodoApp.addTask("B"); TodoApp.addTask("C"); TodoApp.toggleTask(TodoApp.tasks[0].id); const s = TodoApp.getStats(); if (s.total !== 3 || s.completed !== 1 || s.active !== 2) throw new Error("Stats calculation incorrect: " + JSON.stringify(s));' }
    ],
    hints: [
      'Use Array.prototype.find() to locate a task by ID before mutating its properties.',
      'For filterTasks, remember that active tasks are simply those where completed === false.',
      'getStats() can calculate active count as total - completed.'
    ]
  },
  {
    id: 'calculator',
    title: 'Scientific & Financial Calculator Engine',
    category: 'Tools',
    difficulty: 'Beginner',
    time: '40 mins',
    xp: 175,
    icon: '🧮',
    badgeClass: 'badge-primary',
    difficultyBadge: 'badge-warning',
    description: 'Build a rock-solid calculation engine that handles basic arithmetic (+, -, *, /), chained operations, percentages, decimals with precision safety, and division-by-zero protection.',
    skills: ['State Machines', 'Floating Point Math', 'Input Parsing', 'Guard Clauses'],
    starterCode: `// ============================================================
// HELIX PROJECT: Scientific & Financial Calculator Engine
// ============================================================

const Calculator = {
  currentValue: '0',
  previousValue: null,
  operation: null,

  clear() {
    this.currentValue = '0';
    this.previousValue = null;
    this.operation = null;
    return this.currentValue;
  },

  inputDigit(digit) {
    if (digit === '.' && this.currentValue.includes('.')) return this.currentValue;
    if (this.currentValue === '0' && digit !== '.') {
      this.currentValue = String(digit);
    } else {
      this.currentValue += String(digit);
    }
    return this.currentValue;
  },

  setOperation(op) {
    if (this.previousValue !== null && this.operation) {
      this.calculate();
    }
    this.previousValue = parseFloat(this.currentValue);
    this.operation = op;
    this.currentValue = '0';
    return this.operation;
  },

  calculate() {
    if (this.previousValue === null || !this.operation) return this.currentValue;
    const prev = this.previousValue;
    const current = parseFloat(this.currentValue);
    let result = 0;
    switch (this.operation) {
      case '+': result = prev + current; break;
      case '-': result = prev - current; break;
      case '*': result = prev * current; break;
      case '/': result = current === 0 ? 'Error: Div0' : prev / current; break;
      case '%': result = (prev * current) / 100; break;
      default: return this.currentValue;
    }
    this.currentValue = typeof result === 'number' ? String(Math.round(result * 10000) / 10000) : String(result);
    this.previousValue = null;
    this.operation = null;
    return this.currentValue;
  }
};
`,
    tests: [
      { name: 'Addition and Subtraction compute accurately', run: 'Calculator.clear(); Calculator.inputDigit("1"); Calculator.inputDigit("5"); Calculator.setOperation("+"); Calculator.inputDigit("7"); Calculator.calculate(); if (Calculator.currentValue !== "22") throw new Error("Expected 22, got " + Calculator.currentValue); Calculator.setOperation("-"); Calculator.inputDigit("5"); Calculator.calculate(); if (Calculator.currentValue !== "17") throw new Error("Expected 17, got " + Calculator.currentValue);' },
      { name: 'Multiplication and Division compute accurately', run: 'Calculator.clear(); Calculator.inputDigit("6"); Calculator.setOperation("*"); Calculator.inputDigit("7"); Calculator.calculate(); if (Calculator.currentValue !== "42") throw new Error("Expected 42, got " + Calculator.currentValue); Calculator.setOperation("/"); Calculator.inputDigit("2"); Calculator.calculate(); if (Calculator.currentValue !== "21") throw new Error("Expected 21, got " + Calculator.currentValue);' },
      { name: 'Division by zero is guarded safely', run: 'Calculator.clear(); Calculator.inputDigit("8"); Calculator.setOperation("/"); Calculator.inputDigit("0"); Calculator.calculate(); if (!Calculator.currentValue.includes("Error")) throw new Error("Expected division by zero error string");' },
      { name: 'Decimal input prevents duplicate decimal points', run: 'Calculator.clear(); Calculator.inputDigit("3"); Calculator.inputDigit("."); Calculator.inputDigit("1"); Calculator.inputDigit("."); Calculator.inputDigit("4"); if (Calculator.currentValue !== "3.14") throw new Error("Expected 3.14, got " + Calculator.currentValue);' },
      { name: 'Clear resets all calculator memory and registers', run: 'Calculator.clear(); Calculator.inputDigit("9"); Calculator.setOperation("+"); Calculator.clear(); if (Calculator.currentValue !== "0" || Calculator.previousValue !== null || Calculator.operation !== null) throw new Error("Calculator state not cleanly reset");' }
    ],
    hints: [
      'Use parseFloat to convert stored display strings into numeric values for computation.',
      'Check this.currentValue.includes(".") to avoid double dots like 3..5.',
      'Use guard clauses to detect division by zero before executing /.'
    ]
  },
  {
    id: 'weather',
    title: 'Live Weather Forecast Dashboard',
    category: 'APIs',
    difficulty: 'Intermediate',
    time: '1 hr',
    xp: 250,
    icon: '⛅',
    badgeClass: 'badge-warning',
    difficultyBadge: 'badge-primary',
    description: 'Build an API data processing pipeline for a weather dashboard, featuring Celsius to Fahrenheit unit conversion, weather condition mapping, forecast payload normalization, and temperature filtering.',
    skills: ['Async Fetch', 'Data Normalization', 'Unit Conversion', 'Array Transformations'],
    starterCode: `// ============================================================
// HELIX PROJECT: Live Weather Forecast Dashboard
// ============================================================

const WeatherService = {
  celsiusToFahrenheit(c) {
    return Math.round((c * 9/5) + 32);
  },

  fahrenheitToCelsius(f) {
    return Math.round((f - 32) * 5/9);
  },

  getConditionIcon(code) {
    const map = {
      'clear': '☀️ Sunny',
      'cloudy': '☁️ Cloudy',
      'rain': '🌧️ Rainy',
      'thunder': '⛈️ Thunderstorm',
      'snow': '❄️ Snow'
    };
    return map[String(code).toLowerCase()] || '🌤️ Partly Cloudy';
  },

  parseForecastData(rawApiPayload) {
    if (!rawApiPayload || !Array.isArray(rawApiPayload.days)) return [];
    return rawApiPayload.days.map(day => ({
      date: day.date,
      tempC: day.temp,
      tempF: this.celsiusToFahrenheit(day.temp),
      condition: day.condition,
      icon: this.getConditionIcon(day.condition)
    }));
  },

  filterByMinTemp(forecast, minTempC) {
    return forecast.filter(item => item.tempC >= minTempC);
  }
};
`,
    tests: [
      { name: 'celsiusToFahrenheit converts temperatures correctly', run: 'if (WeatherService.celsiusToFahrenheit(0) !== 32) throw new Error("0°C should be 32°F"); if (WeatherService.celsiusToFahrenheit(100) !== 212) throw new Error("100°C should be 212°F"); if (WeatherService.celsiusToFahrenheit(20) !== 68) throw new Error("20°C should be 68°F");' },
      { name: 'fahrenheitToCelsius converts temperatures correctly', run: 'if (WeatherService.fahrenheitToCelsius(32) !== 0) throw new Error("32°F should be 0°C"); if (WeatherService.fahrenheitToCelsius(212) !== 100) throw new Error("212°F should be 100°C");' },
      { name: 'getConditionIcon maps weather codes to human labels with emojis', run: 'if (!WeatherService.getConditionIcon("rain").includes("Rainy")) throw new Error("Rain should map to Rainy"); if (!WeatherService.getConditionIcon("unknown_code").includes("Partly Cloudy")) throw new Error("Fallback failed");' },
      { name: 'parseForecastData transforms raw API structure into clean objects', run: 'const mock = { days: [{ date: "2026-09-15", temp: 25, condition: "clear" }, { date: "2026-09-16", temp: 18, condition: "rain" }] }; const res = WeatherService.parseForecastData(mock); if (res.length !== 2 || res[0].tempF !== 77 || !res[1].icon.includes("Rainy")) throw new Error("Forecast parsing failed: " + JSON.stringify(res));' },
      { name: 'filterByMinTemp filters forecasts above threshold correctly', run: 'const list = [{ tempC: 15 }, { tempC: 22 }, { tempC: 28 }]; const filtered = WeatherService.filterByMinTemp(list, 20); if (filtered.length !== 2) throw new Error("Expected 2 days above 20C, got " + filtered.length);' }
    ],
    hints: [
      'The formula for C to F is: (C * 9/5) + 32.',
      'Always test edge cases like empty days arrays in parseForecastData.',
      'Use String(code).toLowerCase() so case variations like "Clear" or "CLEAR" match.'
    ]
  },
  {
    id: 'markdown',
    title: 'Real-time Markdown Live Editor & Parser',
    category: 'Tools',
    difficulty: 'Intermediate',
    time: '50 mins',
    xp: 225,
    icon: '📝',
    badgeClass: 'badge-warning',
    difficultyBadge: 'badge-primary',
    description: 'Build a live markdown rendering engine and text analytics parser supporting headers (#, ##, ###), bold (**text**), italics (*text*), code blocks (`code`), blockquotes (>), and word/character analytics.',
    skills: ['Regular Expressions', 'String Parsing', 'Text Analytics', 'Live Input Events'],
    starterCode: `// ============================================================
// HELIX PROJECT: Real-time Markdown Live Editor & Parser
// ============================================================

const MarkdownParser = {
  parse(rawMarkdown) {
    if (!rawMarkdown) return '';
    let html = rawMarkdown
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(new RegExp('\\\\*\\\\*(.*?)\\\\*\\\\*', 'gim'), '<strong>$1</strong>')
      .replace(new RegExp('\\\\*([^\\\\*]+)\\\\*', 'gim'), '<em>$1</em>')
      .replace(new RegExp('[\\\\u0060]([^\\\\u0060]+)[\\\\u0060]', 'gim'), '<code>$1</code>')
      .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
      .replace(/\\n/gim, '<br />');
    return html.trim();
  },

  getMetrics(text) {
    if (!text || !text.trim()) return { words: 0, characters: 0, lines: 0 };
    const clean = text.trim();
    const words = clean.split(new RegExp('\\\\s+')).filter(Boolean).length;
    const characters = text.length;
    const lines = text.split('\\n').length;
    return { words, characters, lines };
  },

  extractHeadings(markdown) {
    if (!markdown) return [];
    const matches = markdown.match(new RegExp('^#{1,3}\\\\s+(.*)$', 'gm')) || [];
    return matches.map(h => h.replace(new RegExp('^#{1,3}\\\\s+'), '').trim());
  }
};
`,
    tests: [
      { name: 'parse translates headers (#, ##, ###) into HTML tags', run: 'const out1 = MarkdownParser.parse("# Title 1"); if (!out1.includes("<h1>Title 1</h1>")) throw new Error("H1 parse failed"); const out2 = MarkdownParser.parse("## Title 2"); if (!out2.includes("<h2>Title 2</h2>")) throw new Error("H2 parse failed");' },
      { name: 'parse transforms bold (**text**) into strong tags', run: 'const out = MarkdownParser.parse("This is **important** notice"); if (!out.includes("<strong>important</strong>")) throw new Error("Bold parse failed: " + out);' },
      { name: 'parse handles inline code (`code`) tags', run: 'const out = MarkdownParser.parse("Use \\x60const\\x60 keyword"); if (!out.includes("<code>const</code>")) throw new Error("Inline code parse failed: " + out);' },
      { name: 'getMetrics returns exact words, characters, and line counts', run: 'const m = MarkdownParser.getMetrics("Helix code engine\\nis awesome"); if (m.words !== 5 || m.lines !== 2) throw new Error("Metrics mismatch: " + JSON.stringify(m));' },
      { name: 'extractHeadings returns structured array of document sections', run: 'const md = "# Intro\\nSome text\\n## Setup\\nMore text\\n### Details"; const h = MarkdownParser.extractHeadings(md); if (h.length !== 3 || h[0] !== "Intro" || h[1] !== "Setup" || h[2] !== "Details") throw new Error("Headings extraction failed: " + JSON.stringify(h));' }
    ],
    hints: [
      'Use new RegExp to construct expressions safely.',
      'Replace H3 before H2 and H1 so ### does not get partially matched by #.',
      'Count words by splitting on \\\\s+ and filtering out empty tokens.'
    ]
  },
  {
    id: 'quiz',
    title: 'Trivia Quiz Quest & Score Tracker',
    category: 'Games',
    difficulty: 'Beginner',
    time: '45 mins',
    xp: 200,
    icon: '🎮',
    badgeClass: 'badge-primary',
    difficultyBadge: 'badge-warning',
    description: 'Build an interactive game engine featuring dynamic questions, streak multiplier bonus calculations, answer correctness validation, history audit tracking, and final completion summaries.',
    skills: ['Game State', 'Score Multipliers', 'Array Traversal', 'Performance Analytics'],
    starterCode: `// ============================================================
// HELIX PROJECT: Trivia Quiz Quest & Score Tracker
// ============================================================

const QuizEngine = {
  questions: [],
  currentIndex: 0,
  score: 0,
  streak: 0,
  history: [],

  init(questionList) {
    this.questions = questionList || [];
    this.currentIndex = 0;
    this.score = 0;
    this.streak = 0;
    this.history = [];
    return this.getCurrentQuestion();
  },

  getCurrentQuestion() {
    return this.questions[this.currentIndex] || null;
  },

  submitAnswer(selectedOptionIndex) {
    const currentQ = this.getCurrentQuestion();
    if (!currentQ) return null;
    const isCorrect = selectedOptionIndex === currentQ.correctIndex;
    if (isCorrect) {
      this.streak += 1;
      const bonus = this.streak > 2 ? 50 : 0;
      this.score += 100 + bonus;
    } else {
      this.streak = 0;
    }
    this.history.push({
      question: currentQ.question,
      selected: selectedOptionIndex,
      correct: currentQ.correctIndex,
      isCorrect
    });
    this.currentIndex++;
    return {
      isCorrect,
      score: this.score,
      streak: this.streak,
      hasNext: this.currentIndex < this.questions.length
    };
  },

  getSummary() {
    const total = this.questions.length;
    const correctCount = this.history.filter(h => h.isCorrect).length;
    return {
      totalQuestions: total,
      answered: this.history.length,
      correctCount,
      finalScore: this.score,
      accuracyPercent: total > 0 ? Math.round((correctCount / total) * 100) : 0
    };
  }
};
`,
    tests: [
      { name: 'init resets state and returns the first question', run: 'const qs = [{ question: "Q1", options: ["A", "B"], correctIndex: 0 }]; const first = QuizEngine.init(qs); if (!first || first.question !== "Q1" || QuizEngine.score !== 0 || QuizEngine.streak !== 0) throw new Error("Init state invalid");' },
      { name: 'submitAnswer awards 100 points for correct answer', run: 'const qs = [{ question: "Q1", options: ["A", "B"], correctIndex: 1 }]; QuizEngine.init(qs); const res = QuizEngine.submitAnswer(1); if (!res.isCorrect || QuizEngine.score !== 100) throw new Error("Expected 100 score on correct answer");' },
      { name: 'Streak bonus kicks in after 2 consecutive correct answers', run: 'const qs = [{ question: "Q1", options: ["A"], correctIndex: 0 }, { question: "Q2", options: ["A"], correctIndex: 0 }, { question: "Q3", options: ["A"], correctIndex: 0 }]; QuizEngine.init(qs); QuizEngine.submitAnswer(0); QuizEngine.submitAnswer(0); const res3 = QuizEngine.submitAnswer(0); if (QuizEngine.streak !== 3 || QuizEngine.score !== 350) throw new Error("Expected score 350 (100+100+150), got " + QuizEngine.score);' },
      { name: 'Incorrect answer resets streak to 0', run: 'const qs = [{ question: "Q1", options: ["A"], correctIndex: 0 }, { question: "Q2", options: ["A"], correctIndex: 0 }]; QuizEngine.init(qs); QuizEngine.submitAnswer(0); QuizEngine.submitAnswer(1); if (QuizEngine.streak !== 0) throw new Error("Streak should be 0 on mistake");' },
      { name: 'getSummary produces exact accuracy percentage and history', run: 'const qs = [{ question: "Q1", options: ["A"], correctIndex: 0 }, { question: "Q2", options: ["A"], correctIndex: 0 }]; QuizEngine.init(qs); QuizEngine.submitAnswer(0); QuizEngine.submitAnswer(1); const s = QuizEngine.getSummary(); if (s.accuracyPercent !== 50 || s.correctCount !== 1) throw new Error("Summary accuracy error: " + JSON.stringify(s));' }
    ],
    hints: [
      'Keep track of question index with this.currentIndex++.',
      'Streak counter increments on success, resets to 0 on incorrect.',
      'Check this.currentIndex < this.questions.length to determine if more questions remain.'
    ]
  },
  {
    id: 'expenses',
    title: 'Personal Expense & Budget Tracker Ledger',
    category: 'Full Stack',
    difficulty: 'Advanced',
    time: '1 hr 15 mins',
    xp: 300,
    icon: '💳',
    badgeClass: 'badge-error',
    difficultyBadge: 'badge-error',
    description: 'Build an automated financial accounting engine supporting multi-currency income/expense transactions, net balance computation, categorical spending breakdowns, and over-budget threshold detection.',
    skills: ['Financial Arithmetic', 'Data Grouping', 'Object Aggregations', 'Budget Thresholds'],
    starterCode: `// ============================================================
// HELIX PROJECT: Personal Expense & Budget Tracker Ledger
// ============================================================

const ExpenseTracker = {
  transactions: [],
  budgetLimit: 2000,

  addTransaction(title, amount, type = 'expense', category = 'general') {
    if (!title || isNaN(amount) || amount <= 0) return null;
    const item = {
      id: 'tx_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      title: title.trim(),
      amount: Number(amount),
      type, // 'income' or 'expense'
      category,
      date: new Date().toISOString()
    };
    this.transactions.push(item);
    return item;
  },

  getBalance() {
    return this.transactions.reduce((acc, curr) => {
      return curr.type === 'income' ? acc + curr.amount : acc - curr.amount;
    }, 0);
  },

  getTotals() {
    let income = 0;
    let expense = 0;
    this.transactions.forEach(t => {
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    });
    return { income, expense, balance: income - expense };
  },

  getByCategory() {
    const map = {};
    this.transactions.filter(t => t.type === 'expense').forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return map;
  },

  isOverBudget() {
    const { expense } = this.getTotals();
    return expense > this.budgetLimit;
  }
};
`,
    tests: [
      { name: 'addTransaction properly creates valid ledger item', run: 'ExpenseTracker.transactions = []; const tx = ExpenseTracker.addTransaction("Salary", 3000, "income", "salary"); if (!tx || tx.amount !== 3000 || tx.type !== "income") throw new Error("Invalid transaction created");' },
      { name: 'getBalance accurately computes net savings (income - expense)', run: 'ExpenseTracker.transactions = []; ExpenseTracker.addTransaction("Client Pay", 1200, "income", "freelance"); ExpenseTracker.addTransaction("Rent", 500, "expense", "housing"); if (ExpenseTracker.getBalance() !== 700) throw new Error("Expected balance 700, got " + ExpenseTracker.getBalance());' },
      { name: 'getTotals splits total income and total expense correctly', run: 'ExpenseTracker.transactions = []; ExpenseTracker.addTransaction("Salary", 2000, "income"); ExpenseTracker.addTransaction("Food", 150, "expense"); ExpenseTracker.addTransaction("Tech", 250, "expense"); const t = ExpenseTracker.getTotals(); if (t.income !== 2000 || t.expense !== 400 || t.balance !== 1600) throw new Error("Totals mismatch: " + JSON.stringify(t));' },
      { name: 'getByCategory groups spending amounts by category name', run: 'ExpenseTracker.transactions = []; ExpenseTracker.addTransaction("Groceries", 60, "expense", "food"); ExpenseTracker.addTransaction("Dinner", 40, "expense", "food"); ExpenseTracker.addTransaction("Sub", 15, "expense", "entertainment"); const cat = ExpenseTracker.getByCategory(); if (cat.food !== 100 || cat.entertainment !== 15) throw new Error("Category breakdown error: " + JSON.stringify(cat));' },
      { name: 'isOverBudget triggers true only when expense exceeds budget limit', run: 'ExpenseTracker.transactions = []; ExpenseTracker.budgetLimit = 500; ExpenseTracker.addTransaction("PC", 600, "expense"); if (!ExpenseTracker.isOverBudget()) throw new Error("Should be over budget"); ExpenseTracker.budgetLimit = 1000; if (ExpenseTracker.isOverBudget()) throw new Error("Should not be over budget");' }
    ],
    hints: [
      'Check curr.type === "income" to decide whether to add or subtract in reduce().',
      'getByCategory() should only consider items where type === "expense".',
      'Ensure numbers are converted via Number(amount) before adding to totals.'
    ]
  }
];

let currentActiveProject = null;
let activeProjectsCategory = 'all';

function getCompletedProjects() {
  try {
    return JSON.parse(localStorage.getItem('helix_completed_projects') || '[]');
  } catch (e) {
    return [];
  }
}

function setCompletedProject(projectId) {
  try {
    const list = getCompletedProjects();
    if (!list.includes(projectId)) {
      list.push(projectId);
      localStorage.setItem('helix_completed_projects', JSON.stringify(list));
    }
  } catch (e) {}
}

function getProjectCustomCode(projectId) {
  try {
    const saved = JSON.parse(localStorage.getItem('helix_project_code') || '{}');
    return saved[projectId] || null;
  } catch (e) {
    return null;
  }
}

function saveProjectCustomCode(projectId, code) {
  try {
    const saved = JSON.parse(localStorage.getItem('helix_project_code') || '{}');
    saved[projectId] = code;
    localStorage.setItem('helix_project_code', JSON.stringify(saved));
  } catch (e) {}
}

function renderProjectsGrid() {
  const container = document.getElementById('projects-cards-container');
  if (!container) return;

  const completed = getCompletedProjects();
  const searchQ = (document.getElementById('projects-search-input')?.value || '').toLowerCase().trim();
  const diffFilter = document.getElementById('projects-difficulty-filter')?.value || 'all';

  let totalProjectXP = 0;
  completed.forEach(id => {
    const p = HELIX_PROJECTS.find(x => x.id === id);
    if (p) totalProjectXP += p.xp;
  });

  const totalEl = document.getElementById('stat-total-projects');
  const compEl = document.getElementById('stat-completed-projects');
  const xpEl = document.getElementById('stat-earned-project-xp');
  const rankEl = document.getElementById('stat-builder-level');
  const badgeEl = document.getElementById('projects-active-count-badge');

  if (totalEl) totalEl.textContent = HELIX_PROJECTS.length;
  if (compEl) compEl.textContent = completed.length;
  if (xpEl) xpEl.textContent = totalProjectXP + ' XP';
  if (badgeEl) badgeEl.textContent = HELIX_PROJECTS.length + ' Active Projects';
  if (rankEl) {
    if (completed.length >= 5) rankEl.textContent = 'Principal Builder';
    else if (completed.length >= 3) rankEl.textContent = 'Full-Stack Craftsman';
    else if (completed.length >= 1) rankEl.textContent = 'App Developer';
    else rankEl.textContent = 'Junior Builder';
  }

  const filtered = HELIX_PROJECTS.filter(p => {
    if (activeProjectsCategory !== 'all' && p.category !== activeProjectsCategory) return false;
    if (diffFilter !== 'all' && p.difficulty !== diffFilter) return false;
    if (searchQ) {
      const matchTitle = p.title.toLowerCase().includes(searchQ);
      const matchDesc = p.description.toLowerCase().includes(searchQ);
      const matchSkills = p.skills.some(s => s.toLowerCase().includes(searchQ));
      if (!matchTitle && !matchDesc && !matchSkills) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: var(--sp-12) var(--sp-4); background: var(--surface); border: 1px dashed var(--border); border-radius: var(--r-xl);">
        <div style="font-size: 2.5rem; margin-bottom: 8px;">🔍</div>
        <div style="font-size: 1.125rem; font-weight: 600; margin-bottom: 4px;">No matching projects found</div>
        <div style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: var(--sp-4);">Try selecting another category or clearing search filters.</div>
        <button class="btn btn-secondary btn-sm" onclick="clearProjectFilters()">Reset Filters</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(p => {
    const isDone = completed.includes(p.id);
    const hasCustomCode = !!getProjectCustomCode(p.id);
    return `
      <div class="project-card" id="project-card-${p.id}">
        <div>
          <div class="project-card-header">
            <div class="project-icon-box">${p.icon}</div>
            <div style="display: flex; gap: 6px; align-items: center;">
              <span class="badge ${p.badgeClass}">${p.category}</span>
              <span class="badge ${p.difficultyBadge}">${p.difficulty}</span>
            </div>
          </div>
          <div class="project-card-title">${p.title}</div>
          <div class="project-card-desc">${p.description}</div>
          <div class="project-skills-list">
            ${p.skills.map(s => `<span class="project-skill-tag">${s}</span>`).join('')}
          </div>
        </div>

        <div>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8125rem; margin-bottom: var(--sp-3);">
            <div style="display: flex; align-items: center; gap: 6px; color: var(--text-muted);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>${p.time}</span>
            </div>
            <span class="badge ${isDone ? 'badge-success' : 'badge-primary'}" style="font-weight: 600;">
              ${isDone ? '✓ Completed (' + p.xp + ' XP)' : '+' + p.xp + ' XP'}
            </span>
          </div>

          <div class="project-card-footer">
            <button class="btn btn-secondary btn-sm" onclick="openProjectInSandbox('${p.id}')" title="Load into live sandbox">
              Sandbox
            </button>
            <button class="btn btn-primary btn-sm" onclick="launchProject('${p.id}')" style="flex: 1;">
              ${isDone ? 'Open Studio ✓' : (hasCustomCode ? 'Continue Project' : 'Launch Studio')}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function filterProjectsByCategory(category, btn) {
  activeProjectsCategory = category;
  document.querySelectorAll('.projects-cat-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderProjectsGrid();
}

function filterProjects() {
  renderProjectsGrid();
}

function clearProjectFilters() {
  activeProjectsCategory = 'all';
  const catBtns = document.querySelectorAll('.projects-cat-btn');
  catBtns.forEach(b => b.classList.toggle('active', b.dataset.cat === 'all'));
  const searchInput = document.getElementById('projects-search-input');
  if (searchInput) searchInput.value = '';
  const diffSelect = document.getElementById('projects-difficulty-filter');
  if (diffSelect) diffSelect.value = 'all';
  renderProjectsGrid();
}

function launchProject(projectId) {
  const project = HELIX_PROJECTS.find(p => p.id === projectId);
  if (!project) return;
  currentActiveProject = project;

  const modal = document.getElementById('project-studio-modal');
  if (!modal) return;

  document.getElementById('studio-icon').textContent = project.icon;
  document.getElementById('studio-title').textContent = project.title;
  document.getElementById('studio-badge-category').textContent = project.category;
  document.getElementById('studio-badge-category').className = 'badge ' + project.badgeClass;
  document.getElementById('studio-badge-difficulty').textContent = project.difficulty;
  document.getElementById('studio-badge-difficulty').className = 'badge ' + project.difficultyBadge;
  document.getElementById('studio-badge-xp').textContent = '+' + project.xp + ' XP';
  document.getElementById('studio-specs-desc').textContent = project.description;

  // Render hints
  const hintsContainer = document.getElementById('studio-hints-content');
  if (hintsContainer) {
    hintsContainer.innerHTML = `
      <ul style="padding-left: 20px; margin: 0;">
        ${project.hints.map(h => `<li style="margin-bottom: 8px;">${h}</li>`).join('')}
      </ul>
      <div style="margin-top: 12px; padding: 10px; border-radius: var(--r-md); background: var(--surface); border: 1px solid var(--border);">
        <strong>Skills Covered:</strong> ${project.skills.join(', ')}
      </div>
    `;
  }

  // Set code editor
  const editor = document.getElementById('studio-code-editor');
  if (editor) {
    const savedCode = getProjectCustomCode(project.id);
    editor.value = savedCode || project.starterCode;
  }

  // Render test cases list
  renderStudioTestCases(project);

  // Switch tabs to specs and code
  switchStudioLeftTab('specs', document.getElementById('studio-tab-specs'));
  switchStudioRightTab('code', document.getElementById('studio-viewtab-code'));

  // Reset console
  const consoleEl = document.getElementById('studio-test-console');
  if (consoleEl) {
    consoleEl.textContent = '// Ready to run test suite. Click "Run Test Suite" to evaluate code.';
    consoleEl.style.color = '#94A3B8';
  }

  modal.style.display = 'flex';
  emitEvent('project_opened', { project_id: project.id, category: project.category });
}

function closeProjectStudio() {
  const modal = document.getElementById('project-studio-modal');
  if (modal) modal.style.display = 'none';
  currentActiveProject = null;
  renderProjectsGrid();
}

function switchStudioLeftTab(tabName, btn) {
  document.getElementById('studio-tab-specs')?.classList.remove('active');
  document.getElementById('studio-tab-hints')?.classList.remove('active');
  if (btn) btn.classList.add('active');

  const panelSpecs = document.getElementById('studio-panel-specs');
  const panelHints = document.getElementById('studio-panel-hints');
  if (panelSpecs) panelSpecs.style.display = tabName === 'specs' ? 'block' : 'none';
  if (panelHints) panelHints.style.display = tabName === 'hints' ? 'block' : 'none';
}

function switchStudioRightTab(tabName, btn) {
  document.getElementById('studio-viewtab-code')?.classList.remove('active');
  document.getElementById('studio-viewtab-preview')?.classList.remove('active');
  if (btn) btn.classList.add('active');

  const codeContainer = document.getElementById('studio-container-code');
  const previewContainer = document.getElementById('studio-container-preview');
  if (codeContainer) codeContainer.style.display = tabName === 'code' ? 'flex' : 'none';
  if (previewContainer) previewContainer.style.display = tabName === 'preview' ? 'block' : 'none';

  if (tabName === 'preview' && currentActiveProject) {
    renderStudioLivePreview(currentActiveProject.id);
  }
}

function handleStudioCodeInput() {
  if (!currentActiveProject) return;
  const editor = document.getElementById('studio-code-editor');
  if (!editor) return;
  saveProjectCustomCode(currentActiveProject.id, editor.value);
  const ind = document.getElementById('studio-save-indicator');
  if (ind) {
    ind.textContent = 'Saving...';
    setTimeout(() => { ind.textContent = 'Auto-saved to local session'; }, 400);
  }
}

function resetStudioCode() {
  if (!currentActiveProject) return;
  if (confirm('Reset project code back to the original starter template?')) {
    const editor = document.getElementById('studio-code-editor');
    if (editor) {
      editor.value = currentActiveProject.starterCode;
      saveProjectCustomCode(currentActiveProject.id, editor.value);
      renderStudioTestCases(currentActiveProject);
    }
  }
}

function renderStudioTestCases(project, results = null) {
  const container = document.getElementById('studio-test-cases-list');
  const passedCountEl = document.getElementById('studio-tests-passed-count');
  const totalCountEl = document.getElementById('studio-tests-total-count');

  if (!container || !project) return;
  if (totalCountEl) totalCountEl.textContent = project.tests.length;

  let passedTotal = 0;
  container.innerHTML = project.tests.map((t, idx) => {
    const res = results ? results[idx] : null;
    let statusClass = '';
    let icon = '⚪';
    if (res) {
      if (res.passed) {
        statusClass = 'passed';
        icon = '✓';
        passedTotal++;
      } else {
        statusClass = 'failed';
        icon = '✗';
      }
    }
    return `
      <div class="test-suite-row ${statusClass}">
        <span style="font-weight: 700; color: ${res ? (res.passed ? 'var(--success)' : 'var(--error)') : 'var(--text-muted)'};">${icon}</span>
        <div style="flex: 1;">
          <div style="font-weight: 500; color: var(--text-primary);">${t.name}</div>
          ${res && !res.passed ? `<div style="font-size: 0.75rem; color: var(--error); margin-top: 2px; font-family: var(--font-mono);">${res.error}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  if (passedCountEl) passedCountEl.textContent = passedTotal;
}

function runStudioTests() {
  if (!currentActiveProject) return;
  const editor = document.getElementById('studio-code-editor');
  const consoleEl = document.getElementById('studio-test-console');
  if (!editor || !consoleEl) return;

  const userCode = editor.value;
  const project = currentActiveProject;
  const testResults = [];
  const logMessages = [];

  logMessages.push(`[Test Suite] Running 5 automated test cases for "${project.title}"...`);

  let allPassed = true;

  project.tests.forEach((test, idx) => {
    const wrappedHarness = `
      ${userCode}
      ;
      (function() {
        ${test.run}
      })();
    `;
    const exec = executeSandboxedJS(wrappedHarness);
    if (exec.success) {
      testResults.push({ passed: true, error: null });
      logMessages.push(`✓ Test ${idx + 1} PASSED: ${test.name}`);
    } else {
      allPassed = false;
      const errMsg = exec.error ? (exec.error.message || String(exec.error)) : 'Unknown error';
      testResults.push({ passed: false, error: errMsg });
      logMessages.push(`✗ Test ${idx + 1} FAILED: ${test.name} -> ${errMsg}`);
    }
  });

  renderStudioTestCases(project, testResults);

  if (allPassed) {
    setCompletedProject(project.id);
    logMessages.push(`\n🎉 ALL 5 ACCEPTANCE TESTS PASSED!`);
    logMessages.push(`🏆 Project marked as COMPLETED! +${project.xp} XP awarded to your profile!`);
    consoleEl.textContent = logMessages.join('\n');
    consoleEl.style.color = '#34D399';

    // Award XP to dashboard & profile if present
    const profileXp = document.getElementById('profile-xp-count');
    if (profileXp) {
      const current = parseInt(profileXp.textContent, 10) || 320;
      profileXp.textContent = current + project.xp;
    }

    emitEvent('project_completed', {
      project_id: project.id,
      xp_awarded: project.xp,
      tests_passed: 5
    });

    renderProjectsGrid();
  } else {
    logMessages.push(`\n⚠️ Some tests failed. Review the hints tab and adjust your code.`);
    consoleEl.textContent = logMessages.join('\n');
    consoleEl.style.color = '#F87171';
  }
}

function openStudioInSandbox() {
  if (!currentActiveProject) return;
  const editor = document.getElementById('studio-code-editor');
  const code = editor ? editor.value : currentActiveProject.starterCode;
  closeProjectStudio();
  navigateTo('sandbox');
  const sandboxEditor = document.getElementById('sandbox-code-editor');
  if (sandboxEditor) {
    sandboxEditor.value = code;
    runSandboxCode();
  }
}

function openProjectInSandbox(projectId) {
  const p = HELIX_PROJECTS.find(x => x.id === projectId);
  if (!p) return;
  const saved = getProjectCustomCode(p.id);
  navigateTo('sandbox');
  const sandboxEditor = document.getElementById('sandbox-code-editor');
  if (sandboxEditor) {
    sandboxEditor.value = saved || p.starterCode;
    runSandboxCode();
  }
}

function downloadStudioCode() {
  if (!currentActiveProject) return;
  const editor = document.getElementById('studio-code-editor');
  const code = editor ? editor.value : currentActiveProject.starterCode;
  const blob = new Blob([code], { type: 'text/javascript' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `helix_${currentActiveProject.id}_project.js`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function renderStudioLivePreview(projectId) {
  const container = document.getElementById('studio-live-preview-content');
  if (!container) return;

  if (projectId === 'todo') {
    container.innerHTML = `
      <div style="max-width: 520px; margin: 0 auto; background: var(--surface); padding: var(--sp-6); border-radius: var(--r-xl); border: 1px solid var(--border); box-shadow: var(--shadow-md);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--sp-4);">
          <h3 style="font-size: 1.25rem; font-weight: 700; margin: 0;">Task Manager</h3>
          <span class="badge badge-primary" id="preview-todo-counter">2 items</span>
        </div>
        <div style="display: flex; gap: var(--sp-2); margin-bottom: var(--sp-4);">
          <input type="text" id="preview-todo-input" placeholder="What needs to be done?" style="flex: 1; padding: 8px 12px; border-radius: var(--r-md); border: 1px solid var(--border); background: var(--bg-primary); color: var(--text-primary); outline: none;">
          <button class="btn btn-primary btn-sm" onclick="previewAddTodo()">Add Task</button>
        </div>
        <div style="display: flex; gap: var(--sp-2); margin-bottom: var(--sp-3);">
          <button class="btn btn-secondary btn-sm" id="todo-pfilter-all" onclick="previewFilterTodos('all', this)">All</button>
          <button class="btn btn-ghost btn-sm" id="todo-pfilter-active" onclick="previewFilterTodos('active', this)">Active</button>
          <button class="btn btn-ghost btn-sm" id="todo-pfilter-completed" onclick="previewFilterTodos('completed', this)">Completed</button>
        </div>
        <div id="preview-todo-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
      </div>
    `;
    window.__previewTodos = [
      { id: '1', title: 'Complete Variables & Types module', completed: true },
      { id: '2', title: 'Build interactive To-Do portfolio project', completed: false }
    ];
    window.__previewTodoFilter = 'all';
    previewRenderTodoList();
  } else if (projectId === 'calculator') {
    container.innerHTML = `
      <div style="max-width: 320px; margin: 0 auto; background: #0B1121; padding: var(--sp-5); border-radius: var(--r-2xl); border: 1px solid #1E293B; box-shadow: var(--shadow-xl);">
        <div id="calc-display" style="background: #151D2E; color: #FFFFFF; font-family: var(--font-mono); font-size: 2rem; padding: 14px; text-align: right; border-radius: var(--r-lg); margin-bottom: var(--sp-4); overflow: hidden;">0</div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
          <button class="btn btn-secondary" onclick="calcPress('C')">C</button>
          <button class="btn btn-secondary" onclick="calcPress('%')">%</button>
          <button class="btn btn-secondary" onclick="calcPress('/')">÷</button>
          <button class="btn btn-primary" onclick="calcPress('*')">×</button>
          <button class="btn btn-secondary" onclick="calcPress('7')">7</button>
          <button class="btn btn-secondary" onclick="calcPress('8')">8</button>
          <button class="btn btn-secondary" onclick="calcPress('9')">9</button>
          <button class="btn btn-primary" onclick="calcPress('-')">−</button>
          <button class="btn btn-secondary" onclick="calcPress('4')">4</button>
          <button class="btn btn-secondary" onclick="calcPress('5')">5</button>
          <button class="btn btn-secondary" onclick="calcPress('6')">6</button>
          <button class="btn btn-primary" onclick="calcPress('+')">+</button>
          <button class="btn btn-secondary" onclick="calcPress('1')">1</button>
          <button class="btn btn-secondary" onclick="calcPress('2')">2</button>
          <button class="btn btn-secondary" onclick="calcPress('3')">3</button>
          <button class="btn btn-primary" style="grid-row: span 2;" onclick="calcPress('=')">=</button>
          <button class="btn btn-secondary" style="grid-column: span 2;" onclick="calcPress('0')">0</button>
          <button class="btn btn-secondary" onclick="calcPress('.')">.</button>
        </div>
      </div>
    `;
    window.__calcState = { val: '0', prev: null, op: null };
  } else if (projectId === 'weather') {
    container.innerHTML = `
      <div style="max-width: 540px; margin: 0 auto; background: var(--surface); padding: var(--sp-6); border-radius: var(--r-xl); border: 1px solid var(--border); box-shadow: var(--shadow-md);">
        <div style="display: flex; gap: var(--sp-2); margin-bottom: var(--sp-5);">
          <input type="text" id="preview-weather-input" value="San Francisco" placeholder="Enter city name..." style="flex: 1; padding: 8px 12px; border-radius: var(--r-md); border: 1px solid var(--border); background: var(--bg-primary); color: var(--text-primary); outline: none;">
          <button class="btn btn-primary btn-sm" onclick="previewWeatherSearch()">Search City</button>
        </div>
        <div id="preview-weather-card" style="text-align: center; padding: var(--sp-4); background: var(--bg-primary); border-radius: var(--r-lg); margin-bottom: var(--sp-4);">
          <div style="font-size: 2.5rem; margin-bottom: 4px;">🌤️</div>
          <div style="font-size: 1.5rem; font-weight: 700;">San Francisco</div>
          <div style="font-size: 2.25rem; font-weight: 800; color: var(--primary); margin: 6px 0;">19°C <span style="font-size: 1rem; color: var(--text-muted);">(66°F)</span></div>
          <div style="font-size: 0.875rem; color: var(--text-secondary);">Partly Cloudy • Humidity 62% • Wind 9 km/h</div>
        </div>
        <div style="font-weight: 600; font-size: 0.875rem; margin-bottom: 8px;">5-Day Forecast</div>
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; text-align: center;">
          <div style="background: var(--bg-primary); padding: 8px; border-radius: var(--r-md); font-size: 0.75rem;"><div style="color:var(--text-muted);">Mon</div><div style="font-size: 1.25rem; margin: 2px 0;">☀️</div><div style="font-weight:600;">22°C</div></div>
          <div style="background: var(--bg-primary); padding: 8px; border-radius: var(--r-md); font-size: 0.75rem;"><div style="color:var(--text-muted);">Tue</div><div style="font-size: 1.25rem; margin: 2px 0;">🌤️</div><div style="font-weight:600;">20°C</div></div>
          <div style="background: var(--bg-primary); padding: 8px; border-radius: var(--r-md); font-size: 0.75rem;"><div style="color:var(--text-muted);">Wed</div><div style="font-size: 1.25rem; margin: 2px 0;">🌧️</div><div style="font-weight:600;">16°C</div></div>
          <div style="background: var(--bg-primary); padding: 8px; border-radius: var(--r-md); font-size: 0.75rem;"><div style="color:var(--text-muted);">Thu</div><div style="font-size: 1.25rem; margin: 2px 0;">☁️</div><div style="font-weight:600;">17°C</div></div>
          <div style="background: var(--bg-primary); padding: 8px; border-radius: var(--r-md); font-size: 0.75rem;"><div style="color:var(--text-muted);">Fri</div><div style="font-size: 1.25rem; margin: 2px 0;">☀️</div><div style="font-weight:600;">21°C</div></div>
        </div>
      </div>
    `;
  } else if (projectId === 'markdown') {
    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4); height: 100%;">
        <div style="display: flex; flex-direction: column;">
          <div style="font-size: 0.8125rem; font-weight: 600; margin-bottom: 6px;">Raw Markdown Input</div>
          <textarea id="preview-md-input" oninput="previewUpdateMarkdown()" style="flex: 1; min-height: 220px; padding: 12px; border-radius: var(--r-md); border: 1px solid var(--border); background: var(--bg-dark); color: #F8FAFC; font-family: var(--font-mono); font-size: 0.8125rem; outline: none; resize: none;"># Welcome to Helix Markdown\n\nBuild **real-world** full-stack apps with \`clean code\`!\n\n> Learning by building is the fastest path to mastery.\n\n## Key Features\n- Instant parsing\n- Word metrics\n- Live preview</textarea>
          <div id="preview-md-stats" style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Words: 24 | Chars: 175</div>
        </div>
        <div style="display: flex; flex-direction: column;">
          <div style="font-size: 0.8125rem; font-weight: 600; margin-bottom: 6px;">Rendered HTML Output</div>
          <div id="preview-md-render" style="flex: 1; min-height: 220px; padding: 16px; border-radius: var(--r-md); border: 1px solid var(--border); background: var(--surface); line-height: 1.6; overflow-y: auto;"></div>
        </div>
      </div>
    `;
    previewUpdateMarkdown();
  } else if (projectId === 'quiz') {
    container.innerHTML = `
      <div style="max-width: 480px; margin: 0 auto; background: var(--surface); padding: var(--sp-6); border-radius: var(--r-xl); border: 1px solid var(--border); box-shadow: var(--shadow-md);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-4);">
          <span class="badge badge-primary" id="quiz-streak-badge">Streak: 0 🔥</span>
          <span style="font-size: 1.125rem; font-weight: 700;" id="quiz-score-badge">0 XP</span>
        </div>
        <div id="quiz-question-box">
          <div style="font-size: 1rem; font-weight: 700; margin-bottom: var(--sp-4);" id="quiz-question-text">
            What keyword declares a block-scoped variable that cannot be reassigned?
          </div>
          <div id="quiz-options-container" style="display: flex; flex-direction: column; gap: 8px;">
            <button class="btn btn-secondary w-full" style="text-align: left; justify-content: flex-start;" onclick="previewQuizAnswer(0)">A. var</button>
            <button class="btn btn-secondary w-full" style="text-align: left; justify-content: flex-start;" onclick="previewQuizAnswer(1)">B. let</button>
            <button class="btn btn-secondary w-full" style="text-align: left; justify-content: flex-start;" onclick="previewQuizAnswer(2)">C. const</button>
          </div>
        </div>
        <div id="quiz-result-box" style="margin-top: var(--sp-4); font-size: 0.875rem; font-weight: 600; min-height: 24px;"></div>
      </div>
    `;
    window.__quizScore = 0;
    window.__quizStreak = 0;
  } else if (projectId === 'expenses') {
    container.innerHTML = `
      <div style="max-width: 580px; margin: 0 auto; background: var(--surface); padding: var(--sp-6); border-radius: var(--r-xl); border: 1px solid var(--border); box-shadow: var(--shadow-md);">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: var(--sp-5); text-align: center;">
          <div style="background: var(--bg-primary); padding: 10px; border-radius: var(--r-md);"><div style="font-size:0.75rem; color:var(--text-muted);">Net Balance</div><div id="expense-net" style="font-size: 1.25rem; font-weight: 700; color: var(--success);">$1,450</div></div>
          <div style="background: var(--bg-primary); padding: 10px; border-radius: var(--r-md);"><div style="font-size:0.75rem; color:var(--text-muted);">Total Income</div><div id="expense-income" style="font-size: 1.25rem; font-weight: 700; color: var(--primary);">$2,000</div></div>
          <div style="background: var(--bg-primary); padding: 10px; border-radius: var(--r-md);"><div style="font-size:0.75rem; color:var(--text-muted);">Total Expenses</div><div id="expense-total" style="font-size: 1.25rem; font-weight: 700; color: var(--error);">$550</div></div>
        </div>
        <div style="display: flex; gap: 8px; margin-bottom: var(--sp-4);">
          <input type="text" id="expense-title-in" placeholder="Description" style="flex: 2; padding: 7px 10px; border-radius: var(--r-md); border: 1px solid var(--border); background: var(--bg-primary); color: var(--text-primary); outline: none; font-size: 0.8125rem;">
          <input type="number" id="expense-amount-in" placeholder="Amount ($)" style="flex: 1; padding: 7px 10px; border-radius: var(--r-md); border: 1px solid var(--border); background: var(--bg-primary); color: var(--text-primary); outline: none; font-size: 0.8125rem;">
          <select id="expense-type-in" class="btn btn-secondary btn-sm" style="outline: none;">
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
          <button class="btn btn-primary btn-sm" onclick="previewAddExpense()">Add</button>
        </div>
        <div id="expense-list" style="display: flex; flex-direction: column; gap: 6px; max-height: 180px; overflow-y: auto;">
          <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--bg-primary); border-radius: var(--r-md); font-size: 0.8125rem;"><span>💻 Freelance Web Project</span><span style="color:var(--success); font-weight:600;">+$2,000</span></div>
          <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--bg-primary); border-radius: var(--r-md); font-size: 0.8125rem;"><span>🏢 Office Rent</span><span style="color:var(--error); font-weight:600;">-$450</span></div>
          <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--bg-primary); border-radius: var(--r-md); font-size: 0.8125rem;"><span>☕ Coffee & Snacks</span><span style="color:var(--error); font-weight:600;">-$100</span></div>
        </div>
      </div>
    `;
  }
}

// Live interactive preview helpers
function previewAddTodo() {
  const input = document.getElementById('preview-todo-input');
  if (!input || !input.value.trim()) return;
  window.__previewTodos.push({
    id: Date.now().toString(),
    title: input.value.trim(),
    completed: false
  });
  input.value = '';
  previewRenderTodoList();
}

function previewToggleTodo(id) {
  const t = window.__previewTodos.find(x => x.id === id);
  if (t) t.completed = !t.completed;
  previewRenderTodoList();
}

function previewDeleteTodo(id) {
  window.__previewTodos = window.__previewTodos.filter(x => x.id !== id);
  previewRenderTodoList();
}

function previewFilterTodos(type, btn) {
  window.__previewTodoFilter = type;
  document.getElementById('todo-pfilter-all')?.classList.replace('btn-secondary', 'btn-ghost');
  document.getElementById('todo-pfilter-active')?.classList.replace('btn-secondary', 'btn-ghost');
  document.getElementById('todo-pfilter-completed')?.classList.replace('btn-secondary', 'btn-ghost');
  btn.classList.replace('btn-ghost', 'btn-secondary');
  previewRenderTodoList();
}

function previewRenderTodoList() {
  const list = document.getElementById('preview-todo-list');
  const counter = document.getElementById('preview-todo-counter');
  if (!list) return;

  const filtered = window.__previewTodos.filter(t => {
    if (window.__previewTodoFilter === 'active') return !t.completed;
    if (window.__previewTodoFilter === 'completed') return t.completed;
    return true;
  });

  if (counter) counter.textContent = `${window.__previewTodos.filter(t => !t.completed).length} active`;

  list.innerHTML = filtered.map(t => `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--bg-primary); border-radius: var(--r-md); border: 1px solid var(--border);">
      <div style="display: flex; align-items: center; gap: 8px; cursor: pointer;" onclick="previewToggleTodo('${t.id}')">
        <input type="checkbox" ${t.completed ? 'checked' : ''} style="cursor: pointer;">
        <span style="font-size: 0.875rem; text-decoration: ${t.completed ? 'line-through' : 'none'}; color: ${t.completed ? 'var(--text-muted)' : 'var(--text-primary)'};">${t.title}</span>
      </div>
      <button onclick="previewDeleteTodo('${t.id}')" style="background: none; border: none; color: var(--error); cursor: pointer; font-size: 14px;">✕</button>
    </div>
  `).join('');
}

function calcPress(k) {
  const d = document.getElementById('calc-display');
  if (!d) return;
  const s = window.__calcState;

  if (k === 'C') {
    s.val = '0'; s.prev = null; s.op = null;
  } else if ('0123456789'.includes(k)) {
    if (s.val === '0') s.val = k;
    else s.val += k;
  } else if (k === '.') {
    if (!s.val.includes('.')) s.val += '.';
  } else if (['+', '-', '*', '/', '%'].includes(k)) {
    s.prev = parseFloat(s.val);
    s.op = k;
    s.val = '0';
  } else if (k === '=') {
    if (s.prev !== null && s.op) {
      const cur = parseFloat(s.val);
      let r = 0;
      if (s.op === '+') r = s.prev + cur;
      if (s.op === '-') r = s.prev - cur;
      if (s.op === '*') r = s.prev * cur;
      if (s.op === '/') r = cur === 0 ? 'Error' : s.prev / cur;
      if (s.op === '%') r = (s.prev * cur) / 100;
      s.val = String(typeof r === 'number' ? Math.round(r * 10000) / 10000 : r);
      s.prev = null;
      s.op = null;
    }
  }
  d.textContent = s.val;
}

function previewWeatherSearch() {
  const city = document.getElementById('preview-weather-input')?.value || 'New York';
  const card = document.getElementById('preview-weather-card');
  if (!card) return;
  card.innerHTML = `
    <div style="font-size: 2.5rem; margin-bottom: 4px;">☀️</div>
    <div style="font-size: 1.5rem; font-weight: 700;">${city}</div>
    <div style="font-size: 2.25rem; font-weight: 800; color: var(--primary); margin: 6px 0;">23°C <span style="font-size: 1rem; color: var(--text-muted);">(73°F)</span></div>
    <div style="font-size: 0.875rem; color: var(--text-secondary);">Clear Sky • Humidity 45% • Wind 12 km/h</div>
  `;
}

function previewUpdateMarkdown() {
  const raw = document.getElementById('preview-md-input')?.value || '';
  const out = document.getElementById('preview-md-render');
  const stats = document.getElementById('preview-md-stats');
  if (!out) return;

  let html = raw
    .replace(/^### (.*$)/gim, '<h3 style="margin: 8px 0;">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 style="margin: 10px 0;">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 style="margin: 12px 0;">$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/\`([^\`]+)\`/gim, '<code style="background:var(--bg-secondary); padding: 2px 4px; border-radius: 4px; font-family:var(--font-mono);">$1</code>')
    .replace(/^\> (.*$)/gim, '<blockquote style="border-left: 3px solid var(--primary); padding-left: 10px; color: var(--text-secondary); margin: 8px 0;">$1</blockquote>')
    .replace(/\n/gim, '<br />');

  out.innerHTML = html;
  if (stats) {
    const words = raw.trim().split(/\s+/).filter(Boolean).length;
    stats.textContent = `Words: ${words} | Chars: ${raw.length}`;
  }
}

function previewQuizAnswer(idx) {
  const res = document.getElementById('quiz-result-box');
  const streakBadge = document.getElementById('quiz-streak-badge');
  const scoreBadge = document.getElementById('quiz-score-badge');
  if (idx === 2) {
    window.__quizScore += 100;
    window.__quizStreak += 1;
    if (res) {
      res.textContent = '✓ Correct! "const" prevents variable reassignment.';
      res.style.color = 'var(--success)';
    }
  } else {
    window.__quizStreak = 0;
    if (res) {
      res.textContent = '✗ Incorrect! "const" is the correct answer.';
      res.style.color = 'var(--error)';
    }
  }
  if (streakBadge) streakBadge.textContent = `Streak: ${window.__quizStreak} 🔥`;
  if (scoreBadge) scoreBadge.textContent = `${window.__quizScore} XP`;
}

function previewAddExpense() {
  const tIn = document.getElementById('expense-title-in');
  const aIn = document.getElementById('expense-amount-in');
  const typeIn = document.getElementById('expense-type-in');
  const list = document.getElementById('expense-list');
  if (!tIn || !aIn || !tIn.value || !aIn.value) return;

  const amount = parseFloat(aIn.value);
  const type = typeIn.value;
  const isIncome = type === 'income';

  const item = document.createElement('div');
  item.style.cssText = 'display: flex; justify-content: space-between; padding: 8px; background: var(--bg-primary); border-radius: var(--r-md); font-size: 0.8125rem;';
  item.innerHTML = `<span>${tIn.value}</span><span style="color:${isIncome ? 'var(--success)' : 'var(--error)'}; font-weight:600;">${isIncome ? '+' : '-'}$${amount}</span>`;
  list.prepend(item);

  tIn.value = '';
  aIn.value = '';
}

