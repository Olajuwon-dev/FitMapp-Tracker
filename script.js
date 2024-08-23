'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${months[this.date.getMonth()]} ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const inputRoute = document.querySelector('.form__input--route');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #startCoords;
  #endCoords;
  #polyline;

  constructor() {
    this._getPosition();
    this._getLocalStorage();
    
    form.addEventListener('submit', this._newWorkout.bind(this));
    containerWorkouts.addEventListener('click', this._deleteWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField.bind(this));
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));

    // Moved setupSearch to loadMap to ensure map is loaded
  }

  _setupSearch() {
    L.Control.geocoder().addTo(this.#map);
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    this.#map.on('click', this._handleMapClick.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });

    // Initialize search after map is created
    this._setupSearch();
  }

  _handleMapClick(mapE) {
    if (!this.#startCoords) {
      this.#startCoords = mapE.latlng;
      L.marker(this.#startCoords).addTo(this.#map)
        .bindPopup('Start Point').openPopup();
    } else if (!this.#endCoords) {
      this.#endCoords = mapE.latlng;
      L.marker(this.#endCoords).addTo(this.#map)
        .bindPopup('End Point').openPopup();
      
      this._drawPolyline();
    } else {
      alert('Both points are already set.');
    }
  }

  _drawPolyline() {
    if (this.#polyline) {
      this.#map.removeLayer(this.#polyline);
    }
    const color = inputType.value === 'running' ? 'green' : 'orange';
    this.#polyline = L.polyline([this.#startCoords, this.#endCoords], { color: color }).addTo(this.#map);

    const distance = this.#map.distance(this.#startCoords, this.#endCoords) / 1000;
    inputDistance.value = distance.toFixed(2);
    inputRoute.value = `From (${this.#startCoords.lat.toFixed(3)}, ${this.#startCoords.lng.toFixed(3)}) to (${this.#endCoords.lat.toFixed(3)}, ${this.#endCoords.lng.toFixed(3)})`;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _toggleElevationField() {
    const isCycling = inputType.value === 'cycling';

    inputElevation.closest('.form__row').classList.toggle('form__row--hidden', !isCycling);
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden', isCycling);
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#startCoords;
    let workout;

    if (type === 'running') {
      const cadence = +inputCadence.value;

      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    this.#workouts.push(workout);
    this._renderWorkoutMarker(workout);
    this._renderWorkout(workout);
    this._hideForm();
    this._setLocalStorage();
  }

  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
  }

  _deleteWorkout(e) {
    if (!e.target.closest('.workout__delete')) return;

    const workoutEl = e.target.closest('.workout');
    const workoutId = workoutEl.dataset.id;

    this.#workouts = this.#workouts.filter(work => work.id !== workoutId);

    this._setLocalStorage();
    this._getLocalStorage();

    workoutEl.remove();

    this.#map.eachLayer(layer => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        this.#map.removeLayer(layer);
      }
    });

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _clearAllWorkouts() {
    if (!confirm('Are you sure you want to clear all workouts?')) return;

    this.#workouts = [];
    this._setLocalStorage();
    this._getLocalStorage();

    containerWorkouts.innerHTML = '';

    this.#map.eachLayer(layer => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        this.#map.removeLayer(layer);
      }
    });
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === 'running')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
        <button class="workout__delete">❌ Delete</button>
      </li>
      `;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
        <button class="workout__delete">❌ Delete</button>
      </li>
      `;
        form.insertAdjacentHTML('afterend', html);
  }

  _hideForm() {
    inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value = '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _moveToPopup(e) {
    if (!this.#map) return;

    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    if (!workout || !workout.coords) return;

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

// Make sure this line is not inside any function so that 'app' is globally accessible
const app = new App();
