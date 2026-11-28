// selvinmejia.com — Worker de Cloudflare
// - Sirve el sitio estático (la raíz del repo, menos lo que lista .assetsignore).
// - /api/estado: revisa en vivo cada proyecto (código HTTP y latencia), lee el hallazgo del día
//   de aves.selvinmejia.com, los conteos anónimos de PacketLens (base D1 tshoot-datos, solo lectura)
//   (mired es privado: solo se revisa que el túnel responda) y el clima de Ciudad de Guatemala (Open-Meteo). Se guarda 60 s en la caché de Cloudflare.
// - www.selvinmejia.com redirige (301) a selvinmejia.com.
// - POST /api/evento: conteos anónimos del sitio (visitas, clics, terminal, huevos…) en la base D1 propia (DATOS).
// - /panel: panel privado con "Iniciar sesión con Google" (solo ADMIN_EMAIL). Se configura con configurar-panel.sh.

import { paginaEntrar, paginaPanel } from './panel.js';

const CANONICO = 'selvinmejia.com';
const CACHE_SEG = 30;

const SERVICIOS = [
    { id: 'aves', url: 'https://aves.selvinmejia.com/' },
    { id: 'packetlens', url: 'https://packetlens.selvinmejia.com/' },
    { id: 'netkit', url: 'https://netkit.selvinmejia.com/' },
    { id: 'secreto', url: 'https://secreto.selvinmejia.com/' },
    // Privado (Cloudflare Access): responde con el inicio de sesión (302/401/403) y eso cuenta como en línea.
    // Si el túnel o la iMac están apagados, Cloudflare responde 5xx (502, 530…) y se marca caído.
    { id: 'mired', url: 'https://mired.selvinmejia.com/', privado: true },
];

// Ciudad de Guatemala. Cámbialo si quieres el clima de otro lugar.
const CLIMA = { lat: 14.6349, lon: -90.5069, tz: 'America/Guatemala' };

const SEGURIDAD = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https://aves.selvinmejia.com",
        "connect-src 'self' https://*.selvinmejia.com",
        "font-src 'self'",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'",
    ].join('; '),
};

const json = (obj, extra = {}) =>
    new Response(JSON.stringify(obj), {
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...SEGURIDAD, ...extra },
    });

async function conLimite(promesa, ms, porDefecto = null) {
    let t;
    const limite = new Promise((r) => (t = setTimeout(() => r(porDefecto), ms)));
    try {
        return await Promise.race([promesa.catch(() => porDefecto), limite]);
    } finally {
        clearTimeout(t);
    }
}

// --------------------------------------------------------------- servicios
async function revisar(s) {
    const t0 = Date.now();
    try {
        const res = await fetch(s.url, {
            method: 'GET',
            redirect: 'manual',
            headers: { 'User-Agent': 'selvinmejia.com-noc/1.0' },
            signal: AbortSignal.timeout(6000),
            cf: { cacheTtl: 0 },
        });
        const ms = Date.now() - t0;
        // Solo leemos el cuerpo si lo necesitamos (aves); si no, lo cancelamos
        const ok = s.privado ? res.status < 500 : res.status < 400;
        return { id: s.id, ok, codigo: res.status, ms, res, ...(s.privado ? { privado: true } : {}) };
    } catch (e) {
        return { id: s.id, ok: false, codigo: 0, ms: Date.now() - t0, error: e.name === 'TimeoutError' ? 'timeout' : 'error' };
    }
}

// ------------------------------------------------------------ aves (meta og)
async function metaOg(res) {
    const meta = {};
    const rw = new HTMLRewriter().on('meta', {
        element(el) {
            const k = el.getAttribute('property') || el.getAttribute('name');
            if (k && /^(og:|description$)/.test(k)) meta[k] = el.getAttribute('content') || '';
        },
    });
    await rw.transform(res).arrayBuffer();
    return meta;
}

// "El hallazgo del día: Tórtola Turca (muy rara) · 6 especies · 14 detecciones."
function leerResumen(texto) {
    if (!texto) return null;
    const out = { texto: texto.trim() };
    const m = texto.match(/:\s*([^(·]+?)\s*(?:\(([^)]+)\))?\s*·\s*(\d+)\s*[^·\d]+·\s*(\d+)/);
    if (m) {
        out.hallazgo = m[1].trim();
        out.rareza = (m[2] || '').trim();
        out.especies = Number(m[3]);
        out.detecciones = Number(m[4]);
    }
    return out;
}

async function aves(resInicio) {
    const datos = { es: null, en: null, foto: null };
    const tareas = [];
    if (resInicio && resInicio.ok) {
        tareas.push(
            metaOg(resInicio).then((m) => {
                datos.es = leerResumen(m['og:description'] || m.description);
                datos.foto = m['og:image'] || null;
            }),
        );
    }
    tareas.push(
        fetch('https://aves.selvinmejia.com/en/', { signal: AbortSignal.timeout(6000), cf: { cacheTtl: 0 } })
            .then(async (r) => {
                if (!r.ok) return;
                const m = await metaOg(r);
                datos.en = leerResumen(m['og:description'] || m.description);
                datos.foto = datos.foto || m['og:image'] || null;
            })
            .catch(() => {}),
    );
    await Promise.all(tareas);
    return datos.es || datos.en ? datos : null;
}

// ------------------------------------------------ sonda de aves (estado público)
// Solo se exponen 4 datos: estado, minutos desde el último audio, batería y si está grabando.
function horaGTmin() {
    const d = new Date(Date.now() - 6 * 3600e3);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
}
async function sonda() {
    // Misma lógica que la página /sonda/ de aves.selvinmejia.com, pero con los minutos calculados
    // aquí a partir de las horas reales (no de un número que pudo quedar guardado).
    const r = await fetch('https://aves.selvinmejia.com/api/estado', { signal: AbortSignal.timeout(5000), cf: { cacheTtl: 0 } });
    if (!r.ok) return null;
    const d = await r.json();
    const t = d.telefono || {};
    const hace = (iso) => { const x = Date.parse(iso || ''); return Number.isFinite(x) ? Math.max(0, Math.round((Date.now() - x) / 60000)) : null; };
    const rep = t.ts ? hace(t.ts) : null;                  // minutos desde el último reporte del teléfono
    const aud = d.ultima_subida ? hace(d.ultima_subida) : null; // minutos desde el último audio
    let enHorario = true;
    const h = /^(\d{2})(\d{2})-(\d{2})(\d{2})$/.exec(t.horario || '');
    if (h) {
        const ahora = horaGTmin(), ini = +h[1] * 60 + +h[2], fin = +h[3] * 60 + +h[4];
        enHorario = ahora >= ini && ahora < fin;
    }
    let estado = 'escuchando';
    if (rep == null) estado = 'sin_datos';
    else if (rep > 25) estado = 'sin_senal';
    else if (enHorario && (t.sin_fuente_s != null || ((t.reinicios_1h ?? 0) > 60 && (aud == null || aud > 25)))) estado = 'app_cerrada';
    else if (enHorario && (aud == null || aud > 25)) estado = 'sin_audio';
    else if (!enHorario) estado = 'pausa';
    const fresco = rep != null && rep <= 25;   // la batería solo vale si el reporte es reciente
    return {
        estado,
        reporteMin: rep,
        audioMin: aud,
        bateria: fresco && Number.isFinite(t.bateria) ? t.bateria : null,
        cargando: fresco && /CHARG|FULL/i.test(String(t.estado_bateria || '')) && !/DISCHARG/i.test(String(t.estado_bateria || '')),
    };
}

// ------------------------------------------------ NetKit (D1 netkit-datos, solo lectura)
async function netkit(env) {
    if (!env.NETKIT) return null;
    try {
        const desde = diaGT(29);
        const [tot, top] = await env.NETKIT.batch([
            env.NETKIT.prepare("SELECT SUM(tipo = 'uso') AS usos, SUM(tipo = 'visita') AS visitas FROM eventos WHERE dia >= ?").bind(desde),
            env.NETKIT.prepare("SELECT herramienta AS k, COUNT(*) AS n FROM eventos WHERE dia >= ? AND tipo = 'uso' AND herramienta IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 1").bind(desde),
        ]);
        const t = (tot.results && tot.results[0]) || {};
        const f = top.results && top.results[0];
        return { usos30: t.usos || 0, visitas30: t.visitas || 0, top: f ? f.k : null };
    } catch (e) {
        console.log('netkit d1:', e.message);
        return null;
    }
}

// ------------------------------------------------ PacketLens (D1, solo lectura)
function diaGT(offsetDias = 0) {
    const d = new Date(Date.now() - 6 * 3600e3 - offsetDias * 86400e3);
    return d.toISOString().slice(0, 10);
}

async function packetlens(env) {
    if (!env.DB) return null;
    try {
        const desde = diaGT(29);
        const [mes, total] = await env.DB.batch([
            env.DB.prepare("SELECT tipo, COALESCE(SUM(n),0) AS n FROM conteo WHERE dia >= ? AND tipo IN ('analisis','visita') GROUP BY tipo").bind(desde),
            env.DB.prepare("SELECT COALESCE(SUM(n),0) AS n FROM conteo WHERE tipo = 'analisis'"),
        ]);
        const porTipo = Object.fromEntries((mes.results || []).map((r) => [r.tipo, r.n]));
        return {
            analisis30: porTipo.analisis || 0,
            visitas30: porTipo.visita || 0,
            analisisTotal: (total.results && total.results[0] && total.results[0].n) || 0,
        };
    } catch (e) {
        console.log('d1:', e.message);
        return null;
    }
}

// ------------------------------------------------------------------- clima
async function clima() {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${CLIMA.lat}&longitude=${CLIMA.lon}&current=temperature_2m,weather_code,is_day,relative_humidity_2m&timezone=${encodeURIComponent(CLIMA.tz)}`;
    const r = await fetch(u, { signal: AbortSignal.timeout(5000), cf: { cacheTtl: 600, cacheEverything: true } });
    if (!r.ok) return null;
    const j = await r.json();
    const c = j.current || {};
    return { temp: c.temperature_2m, codigo: c.weather_code, dia: c.is_day === 1, humedad: c.relative_humidity_2m };
}

// ------------------------------------------------------------------ estado
async function estado(env) {
    const revisiones = await Promise.all(SERVICIOS.map(revisar));
    const avesRes = revisiones.find((r) => r.id === 'aves');
    // Cancela los cuerpos que no vamos a leer
    for (const r of revisiones) if (r.res && r.id !== 'aves') r.res.body && r.res.body.cancel();

    const [datosAves, datosPacketlens, datosClima, datosSonda, datosNetkit, datosAct] = await Promise.all([
        conLimite(aves(avesRes && avesRes.ok ? avesRes.res : null), 8000),
        conLimite(packetlens(env), 4000),
        conLimite(clima(), 5000),
        conLimite(sonda(), 6000),
        conLimite(netkit(env), 4000),
        conLimite(actualizaciones(env), 4000),
    ]);

    return {
        actualizado: new Date().toISOString(),
        servicios: revisiones.map(({ id, ok, codigo, ms, error, privado }) => ({ id, ok, codigo, ms, ...(error ? { error } : {}), ...(privado ? { privado } : {}) })),
        aves: datosAves,
        packetlens: datosPacketlens,
        clima: datosClima,
        sonda: datosSonda,
        netkit: datosNetkit,
        actualizaciones: datosAct,
    };
}

async function apiEstado(request, env, ctx) {
    const cache = caches.default;
    const clave = new Request(`https://${CANONICO}/__estado/v6`);
    const guardado = await cache.match(clave);
    if (guardado) return guardado;

    const datos = await estado(env);
    const res = json(datos, { 'Cache-Control': `public, max-age=${CACHE_SEG}` });
    ctx.waitUntil(cache.put(clave, res.clone()));
    return res;
}


/* =============================================================== conteos anónimos (D1: DATOS)
   conteo:   un contador por día, tipo y detalle (sin datos personales, sin IPs)
   donacion: las donaciones que registras a mano desde el panel */
const enc = new TextEncoder();
const dec = new TextDecoder();
const hoy = (ms = Date.now()) => new Date(ms - 6 * 3600e3).toISOString().slice(0, 10);
const corta = (v, n = 600) => String(v ?? '').replace(/[\u0000-\u001f]+/g, ' ').slice(0, n);
const numero = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 0 ? n : d; };
const jsonR = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra } });

let tablasListas = false;
async function tablas(db) {
    if (tablasListas) return;
    await db.batch([
        db.prepare("CREATE TABLE IF NOT EXISTS conteo (dia TEXT NOT NULL, tipo TEXT NOT NULL, detalle TEXT NOT NULL DEFAULT '', n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (dia, tipo, detalle))"),
        db.prepare("CREATE TABLE IF NOT EXISTS actualizacion (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, proyecto TEXT NOT NULL, mensaje TEXT, commit_id TEXT, oculto INTEGER NOT NULL DEFAULT 0)"),
        db.prepare("CREATE TABLE IF NOT EXISTS donacion (id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT NOT NULL, monto REAL NOT NULL, moneda TEXT NOT NULL DEFAULT 'USD', nombre TEXT, nota TEXT, creado TEXT NOT NULL)"),
    ]);
    tablasListas = true;
}
const SQL_CONTAR = 'INSERT INTO conteo (dia, tipo, detalle, n) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (dia, tipo, detalle) DO UPDATE SET n = n + ?4';
async function contarVarios(env, lista) {
    if (!env.DATOS || !lista.length) return;
    await tablas(env.DATOS);
    const dia = hoy();
    await env.DATOS.batch(lista.map(([tipo, detalle, cuanto]) => env.DATOS.prepare(SQL_CONTAR).bind(dia, tipo, detalle || '', cuanto ?? 1)));
}

function origenValido(request) {
    const origin = request.headers.get('Origin');
    if (!origin) return true;
    try {
        const h = new URL(origin).hostname;
        return h === CANONICO || h === `www.${CANONICO}` || h === 'localhost' || h === '127.0.0.1';
    } catch { return false; }
}

// tipo → detalles permitidos (null = cualquier palabra corta en minúsculas)
const EVENTOS = {
    visita: new Set(['es', 'en']),
    proyecto: new Set(['packetlens', 'netkit', 'aves', 'secreto', 'mired']),
    terminal: new Set(['', 'boton', 'tecla']),
    comando: null,
    huevo: null,
    contacto: new Set(['correo', 'copiar', 'terminal']),
    donar_ver: new Set(['cabecera', 'pie', 'terminal']),
    donar_clic: new Set(['3', '5', '10', 'otro']),
    idioma: new Set(['es', 'en']),
    tema: new Set(['dark', 'light']),
};
const ORIGENES = new Set(['directo', 'linkedin', 'facebook', 'instagram', 'x', 'google', 'bing', 'duckduckgo', 'whatsapp', 'github', 'youtube', 'tiktok', 'reddit', 'sitio', 'otro']);
const ES_BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|embedly|python|curl|wget|monitor|uptime/i;
function dispositivo(ua) {
    if (/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(ua)) return 'tablet';
    if (/Mobi|iPhone|iPod|Android|Windows Phone/i.test(ua)) return 'movil';
    return 'escritorio';
}
function navegador(ua) {
    if (/Edg\//.test(ua)) return 'edge';
    if (/OPR\/|Opera/.test(ua)) return 'opera';
    if (/SamsungBrowser/.test(ua)) return 'samsung';
    if (/Firefox\/|FxiOS/.test(ua)) return 'firefox';
    if (/Chrome\/|CriOS/.test(ua)) return 'chrome';
    if (/Safari\//.test(ua)) return 'safari';
    return 'otro';
}
function sistema(ua) {
    if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    if (/Windows/.test(ua)) return 'windows';
    if (/Mac OS X|Macintosh/.test(ua)) return 'macos';
    if (/Linux|CrOS/.test(ua)) return 'linux';
    return 'otro';
}
async function evento(request, env) {
    if (request.method !== 'POST') return jsonR({ error: 'method' }, 405);
    if (!origenValido(request)) return jsonR({ error: 'origin' }, 403);
    if (env.LIMITE_EVENTOS) {
        const { success } = await env.LIMITE_EVENTOS.limit({ key: request.headers.get('CF-Connecting-IP') || 'anon' });
        if (!success) return new Response(null, { status: 204 });
    }
    const texto = await request.text();
    if (texto.length > 512) return jsonR({ error: 'size' }, 413);
    let d;
    try { d = JSON.parse(texto); } catch { return jsonR({ error: 'json' }, 400); }
    const tipo = String(d.t || '');
    const detalle = String(d.d || '').toLowerCase();
    if (!(tipo in EVENTOS) || !/^[a-z0-9_]{0,24}$/.test(detalle)) return jsonR({ error: 'tipo' }, 400);
    if (EVENTOS[tipo] && !EVENTOS[tipo].has(detalle)) return jsonR({ error: 'detalle' }, 400);
    const ua = request.headers.get('User-Agent') || '';
    if (ES_BOT.test(ua)) return new Response(null, { status: 204 });
    const lista = [[tipo, detalle]];
    if (tipo === 'visita') {
        const pais = String(request.cf?.country || 'xx').toLowerCase();
        lista.push(['pais', /^[a-z0-9]{2}$/.test(pais) ? pais : 'xx']);
        lista.push(['disp', dispositivo(ua)]);
        lista.push(['nav', navegador(ua)]);
        lista.push(['so', sistema(ua)]);
        lista.push(['hora', String(new Date(Date.now() - 6 * 3600e3).getUTCHours()).padStart(2, '0')]);
        const o = String(d.o || '').toLowerCase();
        lista.push(['origen', ORIGENES.has(o) ? o : 'otro']);
        lista.push(['visitante', d.r === 1 ? 'vuelve' : 'nuevo']);
        lista.push(['tema_ini', d.th === 'light' ? 'light' : 'dark']);
    }
    await contarVarios(env, lista);
    return new Response(null, { status: 204 });
}

/* =============================================================== avisos de publicación (bitácora automática)
   Cada publicar.sh llama a avisar.sh, que hace POST /api/deploy con la clave DEPLOY_TOKEN. */
const PROYECTOS_DEPLOY = new Set(['packetlens', 'netkit', 'aves', 'secreto', 'mired', 'selvinmejia']);
function mismoTexto(a, b) {
    const x = enc.encode(String(a)), y = enc.encode(String(b));
    if (x.length !== y.length) return false;
    let d = 0;
    for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
    return d === 0;
}
async function apiDeploy(request, env) {
    if (request.method !== 'POST') return jsonR({ error: 'method' }, 405);
    const m = /^Bearer\s+(.+)$/.exec(request.headers.get('Authorization') || '');
    if (!env.DEPLOY_TOKEN || !m || !mismoTexto(m[1].trim(), env.DEPLOY_TOKEN)) return jsonR({ error: 'auth' }, 401);
    if (!env.DATOS) return jsonR({ error: 'nodb' }, 503);
    const d = await request.json().catch(() => ({}));
    const p = String(d.p || '').toLowerCase();
    if (!PROYECTOS_DEPLOY.has(p)) return jsonR({ error: 'proyecto' }, 400);
    await tablas(env.DATOS);
    await env.DATOS.prepare('INSERT INTO actualizacion (ts, proyecto, mensaje, commit_id) VALUES (?, ?, ?, ?)')
        .bind(Date.now(), p, corta(d.m, 180) || null, /^[0-9a-f]{4,40}$/i.test(d.c || '') ? d.c : null).run();
    return new Response(null, { status: 204 });
}
async function actualizaciones(env) {
    if (!env.DATOS) return null;
    try {
        await tablas(env.DATOS);
        const [ult, por] = await env.DATOS.batch([
            env.DATOS.prepare('SELECT ts, proyecto, mensaje FROM actualizacion WHERE oculto = 0 ORDER BY ts DESC LIMIT 40'),
            env.DATOS.prepare('SELECT proyecto, MAX(ts) AS ts FROM actualizacion GROUP BY proyecto'),
        ]);
        return {
            ultimas: (ult.results || []).map((r) => ({ ts: r.ts, p: r.proyecto, m: r.mensaje || '' })),
            porProyecto: Object.fromEntries((por.results || []).map((r) => [r.proyecto, r.ts])),
        };
    } catch (e) {
        console.log('actualizaciones:', e.message);
        return null;
    }
}

/* =============================================================== panel privado con Google */
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const desdeB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
let clavesGoogle = null, clavesVencen = 0;
async function clavesDeGoogle(forzar) {
    if (!forzar && clavesGoogle && Date.now() < clavesVencen) return clavesGoogle;
    const r = await fetch('https://www.googleapis.com/oauth2/v3/certs');
    const j = await r.json();
    const edad = /max-age=(\d+)/.exec(r.headers.get('cache-control') || '');
    clavesGoogle = j.keys || [];
    clavesVencen = Date.now() + (edad ? Number(edad[1]) * 1000 : 3600e3);
    return clavesGoogle;
}
async function verificarGoogle(token, env) {
    const partes = String(token || '').split('.');
    if (partes.length !== 3) throw new Error('token');
    const [h, p, s] = partes;
    const cab = JSON.parse(dec.decode(desdeB64url(h)));
    if (cab.alg !== 'RS256') throw new Error('alg');
    let jwk = (await clavesDeGoogle(false)).find((k) => k.kid === cab.kid);
    if (!jwk) jwk = (await clavesDeGoogle(true)).find((k) => k.kid === cab.kid);
    if (!jwk) throw new Error('kid');
    const clave = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', clave, desdeB64url(s), enc.encode(`${h}.${p}`));
    if (!ok) throw new Error('firma');
    const c = JSON.parse(dec.decode(desdeB64url(p)));
    if (c.iss !== 'accounts.google.com' && c.iss !== 'https://accounts.google.com') throw new Error('iss');
    if (c.aud !== env.GOOGLE_CLIENT_ID) throw new Error('aud');
    if (!c.exp || c.exp * 1000 < Date.now() - 60e3) throw new Error('exp');
    if (c.email_verified !== true && c.email_verified !== 'true') throw new Error('email');
    return String(c.email).toLowerCase();
}
const admins = (env) => String(env.ADMIN_EMAIL || '').toLowerCase().split(/[,\s]+/).filter(Boolean);
const claveSesion = (env) => crypto.subtle.importKey('raw', enc.encode(env.SESION_SECRETO), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
async function crearSesion(email, env) {
    const datos = b64url(enc.encode(JSON.stringify({ e: email, x: Date.now() + 12 * 3600e3 })));
    const firma = new Uint8Array(await crypto.subtle.sign('HMAC', await claveSesion(env), enc.encode(datos)));
    return `${datos}.${b64url(firma)}`;
}
async function leerSesion(request, env) {
    if (!env.SESION_SECRETO) return null;
    const m = /(?:^|;\s*)sm_panel=([^;]+)/.exec(request.headers.get('Cookie') || '');
    if (!m) return null;
    const [datos, firma] = m[1].split('.');
    if (!datos || !firma) return null;
    try {
        if (!(await crypto.subtle.verify('HMAC', await claveSesion(env), desdeB64url(firma), enc.encode(datos)))) return null;
        const s = JSON.parse(dec.decode(desdeB64url(datos)));
        if (!s.x || s.x < Date.now() || !admins(env).includes(s.e)) return null;
        return s.e;
    } catch { return null; }
}
const COOKIE = 'Path=/; HttpOnly; Secure; SameSite=Strict';
const SEG_PANEL = {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; frame-src https://accounts.google.com/gsi/; connect-src 'self' https://accounts.google.com/gsi/; img-src 'self' data: https://*.googleusercontent.com; base-uri 'none'; frame-ancestors 'none'",
};
const htmlR = (body, status = 200) => new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...SEG_PANEL } });

const esFecha = (x) => /^\d{4}-\d{2}-\d{2}$/.test(x || '') && !Number.isNaN(Date.parse(`${x}T00:00:00Z`));
async function estadisticas(env, desde, hasta) {
    await tablas(env.DATOS);
    const filas = (await env.DATOS.prepare('SELECT dia, tipo, detalle, n FROM conteo WHERE dia >= ? AND dia <= ? ORDER BY dia').bind(desde, hasta).all()).results || [];
    const serie = {}, detalle = {};
    for (const f of filas) {
        (serie[f.tipo] ||= {})[f.dia] = (serie[f.tipo][f.dia] || 0) + f.n;
        if (f.detalle) (detalle[f.tipo] ||= {})[f.detalle] = (detalle[f.tipo][f.detalle] || 0) + f.n;
    }
    const dias = [];
    for (let t = Date.parse(`${desde}T12:00:00Z`), fin = Date.parse(`${hasta}T12:00:00Z`); t <= fin && dias.length < 3700; t += 86400e3) dias.push(new Date(t).toISOString().slice(0, 10));
    const donaciones = (await env.DATOS.prepare('SELECT id, fecha, monto, moneda, nombre, nota FROM donacion ORDER BY fecha DESC, id DESC LIMIT 300').all()).results || [];
    const totales = (await env.DATOS.prepare('SELECT moneda, COUNT(*) AS n, SUM(monto) AS total FROM donacion GROUP BY moneda').all()).results || [];
    const primerDia = await env.DATOS.prepare('SELECT MIN(dia) AS d FROM conteo').first('d');
    return { hoy: hoy(), desde, hasta, dias, serie, detalle, donaciones, totales, primerDia };
}

async function rutaPanel(request, env, url) {
    const ruta = url.pathname.replace(/\/+$/, '') || '/panel';
    const listo = env.GOOGLE_CLIENT_ID && env.ADMIN_EMAIL && env.SESION_SECRETO;
    if (ruta === '/panel' && request.method === 'GET') {
        if (!listo) return htmlR(paginaEntrar({ falta: true }));
        const quien = await leerSesion(request, env);
        return quien ? htmlR(paginaPanel({ email: quien, sinDatos: !env.DATOS })) : htmlR(paginaEntrar({ clientId: env.GOOGLE_CLIENT_ID }));
    }
    if (!listo) return jsonR({ error: 'setup' }, 503);
    if (request.method !== 'GET' && !origenValido(request)) return jsonR({ error: 'origin' }, 403);
    if (ruta === '/panel/login' && request.method === 'POST') {
        let email;
        try {
            const { credential } = await request.json();
            email = await verificarGoogle(credential, env);
        } catch (e) {
            console.log('login falló:', e.message);
            return jsonR({ error: 'token' }, 401);
        }
        if (!admins(env).includes(email)) return jsonR({ error: 'forbidden' }, 403);
        return jsonR({ ok: true }, 200, { 'Set-Cookie': `sm_panel=${await crearSesion(email, env)}; ${COOKIE}; Max-Age=43200` });
    }
    if (ruta === '/panel/logout' && request.method === 'POST') {
        return jsonR({ ok: true }, 200, { 'Set-Cookie': `sm_panel=; ${COOKIE}; Max-Age=0` });
    }
    const quien = await leerSesion(request, env);
    if (!quien) return jsonR({ error: 'auth' }, 401);
    if (!env.DATOS) return jsonR({ error: 'nodb' }, 503);
    if (ruta === '/panel/api/stats' && request.method === 'GET') {
        const q = url.searchParams;
        const hasta = esFecha(q.get('hasta')) ? q.get('hasta') : hoy();
        const dias = Math.min(3660, Math.max(1, numero(q.get('dias'), 30)));
        let desde = esFecha(q.get('desde')) ? q.get('desde') : hoy(Date.now() - (dias - 1) * 86400e3);
        if (desde > hasta) desde = hasta;
        return jsonR(await estadisticas(env, desde, hasta));
    }
    if (ruta === '/panel/api/actualizaciones' && request.method === 'GET') {
        await tablas(env.DATOS);
        const r = await env.DATOS.prepare('SELECT id, ts, proyecto, mensaje, commit_id, oculto FROM actualizacion ORDER BY ts DESC LIMIT 100').all();
        return jsonR({ lista: r.results || [] });
    }
    if (ruta === '/panel/api/actualizacion' && request.method === 'PATCH') {
        const d = await request.json().catch(() => ({}));
        await env.DATOS.prepare('UPDATE actualizacion SET oculto = ? WHERE id = ?').bind(d.oculto ? 1 : 0, numero(d.id, 0)).run();
        return jsonR({ ok: true });
    }
    if (ruta === '/panel/api/donacion' && request.method === 'POST') {
        const d = await request.json().catch(() => ({}));
        const monto = Number(d.monto);
        const fecha = esFecha(d.fecha) ? d.fecha : hoy();
        if (!Number.isFinite(monto) || monto <= 0 || monto > 100000) return jsonR({ error: 'monto' }, 400);
        await tablas(env.DATOS);
        await env.DATOS.prepare('INSERT INTO donacion (fecha, monto, moneda, nombre, nota, creado) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(fecha, Math.round(monto * 100) / 100, d.moneda === 'GTQ' ? 'GTQ' : 'USD', corta(d.nombre, 80) || null, corta(d.nota, 200) || null, new Date().toISOString()).run();
        return jsonR({ ok: true });
    }
    if (ruta === '/panel/api/donacion' && request.method === 'DELETE') {
        await env.DATOS.prepare('DELETE FROM donacion WHERE id = ?').bind(numero(url.searchParams.get('id'), 0)).run();
        return jsonR({ ok: true });
    }
    return jsonR({ error: 'not_found' }, 404);
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (url.hostname === `www.${CANONICO}`) {
            url.hostname = CANONICO;
            return Response.redirect(url.toString(), 301);
        }

        if (url.pathname === '/api/estado') {
            try {
                return await apiEstado(request, env, ctx);
            } catch (e) {
                console.log('estado:', e.message);
                return json({ error: 'estado' }, { 'Cache-Control': 'no-store' });
            }
        }
        if (url.pathname === '/api/deploy') return apiDeploy(request, env).catch((e) => { console.log('deploy:', e.message); return jsonR({ error: 'deploy' }, 500); });
        if (url.pathname === '/api/evento') return evento(request, env).catch((e) => { console.log('evento:', e.message); return new Response(null, { status: 204 }); });
        if (url.pathname === '/panel' || url.pathname.startsWith('/panel/')) {
            return rutaPanel(request, env, url).catch((e) => { console.log('panel:', e.message); return jsonR({ error: 'panel' }, 500); });
        }

        const res = await env.ASSETS.fetch(request);
        const out = new Response(res.body, res);
        for (const [k, v] of Object.entries(SEGURIDAD)) out.headers.set(k, v);
        return out;
    },
};
