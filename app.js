const STORAGE_KEY = 'to-dir-v1';
const FOCUS_KEY = 'to-dir-focus-history';

const form = document.getElementById('task-form');
const titleField = document.getElementById('task-title');
const projectField = document.getElementById('task-project');
const tagsField = document.getElementById('task-tags');
const priorityField = document.getElementById('task-priority');
const durationField = document.getElementById('task-duration');
const dueDateField = document.getElementById('task-due-date');
const dueTimeField = document.getElementById('task-due-time');
const recurringField = document.getElementById('task-recurring');
const deepWorkField = document.getElementById('task-deep-work');
const parseBtn = document.getElementById('smart-parse-btn');

const list = document.getElementById('task-list');
const template = document.getElementById('task-item-template');
const searchField = document.getElementById('search');
const filterStatus = document.getElementById('filter-status');
const filterPriority = document.getElementById('filter-priority');
const sortBy = document.getElementById('sort-by');
const clearDoneBtn = document.getElementById('clear-done-btn');
const smartSuggestion = document.getElementById('smart-suggestion');
const startFocusBtn = document.getElementById('start-focus-btn');

const activeCount = document.getElementById('active-count');
const doneTodayCount = document.getElementById('done-today-count');
const overdueCount = document.getElementById('overdue-count');
const focusScoreLabel = document.getElementById('focus-score');

const clockTime = document.getElementById('clock-time');
const clockDate = document.getElementById('clock-date');

let tasks = loadJSON(STORAGE_KEY, []);
let focusHistory = loadJSON(FOCUS_KEY, []);

startClock();
render();

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const task = {
    id: crypto.randomUUID(),
    title: titleField.value.trim(),
    project: projectField.value.trim(),
    tags: parseTags(tagsField.value),
    priority: Number(priorityField.value),
    duration: Number(durationField.value) || 30,
    dueAt: composeDateTime(dueDateField.value, dueTimeField.value),
    done: false,
    recurringDaily: recurringField.checked,
    deepWork: deepWorkField.checked,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };

  if (!task.title) {
    titleField.focus();
    return;
  }

  tasks.push(task);
  saveState();
  render();
  form.reset();
  durationField.value = 30;
  priorityField.value = 2;
  titleField.focus();
});

parseBtn.addEventListener('click', () => {
  applySmartParsing();
});

searchField.addEventListener('input', render);
filterStatus.addEventListener('change', render);
filterPriority.addEventListener('change', render);
sortBy.addEventListener('change', render);

clearDoneBtn.addEventListener('click', () => {
  tasks = tasks.filter((task) => !task.done);
  saveState();
  render();
});

startFocusBtn.addEventListener('click', () => {
  focusHistory.push(new Date().toISOString());
  focusHistory = focusHistory.slice(-50);
  localStorage.setItem(FOCUS_KEY, JSON.stringify(focusHistory));
  startFocusBtn.textContent = 'Session lancée ✅';
  setTimeout(() => {
    startFocusBtn.textContent = 'Démarrer 25 min focus';
  }, 1800);
  render();
});

function applySmartParsing() {
  const raw = titleField.value;
  if (!raw) return;

  const lowered = raw.toLowerCase();

  if (!projectField.value) {
    const projectMatch = raw.match(/@([\p{L}\d_-]+)/u);
    if (projectMatch) projectField.value = projectMatch[1];
  }

  if (!tagsField.value) {
    const tags = [...raw.matchAll(/#([\p{L}\d_-]+)/gu)].map((m) => m[1]);
    if (tags.length) tagsField.value = tags.join(',');
  }

  if (lowered.includes('p1') || lowered.includes('urgent')) priorityField.value = 1;
  else if (lowered.includes('p2') || lowered.includes('important')) priorityField.value = 2;
  else if (lowered.includes('p3')) priorityField.value = 3;

  const minutesMatch = raw.match(/(\d{1,3})\s?m(?:in)?/i);
  if (minutesMatch) durationField.value = Number(minutesMatch[1]);

  const today = dateToInputValue(new Date());
  const tomorrow = dateToInputValue(addDays(new Date(), 1));
  if (lowered.includes('demain')) dueDateField.value = tomorrow;
  else if (lowered.includes("aujourd'hui") || lowered.includes('today')) dueDateField.value = today;

  if (lowered.includes('deep work') || lowered.includes('focus')) deepWorkField.checked = true;
}

function render() {
  const now = new Date();
  const today = dateToInputValue(now);

  const visible = tasks
    .filter((task) => matchesSearch(task, searchField.value))
    .filter((task) => matchesStatus(task, filterStatus.value, today, now))
    .filter((task) => matchesPriority(task, filterPriority.value))
    .sort((a, b) => compareTasks(a, b, sortBy.value, now));

  list.innerHTML = '';

  if (!visible.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'Aucune tâche dans ce filtre. Respire... puis ajoute la prochaine action utile.';
    list.appendChild(empty);
  }

  visible.forEach((task) => {
    const node = template.content.firstElementChild.cloneNode(true);
    const checkbox = node.querySelector('.task-check');
    const title = node.querySelector('.task-title');
    const badge = node.querySelector('.task-badge');
    const meta = node.querySelector('.task-meta');
    const tagsLine = node.querySelector('.tag-line');
    const deleteBtn = node.querySelector('.delete-btn');

    checkbox.checked = task.done;
    title.textContent = task.title;
    badge.textContent = task.deepWork ? 'Deep Work' : priorityLabel(task.priority);

    const dueText = task.dueAt ? formatDue(task.dueAt, now) : 'Sans échéance';
    const projectText = task.project ? `Projet: ${task.project}` : 'Projet libre';
    meta.textContent = `${projectText} • ${dueText} • ${task.duration} min`;

    const computedTags = [...task.tags];
    if (task.recurringDaily) computedTags.push('quotidien');
    computedTags.forEach((tag) => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = `#${tag}`;
      tagsLine.appendChild(span);
    });

    if (task.done) node.classList.add('done');
    if (isOverdue(task, now)) node.classList.add('overdue');

    checkbox.addEventListener('change', () => {
      task.done = checkbox.checked;
      task.completedAt = task.done ? new Date().toISOString() : null;
      if (task.done && task.recurringDaily) {
        duplicateForNextDay(task);
      }
      saveState();
      render();
    });

    deleteBtn.addEventListener('click', () => {
      tasks = tasks.filter((item) => item.id !== task.id);
      saveState();
      render();
    });

    list.appendChild(node);
  });

  updateMetrics(now);
  smartSuggestion.textContent = createSuggestion(now);
}

function updateMetrics(now) {
  const active = tasks.filter((task) => !task.done).length;
  const overdue = tasks.filter((task) => isOverdue(task, now)).length;
  const doneToday = tasks.filter((task) => task.completedAt?.startsWith(dateToInputValue(now))).length;
  const weeklyFocus = focusHistory.filter((stamp) => {
    const diff = now.getTime() - new Date(stamp).getTime();
    return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  const completionRate = tasks.length ? Math.round((tasks.filter((task) => task.done).length / tasks.length) * 100) : 0;
  const focusScore = Math.min(100, Math.round(completionRate * 0.7 + weeklyFocus * 4));

  activeCount.textContent = String(active);
  doneTodayCount.textContent = String(doneToday);
  overdueCount.textContent = String(overdue);
  focusScoreLabel.textContent = `${focusScore}%`;
}

function createSuggestion(now) {
  const candidates = tasks.filter((task) => !task.done);
  if (!candidates.length) return 'Inbox vide: choisis un objectif ambitieux pour aujourd’hui.';

  const ranked = [...candidates].sort((a, b) => scoreTask(b, now) - scoreTask(a, now));
  const top = ranked[0];

  const urgency = isOverdue(top, now)
    ? 'en retard'
    : top.dueAt
      ? `échéance ${formatDue(top.dueAt, now)}`
      : 'sans échéance';

  return `🎯 Fais maintenant: "${top.title}" (${priorityLabel(top.priority)}, ${urgency}, ${top.duration} min).`;
}

function scoreTask(task, now) {
  let score = 0;
  score += (5 - task.priority) * 25;
  if (task.deepWork) score += 18;
  if (task.dueAt) {
    const due = new Date(task.dueAt);
    const hours = (due.getTime() - now.getTime()) / 36e5;
    if (hours <= 0) score += 60;
    else if (hours <= 24) score += 35;
    else if (hours <= 72) score += 12;
  }
  if (task.duration <= 30) score += 8;
  return score;
}

function compareTasks(a, b, criterion, now) {
  if (criterion === 'due') {
    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
    return aDue - bDue;
  }

  if (criterion === 'priority') return a.priority - b.priority;

  if (criterion === 'created') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

  return scoreTask(b, now) - scoreTask(a, now);
}

function duplicateForNextDay(task) {
  const baseDate = task.dueAt ? new Date(task.dueAt) : new Date();
  const nextDue = addDays(baseDate, 1);

  tasks.push({
    ...task,
    id: crypto.randomUUID(),
    done: false,
    completedAt: null,
    dueAt: nextDue.toISOString(),
    createdAt: new Date().toISOString(),
  });
}

function matchesSearch(task, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [task.title, task.project, task.tags.join(' ')].join(' ').toLowerCase();
  return haystack.includes(q);
}

function matchesPriority(task, priority) {
  return priority === 'all' || task.priority === Number(priority);
}

function matchesStatus(task, status, today, now) {
  if (status === 'all') return true;
  if (status === 'active') return !task.done;
  if (status === 'done') return task.done;
  if (status === 'today') return task.dueAt?.startsWith(today);
  if (status === 'overdue') return isOverdue(task, now);
  return true;
}

function isOverdue(task, now) {
  return Boolean(task.dueAt && !task.done && new Date(task.dueAt).getTime() < now.getTime());
}

function priorityLabel(priority) {
  return `P${priority}`;
}

function composeDateTime(date, time) {
  if (!date) return null;
  if (!time) return new Date(`${date}T23:59:59`).toISOString();
  return new Date(`${date}T${time}:00`).toISOString();
}

function formatDue(iso, now) {
  const due = new Date(iso);
  const day = dateToInputValue(due);
  const today = dateToInputValue(now);
  const tomorrow = dateToInputValue(addDays(now, 1));

  const time = due.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (day === today) return `Aujourd'hui ${time}`;
  if (day === tomorrow) return `Demain ${time}`;
  return due.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function parseTags(raw) {
  return raw
    .split(',')
    .map((tag) => tag.trim().replace(/^#/, ''))
    .filter(Boolean)
    .slice(0, 8);
}

function loadJSON(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function addDays(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function dateToInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startClock() {
  const tick = () => {
    const now = new Date();
    clockTime.textContent = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    clockDate.textContent = now.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: '2-digit',
      month: 'long',
    });
  };

  tick();
  setInterval(tick, 1000 * 20);
}
