const REST_COUNTRIES_URL =
  "https://restcountries.com/v3.1/all?fields=name,capital,region,subregion,population,languages,flags,latlng,cca3";
const UNSPLASH_ACCESS_KEY = "c_3ay96_113gTZeRhAIoqroMLgVbaJPfisUYLfiGkWE";
const THEME_STORAGE_KEY = "travel-destination-picker:theme";

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

const climateOverrides = {
  ARE: "Arid",
  AUS: "Arid",
  BRA: "Tropical",
  CAN: "Cold",
  CHL: "Mediterranean",
  EGY: "Arid",
  ESP: "Mediterranean",
  GRC: "Mediterranean",
  IND: "Tropical",
  ISL: "Cold",
  ITA: "Mediterranean",
  JPN: "Temperate",
  KEN: "Tropical",
  MAR: "Mediterranean",
  MEX: "Temperate",
  NOR: "Cold",
  NZL: "Temperate",
  SAU: "Arid",
  THA: "Tropical",
  USA: "Temperate",
  ZAF: "Temperate",
};

initialize();

// Initialize app: apply theme, attach events, fetch data
async function initialize() {
  applyTheme(state.theme);
  attachEvents();
  try {
    const destinations = await fetchDestinations();
    state.destinations = destinations;
    applyFiltersAndRender();

   
  } catch (error) {
    console.error(error);

   
  }
}

// Attach all event listeners (filters, buttons, theme toggle)
function attachEvents() {
  [searchInput, regionFilter, climateFilter, budgetFilter, sortSelect].forEach((control) => {
    control.addEventListener("input", applyFiltersAndRender);
    control.addEventListener("change", applyFiltersAndRender);
  });

  randomBtn.addEventListener("click", showRandomDestination);
  themeToggle.addEventListener("click", toggleTheme);
}

// Fetch countries from API and prepare them
async function fetchDestinations() {
  const response = await fetch(REST_COUNTRIES_URL);
  if (!response.ok) {
    throw new Error(`REST Countries request failed with ${response.status}`);
  }

  const countries = await response.json();

  // Filter valid countries and enrich them
  const destinations = countries
    .filter((country) => country.region && country.name?.common)
    .map((country) => enrichCountry(country))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Preload some images
  await preloadImages(destinations.slice(0, 18));
  return destinations;
}

// Add computed fields (climate, affordability, etc.)
function enrichCountry(country) {
  const latitude = Array.isArray(country.latlng) ? country.latlng[0] : 0;
  const languages = Object.values(country.languages || {});
  const climate = climateOverrides[country.cca3] || inferClimate(latitude, country.subregion);
  const affordability = inferAffordability(country.region, country.subregion, country.population);

  return {
    id: country.cca3,
    name: country.name.common,
    capital: country.capital?.[0] || "Not listed",
    region: country.region,
    subregion: country.subregion || "Unknown",
    population: country.population || 0,
    climate,
    affordability,
    affordabilityRank: affordabilityToRank(affordability),
    language: languages[0] || "Local language",
    image: buildFallbackImage(country),
    description: createDescription(country, climate, affordability, languages[0]),
  };
}

// Infer climate using latitude and region
function inferClimate(latitude, subregion = "") {
  const absLat = Math.abs(latitude || 0);

  if (/southern europe|western europe|southern africa/i.test(subregion)) return "Mediterranean";
  if (/western asia|northern africa/i.test(subregion) || (absLat > 18 && absLat < 32)) return "Arid";
  if (absLat < 16) return "Tropical";
  if (absLat >= 50) return "Cold";

  return "Temperate";
}

// Estimate affordability category
function inferAffordability(region, subregion = "", population = 0) {
  if (/northern europe|australia and new zealand/i.test(subregion)) return "Premium";
  if (/africa|southern asia|south-eastern asia/i.test(`${region} ${subregion}`)) return "Budget-friendly";
  if (population > 100000000) return "Budget-friendly";
  if (/north america|western europe|eastern asia/i.test(`${region} ${subregion}`)) return "Premium";

  return "Mid-range";
}

// Convert affordability label to numeric rank for sorting
function affordabilityToRank(label) {
  const ranks = {
    "Budget-friendly": 1,
    "Mid-range": 2,
    Premium: 3,
  };

  return ranks[label] || 2;
}

// Generate description text
function createDescription(country, climate, affordability, language) {
  return `${country.name.common} offers a ${climate.toLowerCase()} travel vibe in ${
    country.subregion || country.region
  }, with ${affordability.toLowerCase()} appeal and ${language || "local"} culture to explore.`;
}

// Provide fallback image (flag or placeholder)
function buildFallbackImage(country) {
  if (country.flags?.svg) return country.flags.svg;

  return `https://placehold.co/800x600/e9ddcc/1e2b26?text=${encodeURIComponent(country.name.common)}`;
}

// Preload images for initial destinations
async function preloadImages(destinations) {
  await Promise.all(
    destinations.map(async (destination) => {
      destination.image = await getDestinationImage(destination);
    })
  );
}

// Fetch image from Unsplash or use cache/fallback
async function getDestinationImage(destination) {
  if (state.imageCache.has(destination.id)) {
    return state.imageCache.get(destination.id);
  }

  if (!UNSPLASH_ACCESS_KEY) {
    state.imageCache.set(destination.id, destination.image);
    return destination.image;
  }

  const query = encodeURIComponent(`${destination.name} travel landscape`);
  const url = `https://api.unsplash.com/search/photos?query=${query}&orientation=landscape&per_page=1&client_id=${UNSPLASH_ACCESS_KEY}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Unsplash request failed with ${response.status}`);

    const data = await response.json();
    const imageUrl = data.results?.[0]?.urls?.regular || destination.image;

    state.imageCache.set(destination.id, imageUrl);
    return imageUrl;
  } catch (error) {
    console.warn(`Image fallback used for ${destination.name}`, error);
    state.imageCache.set(destination.id, destination.image);
    return destination.image;
  }
}

// Apply filters + sorting and update UI
function applyFiltersAndRender() {
  const searchValue = searchInput.value.trim().toLowerCase();
  const selectedRegion = regionFilter.value;
  const selectedClimate = climateFilter.value;
  const selectedBudget = budgetFilter.value;
  const selectedSort = sortSelect.value;

  state.filteredDestinations = state.destinations
    .filter((destination) => destination.name.toLowerCase().includes(searchValue))
    .filter((destination) => selectedRegion === "all" || destination.region === selectedRegion)
    .filter((destination) => selectedClimate === "all" || destination.climate === selectedClimate)
    .filter((destination) => selectedBudget === "all" || destination.affordability === selectedBudget)
    .sort((a, b) => sortDestinations(a, b, selectedSort));

  renderDestinations(state.filteredDestinations);
  updateCounts();
}

// Sorting logic
function sortDestinations(a, b, mode) {
  const sorters = {
    "name-asc": () => a.name.localeCompare(b.name),
    "population-desc": () => b.population - a.population,
    "population-asc": () => a.population - b.population,
    "affordability-asc": () =>
      a.affordabilityRank - b.affordabilityRank || a.name.localeCompare(b.name),
  };

  return (sorters[mode] || sorters["name-asc"])();
}

// Render destination cards
function renderDestinations(destinations) {
  destinationsGrid.innerHTML = "";

  if (!destinations.length) {
    destinationsGrid.innerHTML =
      '<div class="empty-state">No destinations match those filters yet. Try widening your search.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  destinations.forEach((destination) => {
    fragment.appendChild(buildCard(destination));
  });

  destinationsGrid.appendChild(fragment);
}

// Create a single destination card
function buildCard(destination) {
  const node = cardTemplate.content.firstElementChild.cloneNode(true);
  const img = node.querySelector(".destination-image");

  img.src = state.imageCache.get(destination.id) || destination.image;
  img.alt = `${destination.name} travel view`;

  // Improve image after render
  lazilyEnhanceImage(destination, img);

  // Fill card data
  node.querySelector(".country-name").textContent = destination.name;
  node.querySelector(".country-region").textContent = `${destination.region} • ${destination.subregion}`;
  node.querySelector(".country-climate").textContent = destination.climate;
  node.querySelector(".country-description").textContent = destination.description;
  node.querySelector(".country-budget").textContent = destination.affordability;
  node.querySelector(".country-language").textContent = destination.language;
  node.querySelector(".country-capital").textContent = destination.capital;
  node.querySelector(".country-population").textContent = formatPopulation(destination.population);

  return node;
}

// Load better image lazily
async function lazilyEnhanceImage(destination, imageElement) {
  if (
    state.imageCache.has(destination.id) &&
    state.imageCache.get(destination.id) !== destination.image
  ) {
    imageElement.src = state.imageCache.get(destination.id);
    return;
  }

  if (!UNSPLASH_ACCESS_KEY) return;

  const imageUrl = await getDestinationImage(destination);
  imageElement.src = imageUrl;
}

// Toggle between dark and light theme
function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme(state.theme);
  localStorage.setItem(THEME_STORAGE_KEY, state.theme);
}

// Apply theme to document
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggle.textContent = theme === "dark" ? "Light mode" : "Dark mode";
}

// Load theme from storage or system preference
function loadTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "dark" || savedTheme === "light") return savedTheme;

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Show random destination and scroll to it
function showRandomDestination() {
  if (!state.filteredDestinations.length) {
    
    return;
  }

  const destination =
    state.filteredDestinations[Math.floor(Math.random() * state.filteredDestinations.length)];

  

  const cards = [...destinationsGrid.querySelectorAll(".destination-card")];
  const targetCard = cards.find(
    (card) => card.querySelector(".country-name")?.textContent === destination.name
  );

  if (targetCard) {
    targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

// Update results count
function updateCounts() {
  resultsCount.textContent = `${state.filteredDestinations.length} destinations`;
}

// Display feedback message
function setFeedback(message, isError = false) {
  feedback.innerHTML = `<div class="feedback-card ${isError ? "error" : ""}">${message}</div>`;
}

// Format population with commas
function formatPopulation(value) {
  return new Intl.NumberFormat("en-US").format(value);
}