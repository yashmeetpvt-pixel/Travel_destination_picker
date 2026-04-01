let allCountries = [];

fetch("https://restcountries.com/v3.1/all?fields=name,flags,capital,region,subregion,population,area,languages,currencies,timezones")
  .then(res => res.json())
  .then(data => {
    allCountries = data;
    console.log("Countries loaded:", allCountries.length);
  })
  .catch(err => {
    document.getElementById("result").innerHTML = "Failed to load data. Check your internet connection.";
    console.error(err);
  });

document.getElementById("randomBtn").addEventListener("click", searchCountry);
document.getElementById("searchInput").addEventListener("keydown", function (e) {
  if (e.key === "Enter") searchCountry();
});

function searchCountry() {
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  const result = document.getElementById("result");

  if (!query) {
    result.innerHTML = "Please enter a country name.";
    return;
  }

  if (allCountries.length === 0) {
    result.innerHTML = "Data is still loading, please wait a moment.";
    return;
  }

  const c = allCountries.find(country =>
    country.name.common.toLowerCase().includes(query) ||
    country.name.official.toLowerCase().includes(query)
  );

  if (!c) {
    result.innerHTML = "Country not found. Try another name.";
    return;
  }

  const name       = c.name.common;
  const official   = c.name.official;
  const flag       = c.flags?.emoji || "";
  const capital    = (c.capital || ["N/A"])[0];
  const region     = c.region || "N/A";
  const subregion  = c.subregion || "N/A";
  const population = c.population.toLocaleString();
  const area       = c.area ? c.area.toLocaleString() + " km²" : "N/A";
  const languages  = c.languages ? Object.values(c.languages).join(", ") : "N/A";
  const currencies = c.currencies
    ? Object.values(c.currencies).map(cur => `${cur.name} (${cur.symbol || "?"})`).join(", ")
    : "N/A";
  const timezones  = (c.timezones || []).join(", ");

  result.innerHTML = `
    <div class="country-card">
      <h2>${flag} ${name}</h2>
      <p><span>Official Name</span>${official}</p>
      <p><span>Capital</span>${capital}</p>
      <p><span>Region</span>${region}</p>
      <p><span>Subregion</span>${subregion}</p>
      <p><span>Population</span>${population}</p>
      <p><span>Area</span>${area}</p>
      <p><span>Languages</span>${languages}</p>
      <p><span>Currencies</span>${currencies}</p>
      <p><span>Timezones</span>${timezones}</p>
    </div>
  `;
}