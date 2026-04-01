let allCountries = [];
 
fetch("https://restcountries.com/v3.1/all?fields=name,flags,capital,region,subregion,population,area,languages,currencies,timezones")
  .then(res => res.json())
  .then(data => {
    allCountries = data;
    console.log("Countries loaded:", allCountries.length);
  })
  .catch(() => {
    document.getElementById("result").innerHTML = "Failed to load country data.";
  });
 
document.getElementById("searchBtn").addEventListener("click", searchCountry);
document.getElementById("searchInput").addEventListener("keydown", function (e) {
  if (e.key === "Enter") searchCountry();
});
