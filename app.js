const storageKey = 'sportflow-workouts';
const weeklyGoal = 150;

const form = document.getElementById('workout-form');
const sportField = document.getElementById('sport');
const durationField = document.getElementById('duration');
const intensityField = document.getElementById('intensity');
const intensityValue = document.getElementById('intensity-value');
const list = document.getElementById('workout-list');
const template = document.getElementById('workout-item-template');
const sessionsCount = document.getElementById('sessions-count');
const minutesCount = document.getElementById('minutes-count');
const goalStatus = document.getElementById('goal-status');
const clearBtn = document.getElementById('clear-btn');

let workouts = loadWorkouts();

intensityField.addEventListener('input', () => {
  intensityValue.textContent = `${intensityField.value}/10`;
});

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const newWorkout = {
    id: crypto.randomUUID(),
    sport: sportField.value,
    duration: Number(durationField.value),
    intensity: Number(intensityField.value),
    createdAt: new Date().toISOString(),
  };

  workouts.push(newWorkout);
  persist();
  render();
  form.reset();
  intensityField.value = 5;
  intensityValue.textContent = '5/10';
  sportField.focus();
});

clearBtn.addEventListener('click', () => {
  workouts = [];
  persist();
  render();
});

function loadWorkouts() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) ?? [];
  } catch {
    return [];
  }
}

function persist() {
  localStorage.setItem(storageKey, JSON.stringify(workouts));
}

function removeWorkout(id) {
  workouts = workouts.filter((workout) => workout.id !== id);
  persist();
  render();
}

function render() {
  list.innerHTML = '';

  workouts
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .forEach((workout) => {
      const element = template.content.firstElementChild.cloneNode(true);

      element.querySelector('.sport-name').textContent = workout.sport;
      element.querySelector('.details').textContent = `${workout.duration} min • Intensité ${workout.intensity}/10`;
      element.querySelector('.delete-btn').addEventListener('click', () => removeWorkout(workout.id));

      list.appendChild(element);
    });

  const totalMinutes = workouts.reduce((sum, workout) => sum + workout.duration, 0);

  sessionsCount.textContent = String(workouts.length);
  minutesCount.textContent = String(totalMinutes);
  goalStatus.textContent = totalMinutes >= weeklyGoal ? 'Oui ✅' : `Non (objectif: ${weeklyGoal} min)`;
}

render();
