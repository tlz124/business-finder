/* =====================================================
   FLECHA WEB DESIGN — LEAD FINDER
   Business_Finder.js
   ===================================================== */

'use strict';

// ─── STATE ────────────────────────────────────────────
const state = {
    apiKey: null,
    connected: false,
    scanning: false,
    results: [],
    prospects: new Set(),
};

// ─── DOM REFS ─────────────────────────────────────────
const $ = id => document.getElementById(id);

const dom = {
    apiKeyInput:    $('apiKeyInput'),
    toggleApiKey:   $('toggleApiKey'),
    connectBtn:     $('connectBtn'),
    apiStatus:      $('apiStatus'),
    scanBtn:        $('scanBtn'),
    demoBtn:        $('demoBtn'),
    clearBtn:       $('clearBtn'),
    businessType:   $('businessType'),
    locationInput:  $('locationInput'),
    radiusSelect:   $('radiusSelect'),
    maxResults:     $('maxResults'),
    filterNoWebsite:  $('filterNoWebsite'),
    filterLowRating:  $('filterLowRating'),
    filterNoPhone:    $('filterNoPhone'),
    scanIndicator:  $('scanIndicator'),
    progressWrap:   $('progressWrap'),
    progressBar:    $('progressBar'),
    progressLabel:  $('progressLabel'),
    emptyState:     $('emptyState'),
    tableWrap:      $('tableWrap'),
    resultsTableBody: $('resultsTableBody'),
    resultsCount:   $('resultsCount'),
    exportBtn:      $('exportBtn'),
    modalBackdrop:  $('modalBackdrop'),
    detailModal:    $('detailModal'),
    modalClose:     $('modalClose'),
    modalScore:     $('modalScore'),
    modalName:      $('modalName'),
    modalAddress:   $('modalAddress'),
    modalBody:      $('modalBody'),
    modalMapsLink:  $('modalMapsLink'),
    modalWebsiteLink: $('modalWebsiteLink'),
    modalContactBtn:  $('modalContactBtn'),
};

// ─── GRID CANVAS BACKGROUND ───────────────────────────
(function initCanvas() {
    const canvas = $('gridCanvas');
    const ctx    = canvas.getContext('2d');
    let w, h;

    function resize() {
        w = canvas.width  = window.innerWidth;
        h = canvas.height = window.innerHeight;
    }

    resize();
    window.addEventListener('resize', resize);

    let offset = 0;

    function draw() {
        ctx.clearRect(0, 0, w, h);

        const gridSize = 60;
        const purple   = 'rgba(139, 0, 255, 0.18)';
        const purpleDim = 'rgba(139, 0, 255, 0.07)';

        ctx.strokeStyle = purpleDim;
        ctx.lineWidth   = 0.5;

        // Vertical lines
        for (let x = 0; x <= w; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }

        // Horizontal lines with scroll
        for (let y = (offset % gridSize); y <= h; y += gridSize) {
            const distFromCenter = Math.abs(y - h / 2) / (h / 2);
            ctx.strokeStyle = distFromCenter < 0.15 ? purple : purpleDim;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // Glowing center horizontal
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0,   'transparent');
        grad.addColorStop(0.3, 'rgba(139, 0, 255, 0.12)');
        grad.addColorStop(0.5, 'rgba(191, 95, 255, 0.3)');
        grad.addColorStop(0.7, 'rgba(139, 0, 255, 0.12)');
        grad.addColorStop(1,   'transparent');
        ctx.strokeStyle = grad;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();

        offset += 0.3;
        requestAnimationFrame(draw);
    }

    draw();
})();

// ─── API KEY TOGGLE ────────────────────────────────────
dom.toggleApiKey.addEventListener('click', () => {
    const isPassword = dom.apiKeyInput.type === 'password';
    dom.apiKeyInput.type = isPassword ? 'text' : 'password';
    dom.toggleApiKey.innerHTML = isPassword
        ? '<i class="fa-solid fa-eye-slash"></i>'
        : '<i class="fa-solid fa-eye"></i>';
});

// ─── CONNECT ──────────────────────────────────────────
dom.connectBtn.addEventListener('click', () => {
    const key = dom.apiKeyInput.value.trim();
    if (!key) {
        flashInput(dom.apiKeyInput);
        return;
    }
    state.apiKey    = key;
    state.connected = true;
    dom.apiStatus.textContent = 'CONNECTED';
    dom.apiStatus.classList.add('connected');
    dom.scanBtn.disabled = false;
    dom.connectBtn.innerHTML = '<span>RECONNECT</span><i class="fa-solid fa-rotate-right"></i>';
});

function flashInput(el) {
    el.style.borderColor = '#ff3355';
    el.style.boxShadow   = '0 0 10px rgba(255,51,85,0.5)';
    setTimeout(() => {
        el.style.borderColor = '';
        el.style.boxShadow   = '';
    }, 1000);
}

// ─── SCORING ENGINE ────────────────────────────────────
function scoreBusinessFromPlaces(place) {
    let score = 0;
    const flags = [];

    // No website — highest value signal
    if (!place.website) {
        score += 35;
        flags.push({ label: 'NO WEBSITE', tier: 'red' });
    }

    // Very few reviews
    const reviews = place.user_ratings_total || 0;
    if (reviews === 0) {
        score += 20;
        flags.push({ label: 'ZERO REVIEWS', tier: 'red' });
    } else if (reviews < 10) {
        score += 15;
        flags.push({ label: 'FEW REVIEWS', tier: 'yellow' });
    } else if (reviews < 25) {
        score += 8;
        flags.push({ label: 'LOW REVIEWS', tier: 'yellow' });
    }

    // Low rating (signals weak online presence)
    const rating = place.rating || 0;
    if (rating > 0 && rating < 3.5) {
        score += 12;
        flags.push({ label: 'LOW RATING', tier: 'yellow' });
    }

    // No phone number
    if (!place.formatted_phone_number && !place.international_phone_number) {
        score += 10;
        flags.push({ label: 'NO PHONE', tier: 'purple' });
    }

    // No photos
    if (!place.photos || place.photos.length === 0) {
        score += 8;
        flags.push({ label: 'NO PHOTOS', tier: 'purple' });
    }

    // Business is permanently closed
    if (place.permanently_closed) {
        score = 0;
        flags.length = 0;
        flags.push({ label: 'CLOSED', tier: 'red' });
    }

    return { score: Math.min(score, 100), flags };
}

// ─── GEOCODE HELPER ────────────────────────────────────
async function geocodeLocation(location) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${state.apiKey}`;
    const res  = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK' && data.results.length > 0) {
        return data.results[0].geometry.location; // { lat, lng }
    }
    throw new Error('Geocode failed: ' + data.status);
}

// ─── PLACES NEARBY SEARCH ─────────────────────────────
async function searchNearby(lat, lng, type, radius, pagetoken) {
    let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&keyword=${encodeURIComponent(type)}&key=${state.apiKey}`;
    if (pagetoken) url += `&pagetoken=${pagetoken}`;
    const res  = await fetch(url);
    return res.json();
}

// ─── PLACE DETAILS ────────────────────────────────────
async function getPlaceDetails(placeId) {
    const fields = 'name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,photos,types,url,permanently_closed';
    const url    = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${state.apiKey}`;
    const res    = await fetch(url);
    const data   = await res.json();
    return data.result || {};
}

// ─── MAIN SCAN ────────────────────────────────────────
dom.scanBtn.addEventListener('click', async () => {
    if (state.scanning) return;

    const type     = dom.businessType.value.trim();
    const location = dom.locationInput.value.trim();
    const radius   = parseInt(dom.radiusSelect.value);
    const maxRes   = parseInt(dom.maxResults.value);

    if (!type)     { flashInput(dom.businessType);  return; }
    if (!location) { flashInput(dom.locationInput); return; }

    state.scanning = true;
    clearResults();
    showProgress(5, 'Geocoding location...');
    setScanIndicator(true);

    try {
        const coords = await geocodeLocation(location);
        showProgress(15, 'Scanning for businesses...');

        let allPlaces = [];
        let pagetoken = null;
        let page      = 0;

        while (allPlaces.length < maxRes && page < 3) {
            const data = await searchNearby(coords.lat, coords.lng, type, radius, pagetoken);

            if (data.status === 'REQUEST_DENIED') {
                throw new Error('API key rejected. Check your key and billing settings.');
            }

            allPlaces = allPlaces.concat(data.results || []);
            pagetoken  = data.next_page_token || null;
            page++;

            if (!pagetoken) break;
            await sleep(2000); // Google requires a brief delay between pages
        }

        allPlaces = allPlaces.slice(0, maxRes);
        showProgress(35, `Fetching details for ${allPlaces.length} businesses...`);

        const detailed = [];
        for (let i = 0; i < allPlaces.length; i++) {
            const pct = 35 + Math.round(((i + 1) / allPlaces.length) * 55);
            showProgress(pct, `Analyzing ${i + 1} of ${allPlaces.length}...`);

            const detail = await getPlaceDetails(allPlaces[i].place_id);
            const { score, flags } = scoreBusinessFromPlaces(detail);

            // Apply active filters
            if (dom.filterNoWebsite.checked && detail.website) continue;
            if (dom.filterLowRating.checked  && (detail.user_ratings_total || 0) >= 10) {
                // only keep if other flags still make it interesting
                if (!flags.some(f => f.tier === 'red')) continue;
            }
            if (dom.filterNoPhone.checked && (detail.formatted_phone_number || detail.international_phone_number)) continue;

            detailed.push({ ...detail, place_id: allPlaces[i].place_id, score, flags });
        }

        // Sort by score descending
        detailed.sort((a, b) => b.score - a.score);
        state.results = detailed;

        showProgress(100, 'Scan complete.');
        setTimeout(() => hideProgress(), 800);
        renderResults(detailed);

    } catch (err) {
        showProgress(0, '');
        hideProgress();
        renderError(err.message);
    } finally {
        state.scanning = false;
        setScanIndicator(false);
    }
});

// ─── DEMO MODE ────────────────────────────────────────
dom.demoBtn.addEventListener('click', () => {
    clearResults();
    showProgress(20, 'Loading demo data...');
    setTimeout(() => showProgress(70, 'Scoring businesses...'), 400);
    setTimeout(() => {
        showProgress(100, 'Demo loaded.');
        setTimeout(hideProgress, 600);
        const demo = generateDemoData();
        state.results = demo;
        renderResults(demo);
    }, 900);
});

function generateDemoData() {
    return [
        {
            name: "Gilbert Family Dentistry",
            formatted_address: "123 E Warner Rd, Gilbert, AZ 85296",
            formatted_phone_number: "(480) 555-0182",
            website: null,
            rating: 3.8,
            user_ratings_total: 7,
            types: ["dentist", "health"],
            url: "https://maps.google.com",
            photos: [],
            score: 58,
            flags: [
                { label: 'NO WEBSITE', tier: 'red' },
                { label: 'FEW REVIEWS', tier: 'yellow' },
                { label: 'NO PHOTOS', tier: 'purple' },
            ]
        },
        {
            name: "Mesa Brake & Tire Center",
            formatted_address: "4501 S Gilbert Rd, Mesa, AZ 85212",
            formatted_phone_number: null,
            website: "http://mesabrake.com",
            rating: 3.2,
            user_ratings_total: 4,
            types: ["car_repair", "establishment"],
            url: "https://maps.google.com",
            photos: [],
            score: 47,
            flags: [
                { label: 'LOW RATING', tier: 'yellow' },
                { label: 'FEW REVIEWS', tier: 'yellow' },
                { label: 'NO PHONE', tier: 'purple' },
            ]
        },
        {
            name: "Chandler Pet Grooming",
            formatted_address: "890 N Dobson Rd, Chandler, AZ 85224",
            formatted_phone_number: "(480) 555-0247",
            website: null,
            rating: 4.1,
            user_ratings_total: 3,
            types: ["pet_store", "establishment"],
            url: "https://maps.google.com",
            photos: [],
            score: 53,
            flags: [
                { label: 'NO WEBSITE', tier: 'red' },
                { label: 'FEW REVIEWS', tier: 'yellow' },
            ]
        },
        {
            name: "Desert Sun Landscaping",
            formatted_address: "2200 W Ray Rd, Chandler, AZ 85224",
            formatted_phone_number: "(480) 555-0399",
            website: "http://desertsunlandscape.biz",
            rating: 4.4,
            user_ratings_total: 22,
            types: ["general_contractor"],
            url: "https://maps.google.com",
            photos: [1, 2],
            score: 18,
            flags: [
                { label: 'DATED SITE', tier: 'purple' },
            ]
        },
        {
            name: "Sonoran Plumbing Co.",
            formatted_address: "745 S Cooper Rd, Gilbert, AZ 85233",
            formatted_phone_number: null,
            website: null,
            rating: 0,
            user_ratings_total: 0,
            types: ["plumber"],
            url: "https://maps.google.com",
            photos: [],
            score: 73,
            flags: [
                { label: 'NO WEBSITE', tier: 'red' },
                { label: 'ZERO REVIEWS', tier: 'red' },
                { label: 'NO PHONE', tier: 'purple' },
                { label: 'NO PHOTOS', tier: 'purple' },
            ]
        },
        {
            name: "East Valley Tax Services",
            formatted_address: "301 N Gilbert Rd #200, Gilbert, AZ 85234",
            formatted_phone_number: "(480) 555-0561",
            website: "http://evtax.net",
            rating: 2.9,
            user_ratings_total: 11,
            types: ["accounting"],
            url: "https://maps.google.com",
            photos: [],
            score: 34,
            flags: [
                { label: 'LOW RATING', tier: 'yellow' },
                { label: 'NO PHOTOS', tier: 'purple' },
            ]
        },
    ].sort((a, b) => b.score - a.score);
}

// ─── RENDER RESULTS ────────────────────────────────────
function renderResults(businesses) {
    dom.emptyState.style.display  = 'none';
    dom.tableWrap.style.display   = 'block';
    dom.exportBtn.style.display   = 'inline-flex';
    dom.resultsCount.textContent  = `${businesses.length} target${businesses.length !== 1 ? 's' : ''} found`;

    dom.resultsTableBody.innerHTML = businesses.map((biz, idx) => `
        <tr data-idx="${idx}">
            <td>
                <div class="score-badge ${scoreClass(biz.score)}">${biz.score}</div>
            </td>
            <td>
                <div class="biz-name">${escHtml(biz.name)}</div>
                ${biz.formatted_address ? `<div class="biz-type">${escHtml(shortAddress(biz.formatted_address))}</div>` : ''}
            </td>
            <td>
                <span class="type-tag">${escHtml(primaryType(biz.types))}</span>
            </td>
            <td>
                ${biz.rating
                    ? `<span class="rating-stars">${starStr(biz.rating)}</span><span class="rating-num">${biz.rating}</span>`
                    : '<span style="color:var(--text-dim);font-size:0.75rem">N/A</span>'
                }
            </td>
            <td style="font-family:'Share Tech Mono',monospace;font-size:0.82rem;color:var(--text-light)">
                ${biz.user_ratings_total || 0}
            </td>
            <td>
                ${biz.website
                    ? `<a href="${escHtml(biz.website)}" target="_blank" class="website-link" title="${escHtml(biz.website)}">${escHtml(shortUrl(biz.website))}</a>`
                    : '<span class="website-none">✗ NONE</span>'
                }
            </td>
            <td>
                <div class="flags-cell">
                    ${biz.flags.slice(0,3).map(f => `<span class="flag flag-${f.tier}">${escHtml(f.label)}</span>`).join('')}
                </div>
            </td>
            <td>
                <button class="btn-detail" data-idx="${idx}">DETAILS →</button>
            </td>
        </tr>
    `).join('');

    // Row and button click → open modal
    dom.resultsTableBody.querySelectorAll('tr').forEach(row => {
        row.addEventListener('click', e => {
            if (e.target.closest('.website-link')) return;
            openModal(parseInt(row.dataset.idx));
        });
    });
}

function renderError(msg) {
    dom.emptyState.style.display = 'flex';
    dom.emptyState.innerHTML = `
        <div class="empty-icon" style="color:var(--red)"><i class="fa-solid fa-triangle-exclamation"></i></div>
        <p class="empty-title" style="color:var(--red)">SCAN ERROR</p>
        <p class="empty-sub">${escHtml(msg)}</p>
    `;
}

// ─── MODAL ────────────────────────────────────────────
function openModal(idx) {
    const biz = state.results[idx];
    if (!biz) return;

    dom.modalScore.textContent  = biz.score;
    dom.modalScore.className    = `modal-score-badge ${scoreClass(biz.score)}`;
    dom.modalName.textContent   = biz.name;
    dom.modalAddress.textContent = biz.formatted_address || 'Address not available';

    // Maps link
    dom.modalMapsLink.href = biz.url || `https://maps.google.com/search?q=${encodeURIComponent(biz.name)}`;

    // Website link
    if (biz.website) {
        dom.modalWebsiteLink.href  = biz.website;
        dom.modalWebsiteLink.style.display = 'inline-flex';
    } else {
        dom.modalWebsiteLink.style.display = 'none';
    }

    // Prospect button
    const isProspect = state.prospects.has(idx);
    dom.modalContactBtn.innerHTML = isProspect
        ? '<i class="fa-solid fa-check"></i> MARKED AS PROSPECT'
        : '<i class="fa-solid fa-paper-plane"></i> MARK AS PROSPECT';
    dom.modalContactBtn.onclick = () => toggleProspect(idx);

    // Body content
    dom.modalBody.innerHTML = `
        <div>
            <p class="modal-section-title">// OPPORTUNITY SCORE BREAKDOWN</p>
            <div class="modal-stat-grid">
                <div class="modal-stat">
                    <span class="modal-stat-val" style="color:${biz.score >= 50 ? 'var(--red)' : biz.score >= 30 ? 'var(--yellow)' : 'var(--cyan)'}">${biz.score}</span>
                    <span class="modal-stat-label">OPP SCORE</span>
                </div>
                <div class="modal-stat">
                    <span class="modal-stat-val">${biz.rating || '—'}</span>
                    <span class="modal-stat-label">RATING</span>
                </div>
                <div class="modal-stat">
                    <span class="modal-stat-val">${biz.user_ratings_total || 0}</span>
                    <span class="modal-stat-label">REVIEWS</span>
                </div>
            </div>
        </div>
        <div>
            <p class="modal-section-title">// DEFICIENCY FLAGS</p>
            <div class="modal-flags-list">
                ${biz.flags.length
                    ? biz.flags.map(f => `
                        <div class="modal-flag-item flag-${f.tier}">
                            <i class="fa-solid ${flagIcon(f.tier)}"></i>
                            ${escHtml(f.label)} — ${flagExplain(f.label)}
                        </div>`).join('')
                    : '<div class="modal-flag-item" style="color:var(--text-dim)"><i class="fa-solid fa-circle-check" style="color:var(--green)"></i> No major flags detected</div>'
                }
            </div>
        </div>
        <div>
            <p class="modal-section-title">// CONTACT INFO</p>
            <div style="font-size:0.88rem;display:flex;flex-direction:column;gap:0.4rem">
                <div style="display:flex;gap:0.6rem;align-items:center">
                    <i class="fa-solid fa-phone" style="color:var(--purple-bright);width:14px"></i>
                    <span style="color:var(--text-light)">${biz.formatted_phone_number || '<span style="color:var(--text-dim)">Not listed</span>'}</span>
                </div>
                <div style="display:flex;gap:0.6rem;align-items:center">
                    <i class="fa-solid fa-globe" style="color:var(--purple-bright);width:14px"></i>
                    <span style="color:var(--text-light)">${biz.website || '<span style="color:var(--red)">No website</span>'}</span>
                </div>
                <div style="display:flex;gap:0.6rem;align-items:start">
                    <i class="fa-solid fa-location-dot" style="color:var(--purple-bright);width:14px;margin-top:3px"></i>
                    <span style="color:var(--text-light)">${biz.formatted_address || 'No address'}</span>
                </div>
            </div>
        </div>
    `;

    dom.modalBackdrop.classList.add('open');
}

dom.modalClose.addEventListener('click', closeModal);
dom.modalBackdrop.addEventListener('click', e => {
    if (e.target === dom.modalBackdrop) closeModal();
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
});

function closeModal() {
    dom.modalBackdrop.classList.remove('open');
}

function toggleProspect(idx) {
    if (state.prospects.has(idx)) {
        state.prospects.delete(idx);
        dom.modalContactBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> MARK AS PROSPECT';
    } else {
        state.prospects.add(idx);
        dom.modalContactBtn.innerHTML = '<i class="fa-solid fa-check"></i> MARKED AS PROSPECT';
    }
}

// ─── EXPORT CSV ───────────────────────────────────────
dom.exportBtn.addEventListener('click', () => {
    if (!state.results.length) return;

    const headers = ['Score', 'Business Name', 'Address', 'Phone', 'Website', 'Rating', 'Reviews', 'Flags'];
    const rows    = state.results.map(b => [
        b.score,
        `"${(b.name || '').replace(/"/g, '""')}"`,
        `"${(b.formatted_address || '').replace(/"/g, '""')}"`,
        b.formatted_phone_number || '',
        b.website || '',
        b.rating || '',
        b.user_ratings_total || 0,
        `"${b.flags.map(f => f.label).join(', ')}"`,
    ]);

    const csv  = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `flecha-leads-${datestamp()}.csv`;
    a.click();
});

// ─── CLEAR ────────────────────────────────────────────
dom.clearBtn.addEventListener('click', clearResults);

function clearResults() {
    state.results = [];
    state.prospects.clear();
    dom.resultsTableBody.innerHTML = '';
    dom.tableWrap.style.display    = 'none';
    dom.emptyState.style.display   = 'flex';
    dom.emptyState.innerHTML = `
        <div class="empty-icon"><i class="fa-solid fa-satellite-dish"></i></div>
        <p class="empty-title">NO SCAN INITIATED</p>
        <p class="empty-sub">Configure your search parameters above and click INITIATE SCAN — or try DEMO MODE to preview the interface.</p>
    `;
    dom.exportBtn.style.display    = 'none';
    dom.resultsCount.textContent   = '0 targets found';
}

// ─── PROGRESS HELPERS ─────────────────────────────────
function showProgress(pct, label) {
    dom.progressWrap.style.display = 'block';
    dom.progressBar.style.width    = pct + '%';
    dom.progressLabel.textContent  = label;
}

function hideProgress() {
    dom.progressWrap.style.display = 'none';
}

function setScanIndicator(active) {
    dom.scanIndicator.className = active ? 'scan-indicator scanning' : 'scan-indicator';
    dom.scanIndicator.innerHTML = active
        ? '<span class="dot"></span><span>SCANNING</span>'
        : '<span class="dot"></span><span>IDLE</span>';
}

// ─── UTILITY HELPERS ──────────────────────────────────
function scoreClass(score) {
    if (score >= 50) return 'score-hot';
    if (score >= 25) return 'score-warm';
    return 'score-cold';
}

function starStr(rating) {
    const full  = Math.floor(rating);
    const half  = rating % 1 >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

function shortUrl(url) {
    return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').substring(0, 22) + (url.length > 22 ? '…' : '');
}

function shortAddress(addr) {
    return addr.split(',').slice(0, 2).join(',');
}

function primaryType(types) {
    if (!types || !types.length) return 'business';
    const skip = ['establishment', 'point_of_interest', 'store', 'food'];
    const best  = types.find(t => !skip.includes(t)) || types[0];
    return best.replace(/_/g, ' ');
}

function flagIcon(tier) {
    if (tier === 'red')    return 'fa-circle-xmark';
    if (tier === 'yellow') return 'fa-triangle-exclamation';
    return 'fa-circle-minus';
}

function flagExplain(label) {
    const map = {
        'NO WEBSITE':    'High priority — no web presence at all',
        'ZERO REVIEWS':  'Invisible online — no social proof',
        'FEW REVIEWS':   'Weak online credibility',
        'LOW REVIEWS':   'Below average review volume',
        'LOW RATING':    'Poor reputation signals weakness',
        'NO PHONE':      'Missing contact info on listing',
        'NO PHOTOS':     'Uncustomized listing, low engagement',
        'DATED SITE':    'Website may be outdated',
        'CLOSED':        'Business may no longer be operating',
    };
    return map[label] || 'Signals website improvement opportunity';
}

function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function datestamp() {
    return new Date().toISOString().slice(0, 10);
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}
