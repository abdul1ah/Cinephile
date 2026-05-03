const movieGrid = document.getElementById("movie-grid");
const sectionTitle = document.getElementById("section-title");
const hero = document.getElementById("hero");

const recommendBtn = document.getElementById("recommend-btn");
const homeBtn = document.getElementById("home-btn");
const trendingBtn = document.getElementById("trending-btn");
const genreBtn = document.getElementById("genre-btn");
const historyBtn = document.getElementById("history-btn");

const navSearchInput = document.getElementById("nav-search-input");
const mainContent = document.getElementById("main-content");
const navbar = document.getElementById("navbar");
const navLinks = document.getElementById("nav-links");

// NEW: Admin selectors
const adminContainer = document.getElementById("admin-container");
const adminToggleBtn = document.getElementById("admin-toggle-btn");

// Hardcoded user ID for testing
const CURRENT_USER_ID = 19685;

// Use an empty string for relative paths so it works on both Localhost and Hugging Face
const BACKEND_URL = ""; 
let adminChartInstance = null; 
let isLoading = false;
let isAdminView = false;

/* ---------------- UI Helpers ---------------- */

// Ensures we exit admin mode if a standard nav button is clicked
function ensureUserView() {
    if (isAdminView) {
        isAdminView = false;
        adminContainer.style.display = "none";
        mainContent.style.display = "block";
        adminToggleBtn.innerHTML = '<i class="fa-solid fa-chart-pie"></i> Admin';
    }
}

function resetView() {
    ensureUserView();
    if(hero) hero.style.display = "block";
    sectionTitle.textContent = "";
    movieGrid.innerHTML = "";
    movieGrid.classList.remove("movie-details-mode");
}

function showSkeletons(count = 8) {
    movieGrid.innerHTML = "";
    for (let i = 0; i < count; i++) {
        const div = document.createElement("div");
        div.className = "movie-card skeleton";
        movieGrid.appendChild(div);
    }
}

function showError(msg) {
    movieGrid.innerHTML = `
        <div style="text-align:center; padding: 2rem; width: 100%;">
            <p style="color: var(--muted);">${msg}</p>
        </div>
    `;
}

function renderMovies(movies, extra = null) {
    movieGrid.innerHTML = movies.map(m => {
        const mid = m.movie_id || m.id;
        const posterUrl = m.poster || m.poster_path || 'https://via.placeholder.com/300x450?text=No+Image';
        const title = m.title || "Unknown Title";
        const year = (m.release_date || m.year || "").toString().slice(0, 4) || "—";
        const tmdbRating = m.rating_tmdb || m.vote_average || "N/A";

        return `
            <div class="movie-card" data-id="${mid}">
                <img src="${posterUrl}">
                <h3>${title}</h3>
                <p class="meta">${year} · ⭐ ${tmdbRating}</p>
                ${extra ? extra(m) : ""}
            </div>
        `;
    }).join("");
}

/* ---------------- API ---------------- */

async function apiGet(path, params = {}) {
    if (isLoading) return null;
    isLoading = true;
    
    // Only show movie skeletons if we aren't in the admin view
    if (!isAdminView) showSkeletons();

    try {
        const res = await axios.get(`${BACKEND_URL}${path}`, { params });
        return res.data;
    } catch (err) {
        console.error("API Error:", err);
        if (!isAdminView) showError("Something went wrong loading data.");
        return null;
    } finally {
        isLoading = false;
    }
}

/* ---------------- Admin Logic ---------------- */

async function toggleAdminDashboard() {
    isAdminView = !isAdminView;
    
    if (isAdminView) {
        // Switch to Admin
        mainContent.style.display = "none";
        adminContainer.style.display = "block";
        adminToggleBtn.innerHTML = '<i class="fa-solid fa-house"></i> Exit Admin';
        await loadAdminMetrics();
    } else {
        // Switch to Home
        adminContainer.style.display = "none";
        mainContent.style.display = "block";
        adminToggleBtn.innerHTML = '<i class="fa-solid fa-chart-pie"></i> Admin';
        showHome();
    }
}

async function loadAdminMetrics() {
    const data = await apiGet("/admin/stats", { username: "admin" });
    if (!data) return;

    document.querySelector("#total-users h3").textContent = data.total_users.toLocaleString();
    document.querySelector("#total-movies h3").textContent = data.total_movies.toLocaleString();
   document.querySelector("#total-ratings h3").textContent = Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1
    }).format(data.total_ratings);
    document.querySelector("#recent-activity h3").textContent = data.recent_ratings ? data.recent_ratings.toLocaleString() : "—";

    const tbody = document.getElementById("admin-table-body");
    tbody.innerHTML = data.user_metrics.map(u => `
        <tr>
            <td>${u.user_id}</td>
            <td>${u.ratings_count}</td>
            <td>${u.avg_rating.toFixed(2)}</td>
            <td>${u.last_activity ?? "—"}</td>
        </tr>
    `).join("");

    const ctx = document.getElementById('userActivityChart').getContext('2d');
    
    if (adminChartInstance) {
        adminChartInstance.destroy();
    }

    const labels = data.user_metrics.map(u => `User ${u.user_id}`);
    const chartData = data.user_metrics.map(u => u.ratings_count);

    Chart.defaults.color = '#a1a1aa';
    Chart.defaults.font.family = 'Inter';

    adminChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Ratings',
                data: chartData,
                backgroundColor: '#00ffcc',
                borderRadius: 0, 
                barPercentage: 0.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#18181b',
                    titleColor: '#fff',
                    bodyColor: '#a1a1aa',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 12
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255,255,255,0.05)', 
                        drawBorder: false
                    }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

/* ---------------- Pages ---------------- */

function showHome() {
    resetView();
    recommendForUser();
}

async function loadTrending() {
    ensureUserView();
    if(hero) hero.style.display = "none";
    sectionTitle.textContent = "Trending Now";
    movieGrid.classList.remove("movie-details-mode");

    const data = await apiGet("/trending", { limit: 20 });
    if (data) renderMovies(data);
}

async function loadGenres() {
    ensureUserView();
    if(hero) hero.style.display = "none";
    sectionTitle.textContent = "Pick a Genre";
    movieGrid.classList.remove("movie-details-mode");

    const genres = ["Action","Comedy","Drama","Romance","Thriller","Animation"];
    movieGrid.innerHTML = genres.map(g =>
        `<button class="nav-btn genre-btn" data-g="${g.toLowerCase()}">${g}</button>`
    ).join("");

    document.querySelectorAll(".genre-btn").forEach(btn => {
        btn.onclick = async () => {
            sectionTitle.textContent = `Genre: ${btn.textContent}`;
            const data = await apiGet("/recommend/genre", { genre: btn.dataset.g, n: 20 });
            if (data) renderMovies(data);
        };
    });
}

async function recommendForUser() {
    ensureUserView();
    if(hero) hero.style.display = "none";
    sectionTitle.textContent = "Handpicked For You";
    movieGrid.classList.remove("movie-details-mode");

    const data = await apiGet("/recommend", { user_id: CURRENT_USER_ID, n: 12 });
    if (data) renderMovies(data, m =>
        `<p class="score">Predicted Feedback: ${m.predicted_rating ? m.predicted_rating.toFixed(2) : 'N/A'}</p>`
    );
}

async function loadHistory() {
    ensureUserView();
    if(hero) hero.style.display = "none";
    sectionTitle.textContent = "Your Previously Rated Movies";
    movieGrid.classList.remove("movie-details-mode");

    const data = await apiGet("/user/history", { user_id: CURRENT_USER_ID });
    if (!data?.length) return showError("No history found.");
    renderMovies(data, m => `<p class="score">Your Rating: ${m.rating}</p>`);
}

async function searchMovies(q) {
    if (!q) return;
    ensureUserView();
    if(hero) hero.style.display = "none";
    sectionTitle.textContent = `Search: "${q}"`;
    movieGrid.classList.remove("movie-details-mode");

    const data = await apiGet("/search", { query: q });
    if (!data?.length) return showError("No results.");
    renderMovies(data);
}

/* ---------------- Movie Details ---------------- */

movieGrid.addEventListener("click", e => {
    const card = e.target.closest(".movie-card");
    if (!card) return;
    const movieId = card.dataset.id;
    if (!movieId || movieId === "null") return;
    loadMovieDetails(Number(movieId));
});

async function loadMovieDetails(movieId) {
    ensureUserView();
    if(hero) hero.style.display = "none";
    sectionTitle.textContent = "";
    movieGrid.classList.add("movie-details-mode");

    const movie = await apiGet(`/movie/${movieId}`);
    if (!movie) return;

    const similar = await apiGet("/similar", { movie_id: movieId, n: 15 });

    movieGrid.innerHTML = `
        <div class="movie-details-container">
            <button id="back-btn" class="primary-btn">← Back</button>
            <div class="movie-details-card">
                <img src="${movie.poster || 'https://via.placeholder.com/220x330?text=No+Image'}" class="movie-details-poster">
                <div class="movie-details-info">
                    <h2>${movie.title}</h2>
                    <p><strong>Release:</strong> ${movie.release_date || "Unknown"}</p>
                    <p><strong>Rating:</strong> ⭐ ${movie.rating_tmdb ?? "N/A"}</p>
                    <p><strong>Genres:</strong> ${movie.genres || "N/A"}</p>
                    <p><strong>Cast:</strong> ${movie.cast || "N/A"}</p>
                    <p><strong>Overview:</strong> ${movie.overview || "N/A"}</p>
                </div>
            </div>
            ${similar?.length ? `
            <div class="similar-section">
                <h3 class="similar-title">Similar Movies</h3>
                <div class="similar-carousel-wrapper">
                    <button class="carousel-btn left">&lt;</button>
                    <div class="similar-movies-carousel">
                        ${similar.map(m => `
                            <div class="similar-movie-card" data-id="${m.movie_id || m.id}">
                                <img src="${m.poster || 'https://via.placeholder.com/200x300?text=No+Image'}">
                                <p>${m.title}</p>
                            </div>
                        `).join("")}
                    </div>
                    <button class="carousel-btn right">&gt;</button>
                </div>
            </div>
            ` : ""}
        </div>
    `;

    document.getElementById("back-btn").onclick = showHome;

    document.querySelectorAll(".similar-movie-card").forEach(card => {
        card.onclick = () => loadMovieDetails(Number(card.dataset.id));
    });

    const carousel = document.querySelector(".similar-movies-carousel");
    if (carousel) {
        document.querySelector(".carousel-btn.left").onclick = () => carousel.scrollBy({ left: -500, behavior: "smooth" });
        document.querySelector(".carousel-btn.right").onclick = () => carousel.scrollBy({ left: 500, behavior: "smooth" });
    }
}

/* ---------------- Initialization ---------------- */

window.addEventListener("DOMContentLoaded", () => {
    // Fire the home dashboard immediately on load
    showHome();
});

/* ---------------- Events ---------------- */

if(homeBtn) homeBtn.onclick = showHome;
if(trendingBtn) trendingBtn.onclick = loadTrending;
if(genreBtn) genreBtn.onclick = loadGenres;
if(historyBtn) historyBtn.onclick = loadHistory;
if(adminToggleBtn) adminToggleBtn.onclick = toggleAdminDashboard;

if(navSearchInput) {
    navSearchInput.addEventListener("keydown", e => {
        if (e.key === "Enter") searchMovies(navSearchInput.value);
    });
}