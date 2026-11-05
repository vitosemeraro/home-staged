/* ============================================================
   staged.ai — homepage studio engine (demo → app bootstrap)
   Ported verbatim from landing.html's proven pipeline:
   real /gemini-analyze + /stage-image, anonGenerations rate-limit,
   recordGeneration, and passwordless magic link whose return URL is
   app.html?bootstrap={anonId}. app.html's _handleLandingBootstrap
   then creates the editable project. Contract unchanged.
   Loaded only on index.html (IT + EN). Requires the Firebase module
   in <head> exposing window._fb*.
   ============================================================ */
(function () {
  'use strict';
  var studioRoot = document.getElementById('studio');
  if (!studioRoot) return;
  var EN = document.documentElement.lang === 'en';

  // ── config (mirror of landing.html) ───────────────────────
  var BACKEND_URL = 'https://homestager-backend-833352316081.europe-west1.run.app';
  var STAGED_SECRET = 'hs_beta_2025_v1';
  // Return URL = the APP (app.html) in the same folder, with ?bootstrap={anonId}.
  var APP_URL = (function () {
    var folder = location.pathname.replace(/[^/]*$/, '');     // strip filename, keep trailing slash
    // EN pages live in /en/ — the app is one level up at /app.html
    if (/\/en\/$/.test(folder)) return location.origin + folder.replace(/en\/$/, '') + 'app.html';
    return location.origin + folder + 'app.html';
  })();

  var LOADING_MESSAGES = EN ? [
    'Analysing the room with Gemini…',
    'Identifying furniture and potential…',
    'Computing works and local costs…',
    'Generating the final staged photo…'
  ] : [
    'Analizzo la stanza con Gemini…',
    'Identifico arredi e potenziale…',
    'Calcolo interventi e costi locali…',
    'Genero la foto staged finale…'
  ];

  // rotating value stats shown during the wait (qualitative, industry-sourced framing)
  var STATS = EN ? [
    'Listings with <b>professional photos</b> attract more views online.',
    'Home staging is linked to <b>shorter time on market</b> (industry estimates).',
    'Better photos mean <b>more viewing requests</b> on property portals.',
    'A polished presentation helps buyers <b>perceive higher value</b>.'
  ] : [
    'Gli annunci con <b>foto professionali</b> attirano più visualizzazioni online.',
    'Lo staging è associato a <b>tempi di vendita più brevi</b> (stime di settore).',
    'Foto migliori significano <b>più richieste di visita</b> sui portali.',
    'Una presentazione curata aiuta a <b>percepire più valore</b> dell\'immobile.'
  ];

  var DEFAULT_SYS = `Sei un Interior Designer senior italiano specializzato in home staging per affitti brevi e case vacanza.
Hai occhio critico: valuti ogni stanza, elimini il superfluo, sostituisci con arredi di design accessibili (IKEA, H&M Home, Zara Home, Maisons du Monde).
Conosci i prezzi reali delle principali città italiane.
Applichi sempre e solo lo stile scelto in modo coerente tra tutte le stanze.
Rispondi ESCLUSIVAMENTE con un oggetto JSON valido. Nessun testo prima o dopo. Nessun markdown. Nessun backtick.
Per i bagni: vasca e doccia sono elementi strutturali da MANTENERE o MIGLIORARE, mai eliminare. Se la vasca è datata o mal posizionata, proponi sostituzione con modello moderno (vasca freestanding o box doccia walk-in), includendo opere murarie (€300-800), idraulico (€500-1500), posa (€400-1200). Non rimuovere mai vasca o doccia senza sostituirla con un elemento equivalente o superiore visibile nella foto staged.
Per le camere da letto: il letto deve essere SEMPRE vestito con biancheria di qualità fotografica — piumone bianco soffice gonfio, federe bianche stirate, almeno 4-6 cuscini stratificati (2 bianchi + 2-4 decorativi in lino/velluto/cotone), throw/plaid testurizzato drappeggiato naturalmente ai piedi o sul lato. Mai mostrare un letto spoglio, con materasso nudo o con copriletto piatto e anonimo. Standard: hotel boutique 4 stelle.
PER I MONOLOCALI: se la stanza contiene una cucina/angolo cottura visibile, NON inserire un letto matrimoniale al centro — il letto va in zona notte separata o usa un divano letto. Il living area con cucina visibile richiede divano, tavolo, sedie — mai un letto in primo piano davanti ai fornelli.
REGOLA GEOMETRIA: porte, finestre, travi, colonne, scale, aperture murarie sono elementi strutturali INVARIABILI. Non devono mai essere rimossi, spostati o ostruiti nel prompt_staged. INCLUDI esplicitamente: porte a scomparsa, porte scorrevoli, porte pieghevoli — specificare nel prompt_staged "Keep the sliding/pocket door in exact position and fully unobstructed." Se un mobile viene proposto vicino a una porta, deve lasciare almeno 90cm di spazio libero.
REGOLA ASSOLUTA — ELETTRODOMESTICI, SANITARI E BUILT-IN: frigorifero, piano cottura, forno, lavastoviglie, lavatrice, vasca, doccia, wc, bidet, lavabo, lavello, cappa, termosifoni, infissi fissi vanno SEMPRE mantenuti nella posizione esatta. Non spostarli, non rimuoverli, non sostituirli SALVO esplicita richiesta dell'utente. Puoi aggiornarne lo stile visivo (colore, finitura) ma la posizione e la presenza sono invariabili.
PER I PUNTI LUCE: ogni volta che proponi nuovi punti luce, applique, faretti o lampadari a soffitto che richiedono nuova alimentazione elettrica, DEVI aggiungere un intervento separato "Opere elettriche" con costo €80-200 per punto luce (impianto + elettricista). Non proporre mai un punto luce senza il corrispondente intervento elettrico.
COERENZA ANALISI-FOTO: se un intervento propone la rimozione di un mobile (es. "rimozione armadio a ponte"), il prompt_staged DEVE esplicitamente escluderlo: "Remove the wardrobe completely — it must NOT appear in the generated image." Se non puoi garantire la rimozione, NON proporla come intervento.`;

  var DEFAULT_USER = `Analizza queste {n_foto} foto e produci una scheda di home staging per {destination}.

PARAMETRI:
- Budget totale: €{budget}
- Stile: {style}
- Città: {city}
- Destinazione: {destination}

REGOLE OBBLIGATORIE:
- BUDGET TOTALE APPARTAMENTO: €{budget} per tutte le {n_foto} stanze.
- Budget indicativo per stanza: €{budget} / {n_foto} stanze = €{budget_per_stanza} per stanza.
- PRIMA di scrivere i costi, calcola: somma_attuale = somma di tutti i costo_totale_stanza. Se somma_attuale > €{budget}, riduci proporzionalmente TUTTI i costi.
- REGOLA FERREA: SOMMA(costo_totale_stanza) <= €{budget}. Se hai {n_foto} stanze e budget €{budget}, ogni stanza NON può avere costi > €{budget}/{n_foto} in media.
- Ogni intervento nel preventivo DEVE corrispondere a qualcosa di visibile nel prompt_staged. Se non è nel preventivo non metterlo nel render e viceversa.
- Applica {style} in modo coerente in ogni stanza: stessa palette, stessa luce, stesso tono fotografico.
- Per ogni elemento presente (mobili, pittura, pavimenti, sanitari, elettrodomestici, infissi) decidi: rimuovi / mantieni / sostituisci.
- Rimuovi SEMPRE: sacchi spazzatura, cavi in vista, oggetti abbandonati, elementi disturbanti.
- Se il budget lo consente: sostituisci mobili brutti o sovradimensionati con pezzi IKEA moderni.
- Aggiungi obbligatoriamente: tessili (tappeti, cuscini, tende, copriletto), piante, lampade, quadri, vasi, complementi decorativi coerenti con {style}.
- ELETTRODOMESTICI E BUILT-IN: frigorifero, piano cottura, forno, lavastoviglie, lavatrice, cappa — mantieni SEMPRE in posizione esatta a meno che l'utente non chieda esplicitamente di spostarli o sostituirli. Stessa regola per sanitari (vasca, doccia, wc, bidet, lavabo) e infissi fissi.
- Il prompt_staged deve contenere esplicitamente: "Keep refrigerator, stove, built-in appliances, sanitary fixtures in exact position — do not remove or relocate unless explicitly requested."
- Inquadratura: wide angle da angolo, luce naturale soft, bright and airy, 8k.

BUDGET RULE — FONDAMENTALE: il budget €{budget} è il TOTALE per TUTTO l'appartamento ({n_foto} stanze).
  - Distribuisci il budget tra le stanze proporzionalmente alla loro dimensione e priorità di intervento.
  - Budget per stanza ≈ €{budget} / {n_foto} stanze. Non superare mai €{budget} come somma di tutti i costo_totale_stanza.
  - Budget medio per stanza ≤ €1500: solo cosmetico (tessili, complementi, lampada, piante). NO mobili nuovi strutturali.
  - Budget medio per stanza €1500-3000: puoi aggiungere 1-2 mobili chiave per stanza.
  - Budget medio per stanza > €3000: trasformazione più ampia.
  - Il prompt_staged deve essere COERENTE con il budget ALLOCATO a quella stanza.

REGOLA PITTURA — CRITICA: La tinteggiatura professionale a Milano costa €150-400 minimo per stanza.
  - Se budget per stanza < €300: NON includere tinteggiatura. Zero. Usa le pareti esistenti così come sono.
  - Se budget per stanza €300-500: includi pittura SOLO se le pareti sono visibilmente danneggiate/scrostate/macchiate. Altrimenti NO.
  - Se budget per stanza > €500: puoi includere tinteggiatura se migliora significativamente l'aspetto.
  - Quando non includi pittura, il prompt_staged deve specificare: "Keep existing wall color unchanged."
  - Non includere mai pittura solo per "stile" se il budget non lo permette realisticamente.

Per ogni stanza includi nel campo "prompt_staged" un prompt in inglese (max 100 parole):
  - Inizia con: "Interior design photo edit on a budget of €{budget}. Transform this room into {style} style."
  - In base al budget, elenca SOLO gli interventi realizzabili (es. budget basso = add rug, change lamp, add plants and textiles, decorative cushions).
  - Specifica colore pareti esatto.
  - Tessili e complementi stile {style} in linea col budget.
  - Chiudi con: "Keep exact room geometry. Professional real estate photo, soft natural light, wide angle corner shot, 8k."

Restituisci SOLO questo JSON:
{{
  "valutazione_generale": "analisi dettagliata",
  "punti_di_forza": ["p1"],
  "criticita": ["c1 — elemento specifico"],
  "stanze": [
    {{
      "nome": "Soggiorno",
      "indice_foto": 0,
      "stato_attuale": "descrizione con giudizio su ogni elemento",
      "elementi_da_rimuovere": ["elemento — motivazione"],
      "elementi_da_mantenere": ["elemento — motivazione"],
      "interventi": [
        {{ "titolo": "Sostituzione divano", "dettaglio": "IKEA UPPLAND 3 posti lino naturale", "costo_min": 400, "costo_max": 600, "priorita": "alta", "dove_comprare": "IKEA" }}
      ],
      "costo_totale_stanza": 750,
      "prompt_staged": "Interior design photo edit. Transform this room into {style} style. Keep exact room geometry. Professional real estate photo, soft natural light, wide angle corner shot, 8k."
    }}
  ],
  "riepilogo_costi": {{ "totale": 750, "budget_residuo": 250, "nota_budget": "commento" }}
}}`;

  // ── 4 finalità — prompt verbatim da app.html (allineate al prodotto) ──
  var FINALITA = {
    staging: {
      en: 'TASK: Home Staging for short-term rental or sale — NO structural works. Replace/remove dated furniture, add hotel-quality textiles (rugs, cushions, curtains, layered bedding), plants, artwork, warm lighting, decorative accessories. Repaint walls ONLY if budget allows (min €150/room) AND walls are damaged. Budget-driven IKEA/equivalent furniture. NO demolition, NO new flooring, NO plumbing. Result: professional Airbnb hero shot.'
    },
    ristrutturazione: {
      en: 'TASK: Full Renovation — completely renew the room as much as the budget allows, in ORDER OF VISUAL IMPACT: new flooring, fresh wall finishes and paint, new wall/floor tiles, renovated kitchen units, renovated bathroom fixtures and sanitary ware, updated lighting, and complete furniture replacement; re-optimise the furniture layout for the best photographic result. CRITICAL — STRUCTURAL PRESERVATION (non-negotiable): keep the EXACT room geometry, wall positions, ceiling height and camera perspective, and keep EVERY architectural opening EXACTLY as in the original photo — every door stays a door in its exact position, every window stays a window in its exact position. NEVER convert a door into a window or a window into a door; NEVER add, remove, move, resize or relocate any door, window, arch, niche or opening. The result must clearly be the SAME room, fully renovated — magazine-ready.'
    },
    svuota: {
      photo: true,
      en: 'TASK: Empty the Room (light virtual decluttering). FUNDAMENTAL PRINCIPLE: you may ONLY SUBTRACT things from this photo, NEVER ADD anything. The result must contain FEWER elements than the original, never more. If you are about to draw something that is not in the original photo, STOP — that is forbidden. REMOVE every movable furnishing and free-standing object: sofas, armchairs, beds, tables, chairs, desks, freestanding wardrobes, sideboards, dressers, bookshelves, freestanding cabinets, rugs, curtains, cushions, bedding, lamps, decorations, plants, clutter. EXPLICITLY PRESERVE all BUILT-IN / FITTED elements in their EXACT position and size: fitted kitchens (ALL wall cabinets, base cabinets, oven column, fridge column, sink unit, countertop, splashback, built-in appliances), built-in wardrobes embedded in the wall, wall-mounted shelving fixed to the wall, fixed radiators, and bathroom sanitary ware (toilet, bidet, sink, shower, bathtub, tiles). These are part of the building and MUST remain unchanged. CRITICAL — DO NOT alter the building itself: keep the EXACT existing wall color and finish (do NOT repaint, do NOT change white walls to any other color), keep the EXACT existing floor (do NOT change material or color), keep the ceiling, and keep every window and door EXACTLY as they are. ABSOLUTE RULE ABOUT THE SPACE BEHIND REMOVED FURNITURE: when you remove a freestanding wardrobe, cabinet or any large free-standing item, the wall behind it is a PLAIN CONTINUOUS WALL. Fill that area with the same plain wall (same color and finish) and the same floor. You must NOT invent or add ANY new door, doorway, window, opening, niche, shutter, blind, wooden panel, arch or passage where the furniture used to be — furniture hides plain wall, never an opening. DO NOT add anything new anywhere. Reconstruct the floor and wall surfaces revealed behind removed furniture so the EXISTING flooring and EXISTING wall color continue naturally and seamlessly as a flat empty wall. The wall behind a removed item must stay in its ORIGINAL 3D depth — never advance it forward to fill the space the furniture occupied. Correct exposure and white balance; the photographic atmosphere and lighting style are specified separately below.',
      enAnalysis: 'TASK: Estimate the cost of CLEARING and EMPTYING this room. The interventi must be removal/clearing activities only: furniture disassembly, removal and transport, bulky-waste disposal fees, labor hours for clearing, optional minor wall/floor touch-up after furniture removal. Do NOT include any staging, furniture purchase, decoration or renovation cost. Prices realistic for the Italian market.'
    },
    foto: {
      photo: true,
      en: 'TASK: Professional photo refinement and decluttering of this SAME room — you MUST actively improve the photo, not return it unchanged. PERFORM THESE ACTIONS (all of them, visibly): (1) DECLUTTER: remove clutter, trash, loose cables, chargers, papers, toiletries, dirty dishes, remote controls, personal photos and any small distracting objects from every surface and the floor; (2) TIDY: straighten everything that is crooked or messy — straighten leaning candles, picture frames and lamps; pull taut, iron and neatly drape crumpled or sagging curtains; smooth out wrinkled rugs; align cushions; (3) MAKE THE BED neatly with the existing bedding, hotel-style, if a bed is present; (4) STRAIGHTEN sofa throws and blankets if messy, using the existing textiles; (5) PHOTO ENHANCEMENT: noticeably improve the shot — increase brightness and clarity, correct exposure and white balance, boost the natural light, recover shadow detail, sharpen, fix lens distortion, and straighten the verticals/horizon for a clean professional real-estate look. The output MUST look clearly cleaner, brighter and more professional than the input — a visible before/after difference. CONSTRAINTS (keep the room recognisably the same): do NOT add new furniture, plants, artwork, cushions, rugs or decorations that were not already there; do NOT repaint walls; do NOT change flooring; do NOT replace or relocate the existing furniture.'
    }
  };

  // geometry / placement clauses (verbatim da app.html runPipeline)
  var GEOM_INIT = ' CRITICAL GEOMETRY: preserve exact room proportions, ceiling height, wall widths, floor area and perspective. WALL POSITIONS ARE FIXED: every wall must stay in its EXACT original 3D position. Do NOT move any wall forward, backward, left or right. Do NOT shrink, expand, narrow or widen the room. When a piece of furniture is removed, the space it occupied must remain EMPTY — do NOT fill that volume by advancing the wall behind it. Preserve ALL architectural elements in exact position: every door, window, beam, column, wall opening, radiator. Do NOT add any new door, window, shutter or opening that is not already present. SCENE BOUNDARY: only the room visible in the original photo is being treated; leave any adjacent space glimpsed through a doorway EXACTLY as it appears.';
  var GEOM_PHOTO_INIT = ' Keep the room layout, proportions, architecture, furniture and camera framing the same as the original — do NOT change the shape or size of the room and do NOT move or add walls, windows or doors. You MAY and SHOULD improve the photographic quality (light, exposure, sharpness, vertical/horizon straightening).';
  var PLACEMENT_INIT = ' FURNITURE PLACEMENT RULES: never place the bed, sofa or any large furniture in front of a door, doorway, window or wardrobe — keep all doors, passages and windows fully clear and accessible. Respect circulation space and realistic interior layout. Do not block any opening.';
  var GEOM_STAGING = ' CRITICAL GEOMETRY: preserve exact room proportions, ceiling height, wall widths, floor area and perspective. Do NOT compress, stretch or alter spatial volumes. The room must look exactly the same size and shape as the original photo. Preserve ALL architectural elements in exact position: every door, window, beam, column, wall opening, radiator. Do NOT invent new openings, walls or structural features. Professional real estate photography, wide angle corner shot, 8k resolution.';

  function finPhotoTransform(k){ return k === 'foto' || k === 'svuota'; }

  // Build the staged-image prompt for one photo, mirroring app.html runPipeline.
  function photoStyleEN(ps) {
    switch ((ps || '').toLowerCase()) {
      case 'caldo': case 'warm': return ' Warm golden-hour light, cosy inviting atmosphere, true-to-life colours, well-lit (never dark).';
      case 'naturale': case 'natural': return ' Natural balanced daylight, neutral white balance, realistic colours, bright and clean.';
      case 'editoriale': case 'editorial': return ' Refined editorial real-estate lighting, gentle contrast, crisp and clean — bright and well-exposed, never dark or moody.';
      default: return ' Bright and airy, soft natural daylight, well-lit and clean.';
    }
  }
  function buildStagedPrompt(finKey, prefs, room) {
    var fin = FINALITA[finKey] || FINALITA.staging;
    var style = prefs.style || 'modern';
    var photoClause = photoStyleEN(prefs.photoStyle);
    if (finPhotoTransform(finKey)) {
      var geomClause = (finKey === 'foto') ? GEOM_PHOTO_INIT : GEOM_INIT;
      var emptyMode = (finKey === 'svuota' && prefs.emptyFull)
        ? ' EMPTY MODE OVERRIDE: also remove fitted/built-in furniture (built-in kitchens with all cabinets/oven & fridge columns/sink/countertop, built-in wardrobes, wall shelving, bathroom sanitary ware) — leave the room completely bare: only walls, floor and ceiling.'
        : '';
      var wallLock = (finKey === 'svuota')
        ? ' ABSOLUTELY keep the EXACT existing wall colour and finish and the EXACT existing floor: do NOT repaint, recolour or tint the walls, do NOT change the floor material or colour.'
        : '';
      return fin.en + emptyMode + wallLock + geomClause + photoClause;
    }
    var gem = ((room && room.prompt_staged) ? String(room.prompt_staged) : '').replace(/\{style\}/g, style);
    var styleReinforce = 'Strictly apply ' + style + ' interior design style throughout.';
    var budgetConstraint = 'Budget: €' + (prefs.budget || 8000) + ' for this room. Use the budget by priority of visual impact for the best photographic result. Keep all fixed appliances, plumbing, doors, windows and structural elements in their exact position.';
    var tail = styleReinforce + ' ' + gem + ' ' + budgetConstraint + photoClause + PLACEMENT_INIT + GEOM_STAGING;
    return fin.en + ' ' + tail;
  }

  // ── major Italian cities for the autocomplete ──
  var CITIES = ['Roma','Milano','Napoli','Torino','Palermo','Genova','Bologna','Firenze','Bari','Catania','Venezia','Verona','Messina','Padova','Trieste','Brescia','Parma','Taranto','Prato','Modena','Reggio Calabria','Reggio Emilia','Perugia','Ravenna','Livorno','Cagliari','Foggia','Rimini','Salerno','Ferrara','Sassari','Latina','Giugliano in Campania','Monza','Siracusa','Pescara','Bergamo','Forlì','Trento','Vicenza','Terni','Bolzano','Novara','Piacenza','Ancona','Andria','Arezzo','Udine','Cesena','Lecce','Pesaro','Como','La Spezia','Lucca','Catanzaro'];

  // ── anon id ───────────────────────────────────────────────
  function genAnonId() {
    if (window.crypto && window.crypto.randomUUID) { try { return 'anon_' + window.crypto.randomUUID(); } catch (e) {} }
    return 'anon_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11) + Math.random().toString(36).slice(2, 11);
  }
  function getAnonId() {
    var id = localStorage.getItem('staged_anon_id');
    if (!id) { id = genAnonId(); localStorage.setItem('staged_anon_id', id); }
    return id;
  }
  function whenFbReady() {
    return new Promise(function (resolve) {
      if (window._fbReady) { resolve(); return; }
      document.addEventListener('fbready', function () { resolve(); }, { once: true });
      setTimeout(function () { resolve(); }, 5000);
    });
  }
  function track(ev) { try { if (window.clarity) window.clarity('event', ev); if (window.dataLayer) window.dataLayer.push({ event: ev }); } catch (e) {} }
  function authHeaders() { return { 'Content-Type': 'application/json', 'X-Staged-Token': STAGED_SECRET, 'X-User-UID': getAnonId() }; }

  // ── image helpers ─────────────────────────────────────────
  function fileToB64(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { var res = r.result, c = res.indexOf(','); resolve({ b64: res.slice(c + 1), mime: file.type || 'image/jpeg', dataUrl: res }); };
      r.onerror = function () { reject(new Error('FileReader error')); };
      r.readAsDataURL(file);
    });
  }
  function compressImage(dataUrl, maxWidth, quality) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, maxWidth / img.naturalWidth);
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        var out = canvas.toDataURL('image/jpeg', quality), c = out.indexOf(',');
        resolve({ b64: out.slice(c + 1), mime: 'image/jpeg', dataUrl: out });
      };
      img.onerror = reject; img.src = dataUrl;
    });
  }
  async function compressForFirestore(b64, mime, targetKB) {
    if (!b64) return null; targetKB = targetKB || 400;
    var sizeBytes = Math.floor(b64.length * 3 / 4);
    if (sizeBytes <= targetKB * 1024) return { b64: b64, mime: mime };
    var dataUrl = 'data:' + (mime || 'image/jpeg') + ';base64,' + b64;
    var attempt = await compressImage(dataUrl, 1100, 0.78);
    var attemptBytes = Math.floor(attempt.b64.length * 3 / 4);
    var passes = [{ w: 1024, q: 0.72 }, { w: 960, q: 0.68 }, { w: 880, q: 0.62 }, { w: 800, q: 0.55 }];
    for (var i = 0; i < passes.length; i++) {
      if (attemptBytes <= targetKB * 1024) break;
      attempt = await compressImage(dataUrl, passes[i].w, passes[i].q);
      attemptBytes = Math.floor(attempt.b64.length * 3 / 4);
    }
    return { b64: attempt.b64, mime: 'image/jpeg' };
  }

  // ── rate limit + record (anonGenerations contract) ────────
  async function canGenerateAnonymously() {
    await whenFbReady();
    if (!window._fbDb) return true;
    try {
      var ref = window._fbDoc(window._fbDb, 'anonGenerations', getAnonId());
      var snap = await window._fbGetDoc(ref);
      if (!snap.exists()) return true;
      return ((snap.data() || {}).count || 0) < 1;
    } catch (e) { return true; }
  }
  async function recordGeneration(payload) {
    await whenFbReady();
    if (!window._fbDb) { console.error('[recordGeneration] Firestore not ready'); return false; }
    var anonId = getAnonId(), origForDoc = null, stagedForDoc = null;
    try {
      origForDoc = await compressForFirestore(payload.origB64, payload.origMime, 380);
      if (payload.stagedB64) stagedForDoc = await compressForFirestore(payload.stagedB64, payload.stagedMime, 380);
    } catch (e) {
      origForDoc = { b64: payload.origB64, mime: payload.origMime };
      stagedForDoc = payload.stagedB64 ? { b64: payload.stagedB64, mime: payload.stagedMime } : null;
    }
    var docData = {
      count: 1, lastGenAt: new Date().toISOString(), userAgent: (navigator.userAgent || '').slice(0, 200),
      prefs: payload.prefs || null, analysis: payload.analysis || null,
      stagedB64: stagedForDoc ? stagedForDoc.b64 : null, stagedMime: stagedForDoc ? stagedForDoc.mime : null,
      origB64: origForDoc ? origForDoc.b64 : null, origMime: origForDoc ? origForDoc.mime : null,
      origName: payload.origName || null
    };
    try {
      var ref = window._fbDoc(window._fbDb, 'anonGenerations', anonId);
      await window._fbSetDoc(ref, docData, { merge: true });
      console.log('[recordGeneration] saved', anonId);
      return true;
    } catch (e) { console.error('[recordGeneration] failed', e && e.message, e && e.code); return false; }
  }

  // ── analyze + generate ────────────────────────────────────
  function interp(tpl, vars) { return tpl.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] !== undefined ? vars[k] : '{' + k + '}'; }); }
  async function analyzePhoto(imgB64, imgMime, prefs, finKey) {
    var fin = FINALITA[finKey] || FINALITA.staging;
    var vars = { style: prefs.style, budget: prefs.budget, n_foto: 1, budget_per_stanza: prefs.budget, destination: 'affitto breve (Airbnb / Booking)', city: prefs.city || 'Italia' };
    var roomDetails = '[FOTO 0 — stanza] ' + (fin.enAnalysis || fin.en);
    var userPromptFinal = interp(DEFAULT_USER, vars) + '\n\nCONFIGURAZIONE STANZE:\n' + roomDetails;
    var payload = {
      system_instruction: { parts: [{ text: DEFAULT_SYS }] },
      contents: [{ role: 'user', parts: [{ inline_data: { mime_type: imgMime, data: imgB64 } }, { text: userPromptFinal }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 65536, responseMimeType: 'application/json' }
    };
    var res = await fetch(BACKEND_URL + '/gemini-analyze', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ payload: payload, model: 'gemini-2.5-flash' }) });
    if (!res.ok) { var err = await res.json().catch(function () { return {}; }); throw new Error((err && err.detail) || ('HTTP ' + res.status)); }
    var data = await res.json();
    var raw = (((data || {}).candidates || [])[0] || {}).content && data.candidates[0].content.parts[0].text || '';
    var clean = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```\s*$/, '').trim();
    return JSON.parse(clean);
  }
  var GEMINI_IMG_MODELS = ['gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image', 'gemini-3-pro-image-preview'];
  async function generateStaged(imgB64, imgMime, promptEn) {
    var payload = { contents: [{ parts: [{ inline_data: { mime_type: imgMime, data: imgB64 } }, { text: promptEn }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } };
    var lastErr = '';
    for (var i = 0; i < GEMINI_IMG_MODELS.length; i++) {
      var model = GEMINI_IMG_MODELS[i];
      try {
        var r = await fetch(BACKEND_URL + '/stage-image', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ model: model, payload: payload }) });
        var d = await r.json();
        if (d.error) { lastErr = model + ': ' + d.error.message; continue; }
        var parts = (((d || {}).candidates || [])[0] || {}).content && d.candidates[0].content.parts || [];
        var imgPart = parts.find(function (p) { var id = p.inline_data || p.inlineData; return id && (id.mime_type || id.mimeType || '').indexOf('image/') === 0; });
        if (!imgPart) { lastErr = model + ': no image'; continue; }
        var idd = imgPart.inline_data || imgPart.inlineData;
        return { b64: idd.data, mime: idd.mime_type || idd.mimeType || 'image/png' };
      } catch (e) { lastErr = model + ': ' + e.message; }
    }
    var res = await fetch(BACKEND_URL + '/stage-image', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ photo_b64: imgB64, photo_mime: imgMime, prompt: promptEn }) });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error((data.detail || 'Backend error') + ' — chain err: ' + lastErr);
    if (!data.image_b64) throw new Error('No image returned from backend');
    return { b64: data.image_b64, mime: 'image/png' };
  }

  // ── magic link (return → app.html?bootstrap=anonId) ───────
  async function sendMagicLink(email) {
    await whenFbReady();
    if (!window._fbAuth || !window._fbSendSignInLinkToEmail) throw new Error(EN ? 'Auth service unavailable. Try again shortly.' : 'Servizio di autenticazione non disponibile. Riprova tra un momento.');
    var url = APP_URL + '?bootstrap=' + encodeURIComponent(getAnonId());
    await window._fbSendSignInLinkToEmail(window._fbAuth, email, { url: url, handleCodeInApp: true });
    localStorage.setItem('emailForSignIn', email);
    localStorage.setItem('staged_bootstrap_anonId', getAnonId());
  }

  // ════════════════════════════════════════════════════════
  // CONTROLLER — wires the new design's studio DOM
  // ════════════════════════════════════════════════════════
  var $ = function (id) { return document.getElementById(id); };
  var state = { file: null, fileB64: null, fileMime: null, fileDataUrl: null, stagedDataUrl: null, saved: false };

  var fileInput = $('hs-file'), drop = $('hs-drop'), preview = $('hs-preview'),
      pvThumb = $('hs-preview-thumb'), pvName = $('hs-preview-name'),
      cityInput = $('hs-city'), genBtn = $('hs-generate'),
      loading = $('hs-loading'), loadMsg = $('hs-loading-msg'), loadBar = $('hs-loading-bar'),
      result = $('hs-result'), resultImg = $('hs-result-img'), resultToggle = $('hs-result-toggle'),
      register = $('hs-register'), regForm = $('hs-register-form'), regEmail = $('hs-email'),
      regSent = $('hs-sent'), regSentEmail = $('hs-sent-email'),
      errBox = $('hs-error'), errText = $('hs-error-text');

  function showError(msg) { if (errText) errText.textContent = msg; if (errBox) errBox.style.display = 'block'; }
  function hideError() { if (errBox) errBox.style.display = 'none'; }
  function selectedStyle() {
    var on = document.querySelector('#hs-style .opt[aria-pressed="true"]');
    return on ? on.textContent.trim() : 'Japandi';
  }
  function selectedPhotoStyle() {
    var on = document.querySelector('#hs-photostyle .opt[aria-pressed="true"]');
    return on ? on.textContent.trim() : 'Bright & Airy';
  }
  function selectedFin() {
    var on = studioRoot.querySelector('.fin-pick .fp[aria-pressed="true"]');
    return (on && on.getAttribute('data-fin')) || 'staging';
  }
  function updateStudioForFin(fin) {
    var design = (fin === 'staging' || fin === 'ristrutturazione');
    var styleF = document.getElementById('hs-style-field');
    var photoF = document.getElementById('hs-photostyle-field');
    var budgetF = document.getElementById('hs-budget-field');
    var emptyF = document.getElementById('hs-empty-field');
    if (styleF) styleF.classList.toggle('hidden', !design);
    if (photoF) photoF.classList.toggle('hidden', design);
    if (budgetF) budgetF.classList.toggle('hidden', !design);
    if (emptyF) emptyF.classList.toggle('hidden', fin !== 'svuota');
  }
  function initCityAutocomplete() {
    if (!cityInput) return;
    var wrap = cityInput.parentNode; wrap.style.position = 'relative';
    var ac = document.createElement('div'); ac.className = 'hs-ac'; wrap.appendChild(ac);
    function hide() { ac.classList.remove('show'); ac.innerHTML = ''; }
    cityInput.addEventListener('input', function () {
      var q = cityInput.value.trim().toLowerCase();
      if (q.length < 2) { hide(); return; }
      var matches = CITIES.filter(function (c) { return c.toLowerCase().indexOf(q) === 0; }).slice(0, 6);
      if (!matches.length) { hide(); return; }
      ac.innerHTML = matches.map(function (c) { return '<button type="button" class="hs-ac__item">' + c + '</button>'; }).join('');
      ac.classList.add('show');
    });
    ac.addEventListener('mousedown', function (e) {
      var b = e.target.closest('.hs-ac__item'); if (!b) return;
      e.preventDefault(); cityInput.value = b.textContent; hide();
    });
    cityInput.addEventListener('blur', function () { setTimeout(hide, 150); });
  }

  if (drop && fileInput) {
    drop.addEventListener('click', function () { fileInput.click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('is-over'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('is-over'); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('is-over'); var f = e.dataTransfer.files[0]; if (f) handleFile(f); });
    fileInput.addEventListener('change', function (e) { if (e.target.files[0]) handleFile(e.target.files[0]); });
  }

  async function handleFile(file) {
    if (!file.type || file.type.indexOf('image/') !== 0) { showError(EN ? 'Invalid format. Use JPG or PNG.' : 'Formato non valido. Usa JPG o PNG.'); return; }
    if (file.size > 12 * 1024 * 1024) { showError(EN ? 'File too large. Max 12 MB.' : 'File troppo grande. Max 12 MB.'); return; }
    hideError(); state.file = file; track('home_upload');
    var url = URL.createObjectURL(file);
    if (pvThumb) pvThumb.style.backgroundImage = 'url(' + url + ')';
    if (pvName) pvName.textContent = file.name;
    try { var raw = await fileToB64(file); var small = await compressImage(raw.dataUrl, 1400, 0.92); state.fileB64 = small.b64; state.fileMime = small.mime; state.fileDataUrl = small.dataUrl; }
    catch (e) { var raw2 = await fileToB64(file); state.fileB64 = raw2.b64; state.fileMime = raw2.mime; state.fileDataUrl = raw2.dataUrl; }
    if (drop) drop.classList.add('hidden');
    if (preview) preview.classList.add('show');
  }
  var changeBtn = $('hs-change'); if (changeBtn) changeBtn.addEventListener('click', function () { fileInput.click(); });

  if (genBtn) genBtn.addEventListener('click', async function () {
    if (!state.fileB64) { showError(EN ? 'Upload a room photo first.' : 'Carica prima la foto di una stanza.'); return; }
    if (!cityInput || !cityInput.value.trim()) { showError(EN ? 'Enter a city.' : 'Inserisci una città.'); if (cityInput) cityInput.focus(); return; }

    var ok = await canGenerateAnonymously();
    if (!ok) {
      showError(EN ? 'You already used the free try. Register below for 10 free credits to continue.' : 'Hai già usato la prova gratuita. Registrati qui sotto per 10 crediti gratis e continuare.');
      if (register) { register.classList.remove('hidden'); register.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      track('home_quota_exceeded'); return;
    }
    hideError(); track('home_generate_start');
    var finKey = selectedFin();
    var style = selectedStyle(), city = cityInput.value.trim();

    var budgetEl = document.getElementById('hs-budget');
    var budget = (budgetEl && parseInt(budgetEl.value, 10)) || 8000;
    var emptyFull = !!(document.getElementById('hs-empty-full') && document.getElementById('hs-empty-full').checked);
    var statEl = document.getElementById('hs-loading-stat');

    if (loading) loading.classList.add('show');
    genBtn.disabled = true;
    var mi = 0, si = 0;
    if (loadMsg) loadMsg.textContent = LOADING_MESSAGES[0];
    if (loadBar) loadBar.style.width = '10%';
    if (statEl) statEl.innerHTML = STATS[0];
    var cycler = setInterval(function () {
      mi = Math.min(mi + 1, LOADING_MESSAGES.length - 1);
      if (loadMsg) loadMsg.textContent = LOADING_MESSAGES[mi];
      if (loadBar) loadBar.style.width = Math.min(95, (mi + 1) / LOADING_MESSAGES.length * 100) + '%';
      si = (si + 1) % STATS.length;
      if (statEl) statEl.innerHTML = STATS[si];
    }, 2200);

    var prefs = { style: style, city: city, budget: budget, photoStyle: selectedPhotoStyle(), destinazione: 'STR', palette: [], finalita: finKey, emptyFull: emptyFull };
    var analysis = null, staged = null;
    try {
      analysis = await analyzePhoto(state.fileB64, state.fileMime, prefs, finKey);
      var room = ((analysis && analysis.stanze) || [])[0] || {};
      var promptStaged = buildStagedPrompt(finKey, prefs, room);
      staged = await generateStaged(state.fileB64, state.fileMime, promptStaged);
      state.stagedDataUrl = 'data:' + staged.mime + ';base64,' + staged.b64;
    } catch (err) {
      clearInterval(cycler); if (loading) loading.classList.remove('show'); genBtn.disabled = false;
      console.error('[home-generate] failed:', err);
      track('home_generate_fail');
      showError(EN
        ? 'Generation failed — please try again in a moment. You can also register below for 10 free credits and continue in the app.'
        : 'Generazione non riuscita — riprova tra poco. Puoi anche registrarti qui sotto per 10 crediti gratis e continuare nell\'app.');
      if (register) register.classList.remove('hidden');
      return;
    }
    clearInterval(cycler); if (loading) loading.classList.remove('show'); genBtn.disabled = false;

    // Show result (before/after toggle)
    if (resultImg) resultImg.src = state.stagedDataUrl;
    if (result) { result.classList.add('show'); try { result.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} }
    track('home_generate_success');

    // Persist to anonGenerations so the app can bootstrap the project after login
    state.saved = await recordGeneration({
      prefs: prefs, analysis: analysis,
      stagedB64: staged.b64, stagedMime: staged.mime,
      origB64: state.fileB64, origMime: state.fileMime,
      origName: (state.file && state.file.name) || 'original.jpg'
    });
    if (register) register.classList.remove('hidden');
  });

  // before/after toggle on the result image
  if (resultToggle && resultImg) {
    var showingAfter = true;
    resultToggle.addEventListener('click', function () {
      showingAfter = !showingAfter;
      resultImg.src = showingAfter ? state.stagedDataUrl : state.fileDataUrl;
      resultToggle.textContent = showingAfter ? (EN ? 'Show before' : 'Mostra prima') : (EN ? 'Show after' : 'Mostra dopo');
    });
  }

  // register → magic link
  if (regForm) regForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = (regEmail.value || '').trim();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { showError(EN ? 'Enter a valid email.' : 'Inserisci un\'email valida.'); regEmail.focus(); return; }
    if (!state.saved) { showError(EN ? 'Hang on — your analysis is still saving. Try again in a moment.' : 'Aspetta un attimo che la tua analisi sia salvata, poi riprova.'); return; }
    var btn = regForm.querySelector('[type="submit"]'); var lbl = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = EN ? 'Sending…' : 'Invio in corso…'; }
    track('home_email_submitted');
    try {
      await sendMagicLink(email);
      if (regForm) regForm.style.display = 'none';
      if (regSentEmail) regSentEmail.textContent = email;
      if (regSent) regSent.classList.add('show');
    } catch (err) {
      showError((EN ? 'Could not send the link: ' : 'Impossibile inviare il link: ') + (err.message || ''));
      if (btn) { btn.disabled = false; btn.textContent = lbl; }
    }
  });

  var finPick = studioRoot.querySelector('.fin-pick');
  if (finPick) finPick.addEventListener('click', function (e) { var b = e.target.closest('.fp'); if (b) updateStudioForFin(b.getAttribute('data-fin') || 'staging'); });
  updateStudioForFin(selectedFin());

  initCityAutocomplete();
})();
