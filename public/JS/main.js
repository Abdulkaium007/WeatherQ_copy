document.addEventListener("DOMContentLoaded", () => {
  // === PAGE DETECTION ===
  const isAddPage = window.location.pathname === "/add";

  // === DOM ELEMENTS ===
  const slider = document.getElementById("weatherSlider");
  const dotsContainer = document.getElementById("tabDots");
  const cityInput = document.getElementById("cityInput");
  const searchBtn = document.getElementById("searchBtn");
  const tempToggle = document.getElementById("tempToggle");
  const themeToggle = document.getElementById("themeToggle");
  const cityList = document.getElementById("cityList");

  // === STATE ===
  let weatherData = [];
  let isCelsius = localStorage.getItem("tempUnit") !== "F"; // true = °C
  let isDark = localStorage.getItem("darkMode") === "true";

  // === SAVED CITIES (max 4) ===
  const savedCities = JSON.parse(localStorage.getItem("weatherq_cities")) || [];

  // === APPLY THEME ON LOAD ===
  document.body.classList.toggle("dark", isDark);
  if (themeToggle) {
    themeToggle.innerHTML = isDark
      ? '<i class="fas fa-sun"></i>'
      : '<i class="fas fa-moon"></i>';
  }
  if (tempToggle) tempToggle.textContent = isCelsius ? "°C" : "°F";

  // === TOGGLE DARK MODE ===
  themeToggle?.addEventListener("click", () => {
    isDark = !isDark;
    localStorage.setItem("darkMode", isDark);
    document.body.classList.toggle("dark", isDark);
    themeToggle.innerHTML = isDark
      ? '<i class="fas fa-sun"></i>'
      : '<i class="fas fa-moon"></i>';
  });

  // === TOGGLE °C / °F ===
  tempToggle?.addEventListener("click", () => {
    isCelsius = !isCelsius;
    localStorage.setItem("tempUnit", isCelsius ? "C" : "F");
    tempToggle.textContent = isCelsius ? "°C" : "°F";
    renderAll(); // Refresh all temps
  });

  // === FETCH WEATHER FROM SERVER ===
  async function fetchWeather(lat, lon, isUser = false, city = null) {
    const url = city
      ? `/weather?city=${encodeURIComponent(city)}`
      : `/weather?lat=${lat}&lon=${lon}&user=${isUser}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Remove duplicate city
      weatherData = weatherData.filter(d => d.city !== data.city);

      // Add to front if current location
      isUser ? weatherData.unshift(data) : weatherData.push(data);

      // Save city (max 4 saved)
      if (city && !savedCities.includes(city)) {
        savedCities.push(city);
        localStorage.setItem("weatherq_cities", JSON.stringify(savedCities.slice(0, 4)));
      }

      weatherData = weatherData.slice(0, 5); // Max 5 cards
      renderAll();
    } catch (err) {
      alert(err.message);
    }
  }

  // === LOAD SAVED CITIES ===
  function loadSavedCities() {
    savedCities.forEach(city => {
      if (!weatherData.find(d => d.city === city)) {
        fetchWeather(null, null, false, city);
      }
    });
  }

  // === LOAD CURRENT LOCATION + SAVED ===
  function loadAllCities() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => fetchWeather(pos.coords.latitude, pos.coords.longitude, true),
        () => console.log("Location denied")
      );
    }
    loadSavedCities();
  }

  // === RENDER MAIN OR ADD PAGE ===
  function renderAll() {
    isAddPage ? renderCityList() : renderSlider();
  }

  // === RENDER SLIDER (MAIN PAGE) ===
  function renderSlider() {
    if (!slider) return;
    slider.innerHTML = "";
    dotsContainer.innerHTML = "";

    weatherData.forEach((w, i) => {
      // Card
      const card = document.createElement("div");
      card.className = "weather-card";
      if (i === 0) card.classList.add("active");
      card.innerHTML = renderWeatherCard(w, i === 0);
      slider.appendChild(card);

      // Dot
      const dot = document.createElement("span");
      dot.className = "dot";
      if (i === 0) dot.classList.add("active", "location-dot");
      dot.onclick = () => setActiveCard(i);
      dotsContainer.appendChild(dot);
    });
  }

  // === RENDER CITY LIST (ADD PAGE) ===
  function renderCityList() {
    if (!cityList) return;

    cityList.innerHTML = weatherData.map((w, i) => `
      <div class="city-card">
        <h4>${w.city}, ${w.country}</h4>
        ${getProIcon(w.current.description, w.current.isNight)}
        <p>${formatTemp(w.current.temp)}</p>
        ${i !== 0 ? `<button class="remove-btn" data-city="${w.city}">X</button>` : ''}
      </div>
    `).join("") || "<p>No cities added yet.</p>";

    // Remove button
    document.querySelectorAll(".remove-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const city = btn.dataset.city;
        weatherData = weatherData.filter(d => d.city !== city);
        const idx = savedCities.indexOf(city);
        if (idx > -1) savedCities.splice(idx, 1);
        localStorage.setItem("weatherq_cities", JSON.stringify(savedCities));
        renderCityList();
      });
    });
  }

  // === RENDER SINGLE WEATHER CARD ===
  function renderWeatherCard(w, isCurrentLocation) {
    const temp = formatTemp(w.current.temp);
    const feels = formatTemp(w.current.feels_like);

    const forecastHTML = w.forecast.map(f => `
      <div class="forecast-card">
        <div class="day">${new Date(f.date).toLocaleDateString('en', { weekday: 'short' })}</div>
        ${getProIcon(f.description, f.isNight)}
        <div>${formatTemp(f.temp)}</div>
        <div class="desc">${f.description}</div>
      </div>
    `).join("");

    return `
      <h3>${w.city}, ${w.country} ${isCurrentLocation ? '<i class="fas fa-map-marker-alt"></i>' : ''}</h3>
      ${getProIcon(w.current.description, w.current.isNight)}
      <div class="temp">${temp}</div>
      <div class="description">${w.current.description}</div>
      <div class="details">
        <span>Feels ${feels}</span>
        <span>Humidity ${w.current.humidity}%</span>
        <span>Wind ${w.current.wind_speed} m/s</span>
      </div>
      <div class="forecast-container">${forecastHTML}</div>
    `;
  }

  // === FORMAT TEMPERATURE ===
  function formatTemp(temp) {
    const t = isCelsius ? temp.toFixed(1) : ((temp * 9 / 5) + 32).toFixed(1);
    return `${t}°${isCelsius ? 'C' : 'F'}`;
  }

  // === PROFESSIONAL SVG ICONS (Apple-style) ===
  function getProIcon(description, isNight = false) {
    const desc = description.toLowerCase();

    const iconMap = {
      "clear sky": "clear",
      "few clouds": "few clouds",
      "scattered clouds": "scattered clouds",
      "broken clouds": "overcast clouds",
      "overcast clouds": "overcast clouds",
      "light rain": "light rain",
      "moderate rain": "rain",
      "heavy intensity rain": "rain",
      "thunderstorm": "thunderstorm",
      "snow": "snow",
      "mist": "clouds",
      "fog": "clouds",
      "haze": "clouds"
    };

    let key = iconMap[desc] || (desc.includes("cloud") ? "clouds" : "clear");
    if (isNight && key === "clear") key = "clear-night";

    const icons = {
      clear: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="16" fill="#FFD700"/><circle cx="32" cy="32" r="10" fill="#FFF9C4"/><g fill="#FFB300"><circle cx="32" cy="12" r="5"/><circle cx="32" cy="52" r="5"/><circle cx="12" cy="32" r="5"/><circle cx="52" cy="32" r="5"/><circle cx="20" cy="20" r="5"/><circle cx="44" cy="44" r="5"/><circle cx="20" cy="44" r="5"/><circle cx="44" cy="20" r="5"/></g></svg>`,

      "few clouds": `<svg viewBox="0 0 64 64"><circle cx="42" cy="28" r="12" fill="#FFD700"/><path d="M10 36 Q20 28, 30 36 T50 36 Q45 44, 35 42 Q25 44, 15 40 Z" fill="#E0E0E0"/><path d="M14 42 Q22 38, 30 42 T46 42 Q42 48, 34 47 Q26 48, 18 44 Z" fill="#B0BEC5"/></svg>`,

      "scattered clouds": `<svg viewBox="0 0 64 64"><path d="M15 32 Q22 26, 30 32 T46 32 Q42 38, 34 37 Q26 38, 18 34 Z" fill="#B0BEC5"/><path d="M20 40 Q26 36, 32 40 T44 40 Q40 45, 34 44 Q28 45, 22 42 Z" fill="#90A4AE"/></svg>`,

      "overcast clouds": `<svg viewBox="0 0 64 64"><path d="M10 36 Q25 24, 40 36 T54 36 Q50 46, 38 44 Q26 46, 14 42 Z" fill="#78909C"/></svg>`,

      "light rain": `<svg viewBox="0 0 64 64"><path d="M15 32 Q23 26, 32 32 T48 32 Q44 38, 36 37 Q28 38, 20 34 Z" fill="#90A4AE"/><path d="M22 42 L21 48 M32 42 L31 48 M42 42 L41 48" stroke="#2979FF" stroke-width="2.5" fill="none"/></svg>`,

      rain: `<svg viewBox="0 0 64 64"><path d="M15 32 Q23 26, 32 32 T48 32 Q44 38, 36 37 Q28 38, 20 34 Z" fill="#90A4AE"/><path d="M18 42 L16 52 M26 42 L24 52 M34 42 L32 52 M42 42 L40 52" stroke="#2979FF" stroke-width="3" fill="none"/></svg>`,

      thunderstorm: `<svg viewBox="0 0 64 64"><path d="M14 34 Q22 28, 30 34 T46 34 Q42 40, 34 39 Q26 40, 18 36 Z" fill="#546E7A"/><path d="M24 40 L28 48 L26 48 L30 56 M36 42 L40 50 L38 50 L42 58" stroke="#FFD700" stroke-width="3" fill="none"/></svg>`,

      snow: `<svg viewBox="0 0 64 64"><path d="M15 32 Q23 26, 32 32 T48 32 Q44 38, 36 37 Q28 38, 20 34 Z" fill="#B0BEC5"/><circle cx="20" cy="42" r="3" fill="white"/><circle cx="32" cy="42" r="3" fill="white"/><circle cx="44" cy="42" r="3" fill="white"/><circle cx="26" cy="48" r="2.5" fill="white"/><circle cx="38" cy="48" r="2.5" fill="white"/></svg>`,

      "clear-night": `<svg viewBox="0 0 64 64"><circle cx="20" cy="20" r="12" fill="#F0F4F8"/><path d="M20 8 Q24 12, 28 12 Q28 16, 24 20 Q20 24, 16 20 Q12 16, 12 12 Q16 8, 20 8" fill="#BBDEFB"/><circle cx="44" cy="16" r="3" fill="#E3F2FD"/><circle cx="10" cy="28" r="2" fill="#E3F2FD"/><circle cx="36" cy="36" r="2.5" fill="#E3F2FD"/></svg>`,

      clouds: `<svg viewBox="0 0 64 64"><path d="M12 38 Q22 30, 32 38 T52 38 Q48 46, 38 44 Q28 46, 18 42 Z" fill="#78909C"/></svg>`
    };

    return `<div class="pro-icon">${icons[key] || icons.clear}</div>`;
  }

  // === SWITCH ACTIVE CARD ===
  function setActiveCard(index) {
    document.querySelectorAll(".weather-card").forEach((card, i) => {
      card.classList.toggle("active", i === index);
    });
    document.querySelectorAll(".dot").forEach((dot, i) => {
      dot.classList.toggle("active", i === index);
    });
  }

  // === SEARCH CITY (ADD PAGE) ===
  function addCityFromSearch() {
    const city = cityInput.value.trim();
    if (!city) return;
    fetchWeather(null, null, false, city);
    cityInput.value = "";
  }

  // === SEARCH ON ENTER OR CLICK ===
  if (isAddPage) {
    searchBtn?.addEventListener("click", addCityFromSearch);
    cityInput?.addEventListener("keypress", e => e.key === "Enter" && addCityFromSearch());
    loadAllCities();
  } else {
    // Main page: load location + saved
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => fetchWeather(pos.coords.latitude, pos.coords.longitude, true),
        () => showError("Location access denied")
      );
    }
    loadSavedCities();
  }

  function showError(msg) {
    if (slider) {
      slider.innerHTML = `<div class="weather-card active"><p>${msg}</p></div>`;
    }
  }

  // === START LOADING (only on main page) ===
  if (!isAddPage) loadSavedCities();
});