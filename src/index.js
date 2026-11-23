// selvinmejia.com — Worker de Cloudflare
// - Sirve el sitio estático (la raíz del repo, menos lo que lista .assetsignore).
// - /api/estado: revisa en vivo cada proyecto (código HTTP y latencia), lee el hallazgo del día
//   de aves.selvinmejia.com, los conteos anónimos de PacketLens (base D1 tshoot-datos, solo lectura)
//   (mired es privado: solo se revisa que el túnel responda) y el clima de Ciudad de Guatemala (Open-Meteo). Se guarda 60 s en la caché de Cloudflare.
// - www.selvinmejia.com redirige (301) a selvinmejia.com.

const CANONICO = 'selvinmejia.com';
const CACHE_SEG = 60;

const SERVICIOS = [
    { id: 'aves', url: 'https://aves.selvinmejia.com/' },
    { id: 'packetlens', url: 'https://packetlens.selvinmejia.com/' },
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
    const r = await fetch('https://aves.selvinmejia.com/api/estado', { signal: AbortSignal.timeout(5000), cf: { cacheTtl: 0 } });
    if (!r.ok) return null;
    const d = await r.json();
    const t = d.telefono || {};
    const rep = t.ts ? t.minutos : null;              // minutos desde el último reporte del teléfono
    const aud = d.ultima_subida ? d.minutos : null;   // minutos desde el último audio
    let enHorario = true;
    const h = /^(\d{2})(\d{2})-(\d{2})(\d{2})$/.exec(t.horario || '');
    if (h) {
        const ahora = horaGTmin(), ini = +h[1] * 60 + +h[2], fin = +h[3] * 60 + +h[4];
        enHorario = ahora >= ini && ahora < fin;
    }
    let estado = 'escuchando';
    if (rep == null) estado = 'sin_datos';
    else if (rep > 25) estado = 'sin_senal';
    else if (!enHorario) estado = 'pausa';
    else if (aud == null || aud > 25) estado = 'sin_audio';
    return {
        estado,
        audioMin: Number.isFinite(aud) ? aud : null,
        bateria: Number.isFinite(t.bateria) ? t.bateria : null,
    };
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

    const [datosAves, datosPacketlens, datosClima, datosSonda] = await Promise.all([
        conLimite(aves(avesRes && avesRes.ok ? avesRes.res : null), 8000),
        conLimite(packetlens(env), 4000),
        conLimite(clima(), 5000),
        conLimite(sonda(), 6000),
    ]);

    return {
        actualizado: new Date().toISOString(),
        servicios: revisiones.map(({ id, ok, codigo, ms, error, privado }) => ({ id, ok, codigo, ms, ...(error ? { error } : {}), ...(privado ? { privado } : {}) })),
        aves: datosAves,
        packetlens: datosPacketlens,
        clima: datosClima,
        sonda: datosSonda,
    };
}

async function apiEstado(request, env, ctx) {
    const cache = caches.default;
    const clave = new Request(`https://${CANONICO}/__estado/v3`);
    const guardado = await cache.match(clave);
    if (guardado) return guardado;

    const datos = await estado(env);
    const res = json(datos, { 'Cache-Control': `public, max-age=${CACHE_SEG}` });
    ctx.waitUntil(cache.put(clave, res.clone()));
    return res;
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

        const res = await env.ASSETS.fetch(request);
        const out = new Response(res.body, res);
        for (const [k, v] of Object.entries(SEGURIDAD)) out.headers.set(k, v);
        return out;
    },
};
