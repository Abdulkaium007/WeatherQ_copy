// index.js
import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.WEATHER_API_KEY;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// === CLIENT SCRIPT (inline) ===
const clientScript = `
  <script>
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
    const loader = document.getElementById("loader");
    const refreshHint = document.getElementById("refreshHint");

    // === STATE ===
    let weatherData = [];
    let isCelsius = localStorage.getItem("tempUnit") !== "F";
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

    // === SHOW/HIDE LOADER ===
    function showLoader() { if (loader) loader.style.display = "block"; }
    function hideLoader() { if (loader) loader.style.display = "none"; }

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
      renderAll();
    });

    // === FETCH WEATHER ===
    async function fetchWeather(lat, lon, isUser = false, city = null) {
      showLoader();
      const url = city
        ? \`/weather?city=\${encodeURIComponent(city)}\`
        : \`/weather?lat=\${lat}&lon=\${lon}\`;

      try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        weatherData = weatherData.filter(d => d.city !== data.city);
        isUser ? weatherData.unshift(data) : weatherData.push(data);

        if (city && !savedCities.includes(city)) {
          savedCities.push(city);
          localStorage.setItem("weatherq_cities", JSON.stringify(savedCities.slice(0, 4)));
        }

        weatherData = weatherData.slice(0, 5);
        renderAll();
      } catch (err) {
        alert(err.message);
      } finally {
        hideLoader();
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

    // === RENDER ALL ===
    function renderAll() {
      isAddPage ? renderCityList() : renderSlider();
    }

    // === RENDER SLIDER (PRESERVES ACTIVE CARD) ===
    function renderSlider() {
      if (!slider) return;

      // Save current active index
      const activeCard = document.querySelector(".weather-card.active");
      const currentIndex = activeCard ? Array.from(slider.children).indexOf(activeCard) : 0;

      slider.innerHTML = "";
      dotsContainer.innerHTML = "";

      weatherData.forEach((w, i) => {
        const card = document.createElement("div");
        card.className = "weather-card";
        if (i === currentIndex) card.classList.add("active");
        card.innerHTML = renderWeatherCard(w, i === 0);
        slider.appendChild(card);

        const dot = document.createElement("span");
        dot.className = "dot";
        if (i === currentIndex) dot.classList.add("active");
        if (i === 0) dot.classList.add("location-dot");
        dot.onclick = () => setActiveCard(i);
        dotsContainer.appendChild(dot);
      });

      setActiveCard(currentIndex);
    }

    // === RENDER CITY LIST ===
    function renderCityList() {
      if (!cityList) return;
      cityList.innerHTML = weatherData.map((w, i) => \`
        <div class="city-card">
          <h4>\${w.city}, \${w.country}</h4>
          \${getProIcon(w.current.description, w.current.isNight)}
          <p>\${formatTemp(w.current.temp)}</p>
          \${i !== 0 ? \`<button class="remove-btn" data-city="\${w.city}">X</button>\` : ''}
        </div>
      \`).join("") || "<p>No cities added yet.</p>";

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

    // === RENDER SINGLE CARD ===
    function renderWeatherCard(w, isCurrentLocation) {
      const temp = formatTemp(w.current.temp);
      const feels = formatTemp(w.current.feels_like);
      const forecastHTML = w.forecast.map(f => \`
        <div class="forecast-card">
          <div class="day">\${f.date}</div>
          \${getProIcon(f.description, f.isNight)}
          <div>\${formatTemp(f.temp)}</div>
          <div class="desc">\${f.description}</div>
        </div>
      \`).join("");

      return \`
        <h3>\${w.city}, \${w.country} \${isCurrentLocation ? '<i class="fas fa-map-marker-alt"></i>' : ''}</h3>
        \${getProIcon(w.current.description, w.current.isNight)}
        <div class="temp">\${temp}</div>
        <div class="description">\${w.current.description}</div>
        <div class="details">
          <span>Feels \${feels}</span>
          <span>Humidity \${w.current.humidity}%</span>
          <span>Wind \${w.current.wind_speed} m/s</span>
        </div>
        <div class="forecast-container">\${forecastHTML}</div>
      \`;
    }

    // === FORMAT TEMP ===
    function formatTemp(temp) {
      const t = isCelsius ? temp.toFixed(1) : ((temp * 9 / 5) + 32).toFixed(1);
      return \`\${t}°\${isCelsius ? 'C' : 'F'}\`;
    }

    // === SVG ICONS ===
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
        clear: \`<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="16" fill="#FFD700"/><circle cx="32" cy="32" r="10" fill="#FFF9C4"/><g fill="#FFB300"><circle cx="32" cy="12" r="5"/><circle cx="32" cy="52" r="5"/><circle cx="12" cy="32" r="5"/><circle cx="52" cy="32" r="5"/><circle cx="20" cy="20" r="5"/><circle cx="44" cy="44" r="5"/><circle cx="20" cy="44" r="5"/><circle cx="44" cy="20" r="5"/></g></svg>\`,
        "few clouds": \`<svg viewBox="0 0 64 64"><circle cx="42" cy="28" r="12" fill="#FFD700"/><path d="M10 36 Q20 28, 30 36 T50 36 Q45 44, 35 42 Q25 44, 15 40 Z" fill="#E0E0E0"/><path d="M14 42 Q22 38, 30 42 T46 42 Q42 48, 34 47 Q26 48, 18 44 Z" fill="#B0BEC5"/></svg>\`,
        "scattered clouds": \`<svg viewBox="0 0 64 64"><path d="M15 32 Q22 26, 30 32 T46 32 Q42 38, 34 37 Q26 38, 18 34 Z" fill="#B0BEC5"/><path d="M20 40 Q26 36, 32 40 T44 40 Q40 45, 34 44 Q28 45, 22 42 Z" fill="#90A4AE"/></svg>\`,
        "overcast clouds": \`<svg viewBox="0 0 64 64"><path d="M10 36 Q25 24, 40 36 T54 36 Q50 46, 38 44 Q26 46, 14 42 Z" fill="#78909C"/></svg>\`,
        "light lluvia": \`<svg viewBox="0 0 64 64"><path d="M15 32 Q23 26, 32 32 T48 32 Q44 38, 36 37 Q28 38, 20 34 Z" fill="#90A4AE"/><path d="M22 42 L21 48 M32 42 L31 48 M42 42 L41 48" stroke="#2979FF" stroke-width="2.5" fill="none"/></svg>\`,
        rain: \`<svg viewBox="0 0 64 64"><path d="M15 32 Q23 26, 32 32 T48 32 Q44 38, 36 37 Q28 38, 20 34 Z" fill="#90A4AE"/><path d="M18 42 L16 52 M26 42 L24 52 M34 42 L32 52 M42 42 L40 52" stroke="#2979FF" stroke-width="3" fill="none"/></svg>\`,
        thunderstorm: \`<svg viewBox="0 0 64 64"><path d="M14 34 Q22 28, 30 34 T46 34 Q42 40, 34 39 Q26 40, 18 36 Z" fill="#546E7A"/><path d="M24 40 L28 48 L26 48 L30 56 M36 42 L40 50 L38 50 L42 58" stroke="#FFD700" stroke-width="3" fill="none"/></svg>\`,
        snow: \`<svg viewBox="0 0 64 64"><path d="M15 32 Q23 26, 32 32 T48 32 Q44 38, 36 37 Q28 38, 20 34 Z" fill="#B0BEC5"/><circle cx="20" cy="42" r="3" fill="white"/><circle cx="32" cy="42" r="3" fill="white"/><circle cx="44" cy="42" r="3" fill="white"/><circle cx="26" cy="48" r="2.5" fill="white"/><circle cx="38" cy="48" r="2.5" fill="white"/></svg>\`,
        "clear-night": \`<svg viewBox="0 0 64 64"><circle cx="20" cy="20" r="12" fill="#F0F4F8"/><path d="M20 8 Q24 12, 28 12 Q28 16, 24 20 Q20 24, 16 20 Q12 16, 12 12 Q16 8, 20 8" fill="#BBDEFB"/><circle cx="44" cy="16" r="3" fill="#E3F2FD"/><circle cx="10" cy="28" r="2" fill="#E3F2FD"/><circle cx="36" cy="36" r="2.5" fill="#E3F2FD"/></svg>\`,
        clouds: \`<svg viewBox="0 0 64 64"><path d="M12 38 Q22 30, 32 38 T52 38 Q48 46, 38 44 Q28 46, 18 42 Z" fill="#78909C"/></svg>\`
      };
      return \`<div class="pro-icon">\${icons[key] || icons.clear}</div>\`;
    }

    // === SWITCH ACTIVE CARD ===
    function setActiveCard(index) {
      document.querySelectorAll(".weather-card").forEach((c, i) => c.classList.toggle("active", i === index));
      document.querySelectorAll(".dot").forEach((d, i) => d.classList.toggle("active", i === index));
    }

    // === SEARCH CITY ===
    function addCityFromSearch() {
      const city = cityInput.value.trim();
      if (!city) return;
      fetchWeather(null, null, false, city);
      cityInput.value = "";
    }

    // === PULL TO REFRESH ===
    let startY = 0;
    document.addEventListener("touchstart", e => { startY = e.touches[0].clientY; }, { passive: true });
    document.addEventListener("touchmove", e => {
      if (window.scrollY !== 0) return;
      const diff = e.touches[0].clientY - startY;
      if (diff > 100 && refreshHint) refreshHint.style.opacity = "1";
    }, { passive: true });
    document.addEventListener("touchend", () => {
      if (refreshHint && refreshHint.style.opacity === "1") {
        refreshHint.style.opacity = "0";
        location.reload();
      }
    });

    if (refreshHint) refreshHint.addEventListener("click", () => location.reload());

    // === INITIAL LOAD ===
    if (isAddPage) {
      loadSavedCities();
      searchBtn?.addEventListener("click", addCityFromSearch);
      cityInput?.addEventListener("keypress", e => e.key === "Enter" && addCityFromSearch());
    } else {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => fetchWeather(pos.coords.latitude, pos.coords.longitude, true),
          () => { hideLoader(); alert("Location access denied"); }
        );
      } else {
        hideLoader();
      }
      loadSavedCities();
    }
  </script>
`;

// === MIDDLEWARE: Inject clientScript BEFORE routes ===
app.use((req, res, next) => {
  res.locals.clientScript = clientScript;
  next();
});

// === ROUTES ===
app.get("/", (req, res) => res.render("index"));
app.get("/add", (req, res) => res.render("add"));

// === WEATHER API ===
app.get("/weather", async (req, res) => {
  try {
    let { lat, lon, city } = req.query;
    if (city && (!lat || !lon)) {
      const geo = await axios.get(
        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`
      );
      if (!geo.data.length) return res.json({ error: "City not found" });
      lat = geo.data[0].lat; lon = geo.data[0].lon;
    }
    if (!lat || !lon) return res.json({ error: "Location required" });

    const weather = await axios.get(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
    );

    const data = weather.data;
    const now = new Date(data.list[0].dt * 1000);
    const isNight = now.getHours() >= 18 || now.getHours() < 6;

    const response = {
      city: data.city.name,
      country: data.city.country,
      current: {
        temp: data.list[0].main.temp,
        feels_like: data.list[0].main.feels_like,
        humidity: data.list[0].main.humidity,
        wind_speed: data.list[0].wind.speed,
        description: data.list[0].weather[0].description,
        icon: data.list[0].weather[0].icon,
        isNight,
      },
      forecast: [],
    };

    const seen = new Set();
    for (const item of data.list) {
      const dateObj = new Date(item.dt * 1000);
      const date = dateObj.toLocaleDateString("en", { weekday: "short" });
      const itemTime = dateObj.getHours();
      const itemNight = itemTime >= 18 || itemTime < 6;

      if (!seen.has(date) && response.forecast.length < 5) {
        response.forecast.push({
          date,
          temp: item.main.temp,
          icon: item.weather[0].icon,
          description: item.weather[0].description,
          isNight: itemNight,
        });
        seen.add(date);
      }
    }

    res.json(response);
  } catch (err) {
    console.error(err);
    res.json({ error: "Failed to fetch weather" });
  }
});

app.listen(PORT, () => console.log(`WeatherQ @ http://localhost:${PORT}`));