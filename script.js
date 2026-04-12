const REST_COUNTRIES_URL =
  "https://restcountries.com/v3.1/all?fields=name,capital,region,subregion,population,languages,flags,latlng,cca3";

const UNSPLASH_ACCESS_KEY = ""; // add if you want images
const THEME_STORAGE_KEY = "travel-theme";

const searchInput = document.getElementById("searchInput");
const regionFilter = document.getElementById("regionFilter");
const climateFilter = document.getElementById("climateFilter");
const budgetFilter = document.getElementById("budgetFilter");
const sortSelect = document.getElementById("sortSelect");
const randomBtn = document.getElementById("randomBtn");
const themeToggle = document.getElementById("themeToggle");
const resultsCount = document.getElementById("resultsCount");
const feedback = document.getElementById("feedback");
const destinationsGrid = document.getElementById("destinationsGrid");
const cardTemplate = document.getElementById("destinationCardTemplate");

const state = {
  destinations: [],
  filteredDestinations: [],
  imageCache: new Map(),
  theme: loadTheme(),
};



initialize();

/// ---------------- INIT ----------------
// Initialize app: apply theme, attach events, fetch data
async function initialize() {
  applyTheme(state.theme);
  attachEvents();

  try {
    state.destinations = await fetchDestinations();
    applyFiltersAndRender();
  } catch (e) {
    // Show error if API fails
    setFeedback("Error loading data", true);
  }
}

// ---------------- EVENTS ----------------
// Attach all event listeners (filters, buttons, theme toggle)
function attachEvents() {
  [searchInput, regionFilter, climateFilter, budgetFilter, sortSelect].forEach(el => {
    el.addEventListener("input", applyFiltersAndRender);
    el.addEventListener("change", applyFiltersAndRender);
  });

  randomBtn.addEventListener("click", showRandomDestination);
  themeToggle.addEventListener("click", toggleTheme);
}

// ---------------- FETCH ----------------
// Fetch country data from REST Countries API
async function fetchDestinations() {
  const res = await fetch(REST_COUNTRIES_URL);
  const data = await res.json();

  // Filter valid countries and enrich them
  return data
    .filter(c => c.name && c.region)
    .map(enrichCountry);
}

// ---------------- ENRICH ----------------
// Convert raw API data into structured destination object
function enrichCountry(c) {
  const lat = c.latlng?.[0] || 0;
  const language = Object.values(c.languages || {})[0] || "Unknown";

  const climate = inferClimate(lat, c.subregion);
  const affordability = inferAffordability(c.region, c.population);

  return {
    id: c.cca3,
    name: c.name.common,
    capital: c.capital?.[0] || "N/A",
    region: c.region,
    subregion: c.subregion || "N/A",
    population: c.population || 0,
    climate,
    affordability,
    affordabilityRank: affordabilityToRank(affordability),
    language,
    image: buildFallbackImage(c),
    description: createDescription(c, climate, affordability, language),
  };
}

// ---------------- LOGIC ----------------
// Determine climate based on latitude and region
function inferClimate(lat = 0, subregion = "") {
  const abs = Math.abs(lat);

  if (abs < 15) return "Tropical";
  if (abs > 50) return "Cold";
  if (/europe/i.test(subregion)) return "Mediterranean";

  return "Temperate";
}

// Estimate affordability category
function inferAffordability(region, population = 0) {
  if (region === "Africa") return "Budget-friendly";
  if (region === "Europe" || region === "North America") return "Premium";
  if (population > 100000000) return "Budget-friendly";

  return "Mid-range";
}

// Convert affordability label into numeric rank (for sorting)
function affordabilityToRank(label) {
  return {
    "Budget-friendly": 1,
    "Mid-range": 2,
    "Premium": 3,
  }[label] || 2;
}

// Create a short description for UI
function createDescription(c, climate, affordability, lang) {
  return `${c.name.common} offers a ${climate.toLowerCase()} experience with ${affordability.toLowerCase()} travel and ${lang} culture.`;
}

// Provide fallback image (flag or placeholder)
function buildFallbackImage(c) {
  return c.flags?.svg || "https://placehold.co/600x400";
}

// ---------------- IMAGES ----------------
// Preload images for a list of destinations
async function preloadImages(list) {
  for (let d of list) {
    d.image = await getDestinationImage(d);
  }
}

// Fetch image from Unsplash or return cached/fallback
async function getDestinationImage(d) {
  if (state.imageCache.has(d.id)) return state.imageCache.get(d.id);

  if (!UNSPLASH_ACCESS_KEY) return d.image;

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${d.name}&client_id=${UNSPLASH_ACCESS_KEY}`
    );
    const data = await res.json();

    const url = data.results?.[0]?.urls?.regular || d.image;
    state.imageCache.set(d.id, url);
    return url;
  } catch {
    return d.image;
  }
}

// Replace image later with better one (lazy loading)
async function lazilyEnhanceImage(d, img) {
  img.src = await getDestinationImage(d);
}

// ---------------- FILTER ----------------
// Apply all filters and sorting, then render
function applyFiltersAndRender() {
  const search = searchInput.value.toLowerCase();
  const region = regionFilter.value;
  const climate = climateFilter.value;
  const budget = budgetFilter.value;

  state.filteredDestinations = state.destinations
    .filter(d => d.name.toLowerCase().includes(search))
    .filter(d => region === "all" || d.region === region)
    .filter(d => climate === "all" || d.climate === climate)
    .filter(d => budget === "all" || d.affordability === budget)
    .sort((a, b) => sortDestinations(a, b, sortSelect.value));

  renderDestinations(state.filteredDestinations);
  updateCounts();
}

// ---------------- SORT ----------------
// Sort destinations based on selected option
function sortDestinations(a, b, mode) {
  switch (mode) {
    case "population-desc":
      return b.population - a.population;
    case "population-asc":
      return a.population - b.population;
    case "affordability":
      return a.affordabilityRank - b.affordabilityRank;
    default:
      return a.name.localeCompare(b.name);
  }
}

// ---------------- RENDER ----------------
// Render all destination cards
function renderDestinations(list) {
  destinationsGrid.innerHTML = "";

  if (!list.length) {
    destinationsGrid.innerHTML = "No results";
    return;
  }

  list.forEach(d => destinationsGrid.appendChild(buildCard(d)));
}

// Create a single destination card
function buildCard(d) {
  const node = cardTemplate.content.firstElementChild.cloneNode(true);

  // Fill text data
  node.querySelector(".country-name").textContent = d.name;
  node.querySelector(".country-region").textContent = `${d.region} • ${d.subregion}`;
  node.querySelector(".country-climate").textContent = d.climate;
  node.querySelector(".country-budget").textContent = d.affordability;
  node.querySelector(".country-language").textContent = d.language;
  node.querySelector(".country-capital").textContent = d.capital;
  node.querySelector(".country-population").textContent = formatPopulation(d.population);
  node.querySelector(".country-description").textContent = d.description;

  // Handle image
  const img = node.querySelector("img");
  img.src = d.image;

  // Improve image after render
  lazilyEnhanceImage(d, img);

  return node;
}

// ---------------- THEME ----------------
// Toggle between dark and light mode
function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme(state.theme);
  localStorage.setItem(THEME_STORAGE_KEY, state.theme);
}

// Apply theme to document
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggle.textContent = theme === "dark" ? "Light" : "Dark";
}

// Load theme from localStorage (default light)
function loadTheme() {
  return localStorage.getItem(THEME_STORAGE_KEY) || "light";
}

// ---------------- RANDOM ----------------
// Show a random destination
function showRandomDestination() {
  if (!state.filteredDestinations.length) return;

  const d =
    state.filteredDestinations[Math.floor(Math.random() * state.filteredDestinations.length)];

  alert(`Try visiting: ${d.name}`);
}

// ---------------- UI ----------------
// Update result count text
function updateCounts() {
  resultsCount.textContent = `${state.filteredDestinations.length} destinations`;
}

// Show feedback message
function setFeedback(msg, isError = false) {
  feedback.textContent = msg;
  feedback.style.color = isError ? "red" : "black";
}

// Format population with commas
function formatPopulation(n) {
  return n.toLocaleString();
}