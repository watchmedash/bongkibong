const params = new URLSearchParams(location.search);
const showId = params.get("id");

if (!showId || BLOCKED_SHOWS.has(parseInt(showId))) location.replace("shows.html");

let selSeason = 1, selEpisode = 1;

const SERVERS = [
  (id, s, e) => `https://cinesrc.st/embed/tv/${id}?s=${s}&e=${e}`,
  (id, s, e) => `https://player.cinezo.live/embed/tv/${id}/${s}/${e}`,
  (id, s, e) => `https://player.vidzee.wtf/embed/tv/${id}/${s}/${e}`,
  (id, s, e) => `https://vidsrcme.ru/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
  (id, s, e) => `https://vidrock.to/tv/${id}/${s}/${e}`,
  (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}`,
  (id, s, e) => `https://111movies.net/tv/${id}/${s}/${e}`,
  (id, s, e) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`,
  (id, s, e) => `https://cinemaos.tech/player/${id}/${s}/${e}`,
  (id, s, e) => `https://mapple.uk/watch/tv/${id}-${s}-${e}`,
  (id, s, e) => `https://web.nxsha.app/embed/tv/${id}/${s}/${e}`,
  (id, s, e) => `https://www.nontongo.win/embed/tv/${id}/${s}/${e}`,
  (id, s, e) => `https://peachify.top/embed/tv/${id}/${s}/${e}`,
  (id, s, e) => `https://primesrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
  (id, s, e) => `https://spencerdevs.xyz/tv/${id}/${s}/${e}`,
  (id, s, e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}`,
  (id, s, e) => `https://vaplayer.ru/embed/tv/${id}/${s}/${e}`,
  (id, s, e) => `https://vidapi.xyz/embed/tv/${id}/${s}/${e}`,
  (id, s, e) => `https://vidcore.net/tv/${id}/${s}/${e}`,
  (id, s, e) => `https://vidfast.pro/tv/${id}/${s}/${e}`,
  (id, s, e) => `https://player.vidify.top/embed/tv/${id}/${s}/${e}`,
  (id, s, e) => `https://vidflix.club/tv/${id}/${s}/${e}`,
  (id, s, e) => `https://vidplays.fun/embed/tv/${id}/${s}/${e}`,
  (id, s, e) => `https://vidsrc.su/tv/${id}/${s}/${e}`,
  (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
  (id, s, e) => `https://vidup.to/tv/${id}/${s}/${e}`,
  (id, s, e) => `https://vidzen.fun/tv/${id}/${s}/${e}`,
];

const SANDBOXED = new Set([]);
const SANDBOX = "allow-scripts allow-same-origin allow-forms allow-presentation";

function setPlayer() {
  const idx = parseInt(document.getElementById("srvSel").value);
  const frame = document.getElementById("vidPlayer");
  if (SANDBOXED.has(idx)) frame.setAttribute("sandbox", SANDBOX);
  else frame.removeAttribute("sandbox");
  frame.src = SERVERS[idx](showId, selSeason, selEpisode);
  document.getElementById("dlBtn").href = `https://vidrock.to/tv/${showId}/${selSeason}/${selEpisode}`;
}
function changeServer() { setPlayer(); }

const seasonSel = document.getElementById("seasonSel");
const epGrid    = document.getElementById("epGrid");

async function loadEpisodes(season) {
  selSeason = season; selEpisode = 1;
  epGrid.innerHTML = "";
  try {
    const d = await cachedFetch(`${BASE}/tv/${showId}/season/${season}?api_key=${API_KEY}&language=en-US`);
    const eps = (d.episodes || []).filter(e => e.episode_number > 0);

    eps.forEach(ep => {
      const btn = document.createElement("button");
      btn.className = "ep-btn" + (ep.episode_number === 1 ? " cur" : "");
      btn.textContent = ep.episode_number;
      btn.title = ep.name;
      btn.addEventListener("click", () => {
        selEpisode = ep.episode_number;
        document.querySelectorAll(".ep-btn").forEach(b => b.classList.remove("cur"));
        btn.classList.add("cur");
        setPlayer();
      });
      epGrid.appendChild(btn);
    });
    setPlayer();
  } catch (e) { console.error(e); }
}

seasonSel.addEventListener("change", () => loadEpisodes(parseInt(seasonSel.value)));

async function loadDetails() {
  try {
    const [show, credits, videos] = await Promise.all([
      cachedFetch(`${BASE}/tv/${showId}?api_key=${API_KEY}&language=en-US`),
      cachedFetch(`${BASE}/tv/${showId}/credits?api_key=${API_KEY}`),
      cachedFetch(`${BASE}/tv/${showId}/videos?api_key=${API_KEY}`),
    ]);
    document.title = `${show.name} – Dashflix`;
    RW.add({ ...show, type: "tv" });

    const schema = {
      "@context": "https://schema.org", "@type": "TVSeries",
      "name": show.name,
      "description": show.overview || "",
      "datePublished": show.first_air_date || "",
      "url": `https://dashflix.top/players.html?id=${show.id}`,
      "genre": (show.genres || []).map(g => g.name),
      "numberOfSeasons": show.number_of_seasons || 1,
      ...(show.poster_path && { "image": `${IMG}w500${show.poster_path}` }),
      ...(show.vote_average && { "aggregateRating": { "@type": "AggregateRating", "ratingValue": show.vote_average.toFixed(1), "ratingCount": show.vote_count || 1, "bestRating": "10", "worstRating": "0" } }),
    };
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.textContent = JSON.stringify(schema);
    document.head.appendChild(ld);

    const numSeasons = show.number_of_seasons || 1;
    seasonSel.innerHTML = "";
    for (let s = 1; s <= numSeasons; s++) {
      const o = document.createElement("option");
      o.value = s; o.textContent = `Season ${s}`; seasonSel.appendChild(o);
    }
    await loadEpisodes(1);

    const year    = (show.first_air_date || "").slice(0, 4);
    const genres  = (show.genres || []).map(g => g.name).join(", ");
    const rating  = (show.vote_average || 0).toFixed(1);
    const creator = (show.created_by || [])[0];

    document.getElementById("details").innerHTML = `
      <div class="det-poster">
        ${show.poster_path
          ? `<img src="${IMG}${show.poster_path}" alt="${show.name}" loading="lazy">`
          : `<div class="det-ph"><i class="fas fa-tv"></i></div>`}
      </div>
      <div class="det-info">
        <div class="det-title">${show.name}</div>
        <div class="chips">
          ${year ? `<span class="chip"><i class="fas fa-calendar-alt"></i>${year}</span>` : ""}
          <span class="chip"><i class="fas fa-star"></i>${rating}</span>
          <span class="chip"><i class="fas fa-layer-group"></i>${numSeasons} Season${numSeasons !== 1 ? "s" : ""}</span>
        </div>
        ${genres ? `<div class="det-genres">${genres}</div>` : ""}
        <div class="det-overview">${show.overview || "No overview available."}</div>
        ${creator ? `<div class="det-creator"><i class="fas fa-user"></i>Created by ${creator.name}</div>` : ""}
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
      const inWL = WL.has(show.id, "tv");
      wlBtn.className = `act-btn ${inWL ? "inWL" : "sec"}`;
      wlBtn.innerHTML = `<i class="fas fa-${inWL ? "check" : "bookmark"}"></i> ${inWL ? "In Watchlist" : "Add to Watchlist"}`;
    };
    syncWL();
    wlBtn.onclick = () => {
      WL.has(show.id, "tv") ? WL.remove(show.id, "tv") : WL.add({ ...show, type: "tv" });
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
    const d = await cachedFetch(`${BASE}/tv/${showId}/similar?api_key=${API_KEY}&language=en-US&page=1`);
    const items = (d.results || []).filter(s => !BLOCKED_SHOWS.has(s.id)).slice(0, 12);
    const grid  = document.getElementById("relGrid");
    items.forEach(s => grid.appendChild(buildCard({ ...s, type: "tv" })));
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
