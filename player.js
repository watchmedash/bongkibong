const params  = new URLSearchParams(location.search);
const movieId = params.get("id");

if (!movieId || BLOCKED_MOVIES.has(parseInt(movieId))) location.replace("movies.html");

document.getElementById("dlBtn").href = `https://vidvault.to/movie/${movieId}`;

const SERVERS = [
  id => `https://vsembed.ru/embed/movie/${id}`,
  id => `https://moviesapi.to/movie/${id}`,
  id => `https://vidlink.pro/movie/${id}`,
  id => `https://vidfast.pro/movie/${id}?autoPlay=true`,
  id => `https://player.vidzee.wtf/embed/movie/${id}?server=1`,
  id => `https://vsembed.su/embed/movie/${id}`,
  id => `https://111movies.net/movie/${id}`,
  id => `https://www.2embed.cc/embed/${id}`,
  id => `https://cinemaos.tech/player/${id}`,
  id => `https://cinesrc.st/embed/movie/${id}`,
  id => `https://player.cinezo.live/embed/movie/${id}`,
  id => `https://embed.icefy.top/movie?id=${id}`,
  id => `https://mapple.uk/watch/movie/${id}`,
  id => `https://web.nxsha.app/embed/movie/${id}`,
  id => `https://www.nontongo.win/embed/movie/${id}`,
  id => `https://peachify.top/embed/movie/${id}`,
  id => `https://primesrc.me/embed/movie?tmdb=${id}`,
  id => `https://spencerdevs.xyz/movie/${id}`,
  id => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
  id => `https://vaplayer.ru/embed/movie/${id}`,
  id => `https://vidapi.xyz/embed/movie/${id}`,
  id => `https://vidcore.net/movie/${id}`,
  id => `https://vidnest.fun/movie/${id}`,
  id => `https://player.vidify.top/embed/movie/${id}`,
  id => `https://vidplays.fun/embed/movie/${id}`,
  id => `https://vidrock.ru/movie/${id}`,
  id => `https://vidsrc.su/movie/${id}`,
  id => `https://vidsrc.to/embed/movie/${id}`,
  id => `https://vidup.to/movie/${id}`,
  id => `https://vidzen.fun/movie/${id}`,
  id => `https://zxcstream.xyz/player/movie/${id}`,
];

const SANDBOXED = new Set([1, 9]); // Server 2, Server 10
const SANDBOX = "allow-scripts allow-same-origin allow-forms allow-presentation";

function changeServer() {
  const idx = parseInt(document.getElementById("srvSel").value);
  const frame = document.getElementById("vidPlayer");
  if (SANDBOXED.has(idx)) frame.setAttribute("sandbox", SANDBOX);
  else frame.removeAttribute("sandbox");
  frame.src = SERVERS[idx](movieId);
}
changeServer();

async function loadDetails() {
  try {
    const [movie, credits, videos] = await Promise.all([
      cachedFetch(`${BASE}/movie/${movieId}?api_key=${API_KEY}&language=en-US`),
      cachedFetch(`${BASE}/movie/${movieId}/credits?api_key=${API_KEY}`),
      cachedFetch(`${BASE}/movie/${movieId}/videos?api_key=${API_KEY}`),
    ]);

    document.title = `${movie.title} – Dashflix`;
    RW.add({ ...movie, type: "movie" });

    const schema = {
      "@context": "https://schema.org", "@type": "Movie",
      "name": movie.title,
      "description": movie.overview || "",
      "datePublished": movie.release_date || "",
      "url": `https://dashflix.top/player.html?id=${movie.id}`,
      "genre": (movie.genres || []).map(g => g.name),
      ...(movie.poster_path && { "image": `${IMG}w500${movie.poster_path}` }),
      ...(movie.runtime && { "duration": `PT${movie.runtime}M` }),
      ...(movie.vote_average && { "aggregateRating": { "@type": "AggregateRating", "ratingValue": movie.vote_average.toFixed(1), "ratingCount": movie.vote_count || 1, "bestRating": "10", "worstRating": "0" } }),
    };
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.textContent = JSON.stringify(schema);
    document.head.appendChild(ld);

    const director = (credits.crew || []).find(c => c.job === "Director");
    const year     = (movie.release_date || "").slice(0, 4);
    const genres   = (movie.genres || []).map(g => g.name).join(", ");
    const rating   = (movie.vote_average || 0).toFixed(1);
    const runtime  = movie.runtime;

    document.getElementById("details").innerHTML = `
      <div class="det-poster">
        ${movie.poster_path
          ? `<img src="${IMG}${movie.poster_path}" alt="${movie.title}" loading="lazy">`
          : `<div class="det-ph"><i class="fas fa-film"></i></div>`}
      </div>
      <div class="det-info">
        <div class="det-title">${movie.title}</div>
        <div class="chips">
          ${year ? `<span class="chip"><i class="fas fa-calendar-alt"></i>${year}</span>` : ""}
          <span class="chip"><i class="fas fa-star"></i>${rating}</span>
          ${runtime ? `<span class="chip"><i class="fas fa-clock"></i>${runtime}m</span>` : ""}
        </div>
        ${genres ? `<div class="det-genres">${genres}</div>` : ""}
        <div class="det-overview">${movie.overview || "No overview available."}</div>
        ${director ? `<div class="det-director"><i class="fas fa-video"></i>Dir. ${director.name}</div>` : ""}
      </div>`;

    renderCast(credits.cast || []);

    const trailer = (videos.results || []).find(v => v.type === "Trailer" && v.site === "YouTube");
    const trlBtn  = document.getElementById("trlBtn");
    if (trailer) {
      trlBtn.style.display = "flex";
      trlBtn.onclick = () => {
        document.getElementById("trlFrame").src = `https://www.youtube.com/embed/${trailer.key}?autoplay=1`;
        document.getElementById("trlModal").classList.add("open");
      };
    }

    const wlBtn = document.getElementById("wlBtn");
    const syncWL = () => {
      const inWL = WL.has(movie.id, "movie");
      wlBtn.className = `act-btn ${inWL ? "inWL" : "sec"}`;
      wlBtn.innerHTML = `<i class="fas fa-${inWL ? "check" : "bookmark"}"></i> ${inWL ? "In Watchlist" : "Add to Watchlist"}`;
    };
    syncWL();
    wlBtn.onclick = () => {
      WL.has(movie.id, "movie") ? WL.remove(movie.id, "movie") : WL.add({ ...movie, type: "movie" });
      syncWL();
    };
  } catch (e) { console.error(e); }
}

function renderCast(cast) {
  const row = document.getElementById("castRow");
  if (!row) return;
  cast.slice(0, 20).forEach(p => {
    const card = document.createElement("a");
    card.className = "cast-card";
    card.href = `person.html?id=${p.id}`;
    card.innerHTML = p.profile_path
      ? `<img class="cast-photo" src="https://image.tmdb.org/t/p/w185${p.profile_path}" alt="${p.name}" loading="lazy">`
      : `<div class="cast-photo-ph"><i class="fas fa-user"></i></div>`;
    card.innerHTML += `<div class="cast-name">${p.name}</div><div class="cast-char">${p.character || ""}</div>`;
    row.appendChild(card);
  });
}

async function loadRelated() {
  try {
    const d = await cachedFetch(`${BASE}/movie/${movieId}/similar?api_key=${API_KEY}&language=en-US&page=1`);
    const items = (d.results || []).filter(m => !BLOCKED_MOVIES.has(m.id)).slice(0, 12);
    const grid  = document.getElementById("relGrid");
    items.forEach(m => grid.appendChild(buildCard({ ...m, type: "movie" })));
  } catch (e) { console.error(e); }
}

const trlModal = document.getElementById("trlModal");
function closeTrailer() {
  document.getElementById("trlFrame").src = "";
  trlModal.classList.remove("open");
}
document.getElementById("trlClose").onclick = closeTrailer;
trlModal.addEventListener("click", e => { if (e.target === trlModal) closeTrailer(); });

loadDetails();
loadRelated();
