import axios from "axios";

const apiKey = "28862fec9eb0026a9d730c78d4768f0e";
const city = "Dhaka";

(async () => {
  try {
    const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${apiKey}`;
    const geoRes = await axios.get(geoUrl);
    console.log("GEO:", geoRes.data);

    const { lat, lon } = geoRes.data[0];

    const weathUrl = `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly,alerts&units=metric&appid=${apiKey}`;
    const weathRes = await axios.get(weathUrl);
    console.log("WEATHER:", weathRes.data.current);

  } catch (err) {
    console.log("Error:", err.response?.data || err.message);
  }
})();
