// selvinmejia.com · páginas del panel privado (/panel). Las sirve el Worker; no están en los archivos públicos.
// Usa las variables de color del sitio (/styles.css) y Chart.js de /vendor.
import { MAPA } from './mapa.js';

const seguro = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');
// Wrangler (esbuild) agrega __name(...) dentro de las funciones al empaquetar; en el navegador no existe
const SHIM = 'var __name = function (f) { return f; };';

const SVG_MAPA = `<svg class="mapa" viewBox="0 0 ${MAPA.w} ${MAPA.h}" role="img" aria-label="Mapa de visitas por país">${Object.entries(MAPA.paises)
    .map(([c, d]) => `<path data-c="${c}" d="${d}"/>`).join('')}</svg>`;

const CABECERA = `<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<script>(function(){var t='dark';try{t=localStorage.getItem('sm.theme')||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark')}catch(e){}document.documentElement.dataset.theme=t==='light'?'light':'dark'})();</script>
<link rel="stylesheet" href="/styles.css">`;

const ESTILO = `<style>
.hidden { display: none !important; }
.adm-top { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 24px; background: color-mix(in srgb, var(--bg) 85%, transparent); border-bottom: 1px solid var(--border); backdrop-filter: blur(10px); flex-wrap: wrap; }
.adm-top .left { display: flex; align-items: center; gap: 14px; }
.adm-top .marca { display: flex; align-items: center; gap: 9px; font: 600 15px var(--mono); color: var(--text-strong); text-decoration: none; }
.adm-top .marca img { border-radius: 7px; }
.adm-top .tag { font: 700 11px var(--mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--naranja); }
.adm-top .right { display: flex; align-items: center; gap: 10px; color: var(--muted); font-size: 12.5px; flex-wrap: wrap; }
.adm { max-width: 1240px; margin: 0 auto; padding: 22px 24px 56px; display: flex; flex-direction: column; gap: 16px; }
.adm h2 { margin: 18px 0 -2px; font: 700 12px var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); display: flex; align-items: center; gap: 10px; }
.adm h2::after { content: ""; flex: 1; height: 1px; background: var(--border); }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; min-width: 0; }
.card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 14px 16px 6px; flex-wrap: wrap; }
.card-head h3 { margin: 0; font-size: 14px; color: var(--text-strong); }
.card-sub { font-size: 12px; font-weight: 400; color: var(--muted); }
.kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.kpi { padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
.kpi .l { font: 600 11px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.kpi .v { font: 700 28px/1.1 var(--mono); color: var(--text-strong); letter-spacing: -0.02em; }
.kpi .s { font-size: 12.5px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.grid-mapa { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 14px; }
.mini { height: 180px; padding: 4px 12px 12px; position: relative; }
.big { height: 200px; padding: 4px 12px 12px; position: relative; }
.note { font-size: 12.5px; color: var(--muted); line-height: 1.55; margin: 0; }
.empty-note { padding: 14px 16px 18px; color: var(--muted); font-size: 13px; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0 14px; border-radius: 9px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font: 600 13px var(--sans); cursor: pointer; }
.btn:hover { border-color: var(--cyan); color: var(--cyan); }
.btn-primary { background: var(--green); color: var(--btn-text); border-color: transparent; }
.btn-primary:hover { color: var(--btn-text); filter: brightness(1.08); }
.seg { display: inline-grid; grid-auto-flow: column; gap: 2px; padding: 3px; border-radius: 10px; background: var(--surface-2); border: 1px solid var(--border-strong); }
.seg button { height: 28px; padding: 0 11px; border: 0; border-radius: 7px; background: transparent; font: 600 12px var(--sans); color: var(--text-2); white-space: nowrap; cursor: pointer; }
.seg button[aria-pressed="true"] { background: var(--surface); color: var(--text-strong); box-shadow: 0 1px 0 var(--border-strong); }
.custom { display: flex; align-items: center; gap: 6px; }
.custom input, .custom select, .dform input, .dform select { height: 32px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--border-strong); background: var(--surface-2); color: var(--text); font-size: 12.5px; }
.custom input { width: 70px; }
.dtable { width: 100%; border-collapse: collapse; font-size: 13px; }
.dtable th { text-align: left; font: 700 11px var(--mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); padding: 8px 16px; border-bottom: 1px solid var(--border); }
.dtable td { padding: 9px 16px; border-bottom: 1px solid var(--border); color: var(--text-2); }
.dtable td.n, .dtable th.n { text-align: right; font-family: var(--mono); }
.dform { display: grid; grid-template-columns: 140px 110px 90px 1fr 1fr auto; gap: 8px; padding: 10px 16px 16px; align-items: end; }
.dform label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; font-weight: 600; color: var(--muted); }
.del { width: 28px; height: 28px; border-radius: 8px; border: 1px solid var(--border); background: none; color: var(--muted); cursor: pointer; }
.del:hover { color: var(--red); border-color: var(--red); }
.login { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
.login .card { width: min(420px, 100%); padding: 30px 28px; display: flex; flex-direction: column; gap: 14px; align-items: center; text-align: center; }
.login .marca { display: flex; align-items: center; gap: 10px; font: 600 17px var(--mono); color: var(--text-strong); }
.login p { margin: 0; color: var(--text-2); font-size: 13.5px; line-height: 1.5; }
.login code { font: 12px var(--mono); background: var(--surface-2); padding: 3px 6px; border-radius: 6px; }
.login .err { color: var(--red); font-size: 13px; min-height: 18px; }
.mapa-wrap { position: relative; padding: 4px 12px 8px; }
.mapa { width: 100%; height: auto; display: block; }
.mapa path { fill: var(--surface-2); stroke: var(--bg); stroke-width: 0.5; transition: opacity .1s; }
[data-theme="light"] .mapa path { fill: #e5e9f0; }
.mapa path.on { cursor: pointer; }
.mapa path:hover { opacity: 0.8; stroke: var(--text-2); stroke-width: 0.8; }
.leyenda { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; padding: 0 16px 14px; font-size: 11.5px; color: var(--muted); }
.leyenda i { display: inline-block; width: 22px; height: 10px; border-radius: 2px; }
.leyenda span { margin-right: 10px; }
.mtip { position: fixed; z-index: 50; pointer-events: none; padding: 7px 10px; border-radius: 8px; background: var(--surface); border: 1px solid var(--border-strong); color: var(--text); font-size: 12px; box-shadow: var(--shadow); }
.mlist { list-style: none; margin: 0; padding: 6px 16px 16px; display: flex; flex-direction: column; gap: 10px; }
.mlist li { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; gap: 8px; align-items: center; font-size: 13px; color: var(--text-2); }
.mlist .pos { font: 11px var(--mono); color: var(--muted); text-align: right; }
.mlist .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mlist .bar { grid-column: 2 / 4; height: 4px; border-radius: 2px; background: var(--surface-2); overflow: hidden; margin-top: -5px; }
.mlist .bar i { display: block; height: 100%; border-radius: 2px; background: var(--cyan); }
.mlist b { font: 600 12.5px var(--mono); color: var(--text); }
.mlist b em { font-style: normal; font-weight: 400; color: var(--muted); }
.flag { display: inline-block; min-width: 1.35em; margin-right: 7px; font-size: 16px; line-height: 1; vertical-align: -2px; font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif; }
.flag.cod { min-width: 0; padding: 2px 4px; border: 1px solid var(--border-strong); border-radius: 4px; font: 600 9.5px/1 var(--mono); color: var(--text-2); vertical-align: 1px; }
@media (max-width: 1100px) { .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } .grid-3 { grid-template-columns: 1fr 1fr; } .grid-mapa { grid-template-columns: 1fr; } }
@media (max-width: 760px) { .grid-2, .grid-3 { grid-template-columns: 1fr; } .dform { grid-template-columns: 1fr 1fr; } .adm { padding: 16px 12px 40px; } .adm-top .right { width: 100%; } .seg { max-width: 100%; overflow-x: auto; } #t-don { overflow-x: auto; } }
@media (max-width: 480px) { .kpis { grid-template-columns: 1fr; } }
</style>`;

const MARCA = '<img src="/favicon.svg" alt="" width="26" height="26"><span>selvinmejia<span style="color:var(--muted)">.com</span></span>';

/* ------------------------------------------------------------------ inicio de sesión */
function clienteEntrar() {
    setTimeout(() => {
        if (!window.google || !window.google.accounts) document.getElementById('err').textContent = 'No cargó el botón de Google. Revisa tu conexión o desactiva el bloqueador de anuncios en esta página.';
    }, 8000);
    window.entrarConGoogle = async (r) => {
        const err = document.getElementById('err');
        err.textContent = 'Verificando…';
        try {
            const res = await fetch('/panel/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: r.credential }) });
            if (res.ok) { location.reload(); return; }
            err.textContent = res.status === 403 ? 'Esa cuenta de Google no tiene acceso a este panel.' : 'No se pudo verificar el inicio de sesión. Intenta otra vez.';
        } catch { err.textContent = 'Sin conexión. Intenta otra vez.'; }
    };
}

export function paginaEntrar({ clientId, falta }) {
    const cuerpo = falta
        ? `<p>El panel todavía no está configurado.</p><p>En tu Mac corre:<br><code>bash ~/Documents/Proyectos_SGMC/selvinmejia/configurar-panel.sh</code></p>`
        : `<p>Panel privado de visitas y apoyo.</p>
           <div id="g_id_onload" data-client_id="${String(clientId).replace(/"/g, '')}" data-callback="entrarConGoogle" data-auto_prompt="false" data-ux_mode="popup"></div>
           <div class="g_id_signin" data-type="standard" data-theme="filled_black" data-size="large" data-text="signin_with" data-shape="pill" data-locale="es"></div>
           <div class="err" id="err"></div>
           <script>${SHIM}(${clienteEntrar.toString()})();</script>
           <script src="https://accounts.google.com/gsi/client" async></script>`;
    return `<!DOCTYPE html><html lang="es" data-theme="dark"><head>${CABECERA}<title>Panel · selvinmejia.com</title>${ESTILO}</head>
<body><main class="login"><section class="card"><div class="marca">${MARCA}</div>${cuerpo}
<a href="/">Volver al sitio</a></section></main></body></html>`;
}

/* ------------------------------------------------------------------ panel */
function clientePanel(INICIO) {
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmt = (n) => Number(n || 0).toLocaleString('es-GT');
    const money = (n, cur = 'USD') => `${cur === 'GTQ' ? 'Q' : '$'}${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    const sum = (obj) => Object.values(obj || {}).reduce((s, v) => s + v, 0);
    const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
    const dark = () => document.documentElement.dataset.theme !== 'light';
    const C = () => (dark()
        ? { bar: '#22d3ee', hover: '#67e8f9', b2: '#fb923c', text: '#a3afbd', muted: '#6b7785', grid: 'rgba(255,255,255,0.06)', axis: 'rgba(255,255,255,0.12)', tipBg: '#0d1117', tipBorder: 'rgba(34,211,238,0.35)', tipTitle: '#e6edf3',
            seq: ['#155e75', '#0e7490', '#0891b2', '#22d3ee', '#a5f3fc'] }
        : { bar: '#0891b2', hover: '#0e7490', b2: '#ea580c', text: '#475569', muted: '#64748b', grid: 'rgba(15,23,42,0.07)', axis: 'rgba(15,23,42,0.15)', tipBg: '#ffffff', tipBorder: 'rgba(8,145,178,0.4)', tipTitle: '#0b1220',
            seq: ['#67e8f9', '#22d3ee', '#0891b2', '#0e7490', '#164e63'] });

    const PROYECTO = { packetlens: 'PacketLens', netkit: 'NetKit', aves: 'Diario de Aves', secreto: 'Amigo Secreto', mired: 'Mi Red' };
    const LLEGAN = { directo: 'Directo (link o favorito)', linkedin: 'LinkedIn', facebook: 'Facebook', instagram: 'Instagram', x: 'X (Twitter)', google: 'Google', bing: 'Bing', duckduckgo: 'DuckDuckGo', whatsapp: 'WhatsApp', github: 'GitHub', youtube: 'YouTube', tiktok: 'TikTok', reddit: 'Reddit', sitio: 'Tus otros sitios', otro: 'Otros sitios' };
    const DISP = { escritorio: 'Computadora', movil: 'Teléfono', tablet: 'Tablet' };
    const NAV = { chrome: 'Chrome', safari: 'Safari', edge: 'Edge', firefox: 'Firefox', opera: 'Opera', samsung: 'Samsung Internet', otro: 'Otro' };
    const SO = { ios: 'iPhone / iPad', android: 'Android', windows: 'Windows', macos: 'macOS', linux: 'Linux', otro: 'Otro' };
    const IDIOMA = { es: 'Español', en: 'Inglés' };
    const VISITANTE = { nuevo: 'Primera vez', vuelve: 'Ya habían venido' };
    const TEMA = { dark: 'Modo oscuro', light: 'Modo claro' };
    const HUEVO = { matrix: 'The Matrix', bttf: 'Volver al futuro', rpo: 'Ready Player One', spiderman: 'Spider-Man', ironman: 'Iron Man', avengers: 'Avengers', saw: 'SAW', rapido: 'Rápido y furioso', tortugas: 'Tortugas Ninja', gadget: 'Inspector Gadget', rangers: 'Power Rangers', pokemon: 'Pokémon', naruto: 'Naruto', dbz: 'Dragon Ball Z', deathnote: 'Death Note' };
    const CONTACTO = { correo: 'Abrieron el correo', copiar: 'Copiaron la dirección', terminal: 'Lo vieron en la terminal' };
    const ORIGEN = { cabecera: 'Corazón de la barra superior', pie: 'Botón del pie de página', terminal: 'Comando apoyar (terminal)' };
    const MONTO = { 3: '$3 · un café', 5: '$5 · dos cafés', 10: '$10 · un almuerzo', otro: 'Otro monto' };
    const TERMINAL = { boton: 'Botón >_', tecla: 'Tecla `', '': 'Otro' };

    let nombrePais;
    try { const dn = new Intl.DisplayNames(['es'], { type: 'region' }); nombrePais = (c) => (c === 'xx' ? 'Desconocido' : c === 't1' ? 'Red Tor' : dn.of(c.toUpperCase()) || c.toUpperCase()); } catch { nombrePais = (c) => c.toUpperCase(); }
    const conBanderas = (() => {
        try {
            const cv = document.createElement('canvas');
            cv.width = cv.height = 32;
            const cx = cv.getContext('2d', { willReadFrequently: true });
            cx.font = '24px sans-serif';
            cx.textBaseline = 'top';
            const pintar = (t) => { cx.clearRect(0, 0, 32, 32); cx.fillText(t, 0, 0); return cx.getImageData(0, 0, 32, 32).data.join(''); };
            return pintar('\u{1F1EC}\u{1F1F9}') !== pintar('\u{1F1EC}​\u{1F1F9}');
        } catch { return true; }
    })();
    function bandera(c) {
        if (c === 'xx') return '<span class="flag" aria-hidden="true">🌐</span>';
        if (c === 't1') return '<span class="flag" aria-hidden="true">🧅</span>';
        if (!/^[a-z]{2}$/.test(c)) return '';
        if (!conBanderas) return `<span class="flag cod" aria-hidden="true">${c.toUpperCase()}</span>`;
        return `<span class="flag" aria-hidden="true">${String.fromCodePoint(...[...c.toUpperCase()].map((l) => 0x1F1A5 + l.charCodeAt(0)))}</span>`;
    }

    const hoyGT = () => new Date(Date.now() - 6 * 3600e3);
    const ymd = (d) => d.toISOString().slice(0, 10);
    let rango = { dias: 30 };
    const charts = {};
    let ultimo = null;

    const tooltip = () => { const c = C(); return { backgroundColor: c.tipBg, borderColor: c.tipBorder, borderWidth: 1, titleColor: c.tipTitle, bodyColor: c.text, padding: 10, cornerRadius: 8, displayColors: false }; };
    function columnas(canvas, labels, values, unidad, titulos, color) {
        const c = C();
        return new Chart(canvas, {
            type: 'bar',
            data: { labels, datasets: [{ data: values, backgroundColor: color || c.bar, hoverBackgroundColor: c.hover, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 24, categoryPercentage: 0.8, barPercentage: 0.9 }] },
            options: {
                responsive: true, maintainAspectRatio: false, animation: { duration: 200 },
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { grid: { display: false }, border: { color: c.axis }, ticks: { color: c.muted, maxRotation: 0, autoSkipPadding: 14, font: { size: 10.5 } } },
                    y: { beginAtZero: true, grid: { color: c.grid }, border: { display: false }, ticks: { color: c.muted, precision: 0, maxTicksLimit: 4, font: { size: 10.5 }, callback: (v) => fmt(v) } },
                },
                plugins: { legend: { display: false }, tooltip: { ...tooltip(), callbacks: { title: (it) => titulos[it[0].dataIndex], label: (it) => ` ${fmt(it.raw)} ${unidad}` } } },
            },
        });
    }
    const lista = (obj, nombres) => Object.entries(obj || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => [nombres ? nombres[k] || k : k, v, k]);
    function medidores(id, filas, vacio, icono) {
        const total = filas.reduce((s, x) => s + x[1], 0);
        $(id).innerHTML = filas.length
            ? `<ul class="mlist">${filas.map(([k, v, clave], i) => `<li><span class="pos">${i + 1}</span><span class="nm" title="${esc(k)}">${icono ? icono(clave) : ''}${esc(k)}</span><b>${fmt(v)} <em>· ${pct(v, total)}%</em></b><span class="bar"><i style="width:${Math.max(2, (v / filas[0][1]) * 100)}%"></i></span></li>`).join('')}</ul>`
            : `<div class="empty-note">${esc(vacio || 'Todavía no hay datos.')}</div>`;
    }
    function agrupar(d) {
        const porMes = d.dias.length > 92;
        const claves = [], titulos = [], cortas = [], idx = new Map();
        for (const dia of d.dias) {
            const k = porMes ? dia.slice(0, 7) : dia;
            if (!idx.has(k)) {
                idx.set(k, claves.length);
                claves.push(k);
                const f = new Date(`${porMes ? `${k}-15` : k}T12:00:00`);
                titulos.push(porMes ? f.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' }) : f.toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }));
                cortas.push(porMes ? f.toLocaleDateString('es-GT', { month: 'short', year: '2-digit' }) : f.toLocaleDateString('es-GT', { day: 'numeric', month: 'short' }));
            }
        }
        const serie = (t) => {
            const out = new Array(claves.length).fill(0);
            for (const [dia, n] of Object.entries(d.serie[t] || {})) {
                const i = idx.get(porMes ? dia.slice(0, 7) : dia);
                if (i != null) out[i] += n;
            }
            return out;
        };
        return { porMes, titulos, cortas, serie };
    }

    function pintarMapa(paises) {
        const c = C();
        const vals = Object.entries(paises || {}).filter(([k]) => k !== 'xx' && k !== 't1');
        const nums = vals.map((x) => x[1]).sort((a, b) => a - b);
        const dist = [...new Set(nums)];
        let clase;
        if (dist.length <= 5) clase = (v) => (dist.length === 1 ? 3 : Math.round((dist.indexOf(v) / (dist.length - 1)) * 4));
        else {
            const cortes = [0.2, 0.4, 0.6, 0.8].map((q) => dist[Math.floor(q * dist.length)]);
            clase = (v) => cortes.filter((x) => v >= x).length;
        }
        const mapa = new Map(vals);
        $$('#mapa path').forEach((p) => {
            const v = mapa.get(p.dataset.c) || 0;
            p.style.fill = v ? c.seq[clase(v)] : '';
            p.classList.toggle('on', v > 0);
        });
        const usadas = [...new Set(nums.map(clase))].sort();
        const minDe = (k) => nums.find((x) => clase(x) === k), maxDe = (k) => [...nums].reverse().find((x) => clase(x) === k);
        $('#leyenda').innerHTML = nums.length
            ? `<span>Visitas:</span>${usadas.map((k) => `<i style="background:${c.seq[k]}"></i><span>${minDe(k) === maxDe(k) ? fmt(minDe(k)) : `${fmt(minDe(k))}–${fmt(maxDe(k))}`}</span>`).join('')}<i style="background:var(--surface-2);border:1px solid var(--border)"></i><span>sin visitas</span>`
            : '<span>Las visitas aparecerán aquí por país.</span>';
    }
    const tip = document.createElement('div');
    tip.className = 'mtip hidden';
    document.body.appendChild(tip);
    $('#mapa').addEventListener('mousemove', (e) => {
        const p = e.target.closest('path');
        if (!p || !ultimo) { tip.classList.add('hidden'); return; }
        const v = (ultimo.detalle.pais || {})[p.dataset.c] || 0;
        tip.innerHTML = `${bandera(p.dataset.c)}<b>${esc(nombrePais(p.dataset.c))}</b> · ${fmt(v)} ${v === 1 ? 'visita' : 'visitas'}`;
        tip.classList.remove('hidden');
        tip.style.left = `${Math.min(window.innerWidth - tip.offsetWidth - 8, e.clientX + 12)}px`;
        tip.style.top = `${e.clientY + 14}px`;
    });
    $('#mapa').addEventListener('mouseleave', () => tip.classList.add('hidden'));

    function pintar(d) {
        ultimo = d;
        Object.keys(charts).forEach((k) => { charts[k].destroy(); delete charts[k]; });
        const G = agrupar(d);
        const tot = (t) => sum(d.serie[t]);
        const det = (t) => d.detalle[t] || {};
        const visitas = tot('visita');
        const paises = Object.keys(det('pais')).filter((k) => k !== 'xx').length;
        const proy = lista(det('proyecto'), PROYECTO);
        const huevosUnicos = Object.keys(det('huevo')).length;
        const enRango = d.donaciones.filter((x) => x.fecha >= d.desde && x.fecha <= d.hasta);
        const donado = enRango.reduce((s, x) => s + (x.moneda === 'USD' ? x.monto : 0), 0);
        const kpis = [
            ['Visitas', fmt(visitas), `${fmt(paises)} ${paises === 1 ? 'país' : 'países'} · ${pct(det('visitante').vuelve || 0, visitas)}% regresan`],
            ['Clics a proyectos', fmt(tot('proyecto')), proy.length ? `más visitado: ${proy[0][0]}` : 'nadie ha abierto un proyecto aún'],
            ['Terminal abierta', fmt(tot('terminal')), `${fmt(tot('comando'))} comandos escritos`],
            ['Huevos encontrados', fmt(tot('huevo')), `${huevosUnicos} de 15 distintos descubiertos`],
            ['Contacto', fmt(tot('contacto')), `${fmt(det('contacto').correo || 0)} abrieron el correo`],
            ['Abrieron "Apoya"', fmt(tot('donar_ver')), `${fmt(tot('donar_clic'))} fueron a PayPal`],
            ['Donaciones', money(donado), `${fmt(enRango.length)} registradas en el periodo`],
            ['Clics por visita', visitas ? (tot('proyecto') / visitas).toFixed(2) : '—', 'proyectos abiertos por cada visita'],
        ];
        $('#kpis').innerHTML = kpis.map(([l, v, s]) => `<article class="card kpi"><span class="l">${esc(l)}</span><span class="v">${esc(v)}</span><span class="s" title="${esc(s)}">${esc(s)}</span></article>`).join('');
        const u = G.porMes ? 'por mes' : 'por día';
        $$('[data-unidad]').forEach((el) => { el.textContent = u; });
        charts.v = columnas($('#c-visitas'), G.cortas, G.serie('visita'), 'visitas', G.titulos);
        charts.p = columnas($('#c-proyectos'), G.cortas, G.serie('proyecto'), 'clics', G.titulos, C().b2);
        // hora del día (Guatemala)
        const horas = Array.from({ length: 24 }, (_, h) => det('hora')[String(h).padStart(2, '0')] || 0);
        charts.h = columnas($('#c-hora'), horas.map((_, h) => `${h}h`), horas, 'visitas', horas.map((_, h) => `${String(h).padStart(2, '0')}:00 – ${String(h).padStart(2, '0')}:59 (hora de Guatemala)`));
        // dónde
        pintarMapa(det('pais'));
        medidores('#top-paises', lista(det('pais')).slice(0, 10).map(([k, v]) => [nombrePais(k), v, k]), 'Todavía no hay visitas con país.', bandera);
        medidores('#t-llegan', lista(det('origen'), LLEGAN));
        medidores('#t-disp', lista(det('disp'), DISP));
        medidores('#t-so', lista(det('so'), SO));
        medidores('#t-nav', lista(det('nav'), NAV));
        medidores('#t-idioma', lista(det('visita'), IDIOMA));
        medidores('#t-visitante', lista(det('visitante'), VISITANTE));
        // interacción
        medidores('#t-proyectos', proy, 'Nadie ha abierto un proyecto todavía.');
        medidores('#t-comandos', lista(det('comando')).slice(0, 12), 'Nadie ha escrito en la terminal todavía.');
        medidores('#t-huevos', lista(det('huevo'), HUEVO), 'Nadie ha encontrado un huevo todavía.');
        medidores('#t-contacto', lista(det('contacto'), CONTACTO), 'Nadie ha usado el correo todavía.');
        medidores('#t-terminal', lista(det('terminal'), TERMINAL), 'Nadie ha abierto la terminal todavía.');
        medidores('#t-tema', [...lista(det('tema_ini'), TEMA).map(([k, v, c]) => [`${k} (al llegar)`, v, c]), ...lista(det('tema'), TEMA).map(([k, v, c]) => [`Cambiaron a ${k.toLowerCase()}`, v, c])]);
        // apoyo
        medidores('#t-origen', lista(det('donar_ver'), ORIGEN), 'Todavía nadie ha abierto la ventana de apoyo.');
        medidores('#t-monto', lista(det('donar_clic'), MONTO), 'Todavía nadie ha ido a PayPal.');
        $('#t-don').innerHTML = d.donaciones.length
            ? `<table class="dtable"><thead><tr><th>Fecha</th><th class="n">Monto</th><th>De</th><th>Nota</th><th></th></tr></thead><tbody>${d.donaciones.map((x) => `<tr><td>${esc(x.fecha)}</td><td class="n">${esc(`${x.monto} ${x.moneda}`)}</td><td>${esc(x.nombre || '—')}</td><td>${esc(x.nota || '')}</td><td><button class="del" data-del="${x.id}" title="Borrar" aria-label="Borrar">×</button></td></tr>`).join('')}</tbody></table>`
            : '<div class="empty-note">Aún no has registrado donaciones.</div>';
        $('#don-total').textContent = d.totales.length ? `Total desde el inicio: ${d.totales.map((x) => `${money(x.total, x.moneda)} (${fmt(x.n)})`).join(' · ')}` : '';
        const fecha = (x) => new Date(`${x}T12:00:00`).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' });
        $('#rango').textContent = `${fecha(d.desde)} – ${fecha(d.hasta)}`;
        $('#desde-inicio').textContent = d.primerDia ? `Contando desde el ${fecha(d.primerDia)}.` : '';
    }

    async function pedir(qs) {
        const r = await fetch(`/panel/api/stats?${qs}`, { cache: 'no-store' });
        if (r.status === 401) { location.reload(); return null; }
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
    }
    async function cargar() {
        if (INICIO.sinDatos) { $('#estado').textContent = 'Falta la base de datos: vuelve a publicar con bash publicar.sh.'; return; }
        $('#estado').textContent = 'Cargando…';
        try {
            const d = await pedir(rango.desde ? `desde=${rango.desde}` : `dias=${rango.dias}`);
            if (!d) return;
            $('#estado').textContent = '';
            pintar(d);
        } catch { $('#estado').textContent = 'No se pudieron cargar los datos.'; }
    }

    $$('.seg [data-r]').forEach((b) => b.addEventListener('click', () => {
        $$('.seg [data-r]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        const r = b.dataset.r;
        $('#custom').classList.toggle('hidden', r !== 'custom');
        if (r === 'custom') { $('#c-n').focus(); return; }
        rango = { dias: Number(r) };
        cargar();
    }));
    $('#c-aplicar').addEventListener('click', () => {
        const n = Math.max(1, Math.min(120, Number($('#c-n').value) || 1));
        const u = $('#c-u').value;
        const d = hoyGT();
        if (u === 'd') d.setUTCDate(d.getUTCDate() - (n - 1));
        else if (u === 'm') d.setUTCMonth(d.getUTCMonth() - n);
        else d.setUTCFullYear(d.getUTCFullYear() - n);
        rango = { desde: ymd(d) };
        cargar();
    });
    $('#salir').addEventListener('click', async () => { await fetch('/panel/logout', { method: 'POST' }); location.reload(); });
    $('#f-fecha').value = ymd(hoyGT());
    $('#dform').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const r = await fetch('/panel/api/donacion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
        if (r.ok) { form.reset(); $('#f-fecha').value = ymd(hoyGT()); cargar(); }
        else alert('Revisa el monto.');
    });
    $('#t-don').addEventListener('click', async (e) => {
        const b = e.target.closest('[data-del]');
        if (!b || !confirm('¿Borrar esta donación del registro?')) return;
        await fetch(`/panel/api/donacion?id=${b.dataset.del}`, { method: 'DELETE' });
        cargar();
    });
    cargar();
}

export function paginaPanel({ email, sinDatos }) {
    const card = (titulo, cuerpo) => `<article class="card"><header class="card-head"><h3>${titulo}</h3></header>${cuerpo}</article>`;
    return `<!DOCTYPE html><html lang="es" data-theme="dark"><head>${CABECERA}<title>Panel · selvinmejia.com</title>${ESTILO}
<script defer src="/vendor/chart.umd.min.js"></script></head>
<body>
<header class="adm-top">
  <div class="left"><a class="marca" href="/">${MARCA}</a><span class="tag">Panel</span></div>
  <div class="right">
    <div class="seg" role="group" aria-label="Periodo">
      <button data-r="7" aria-pressed="false">7 días</button><button data-r="30" aria-pressed="true">30 días</button><button data-r="90" aria-pressed="false">90 días</button><button data-r="365" aria-pressed="false">1 año</button><button data-r="custom" aria-pressed="false">Personalizado</button>
    </div>
    <div class="custom hidden" id="custom">
      <span>Últimos</span><input type="number" id="c-n" min="1" max="120" value="6" aria-label="Cantidad">
      <select id="c-u" aria-label="Unidad"><option value="d">días</option><option value="m" selected>meses</option><option value="a">años</option></select>
      <button class="btn" id="c-aplicar">Aplicar</button>
    </div>
    <span id="rango"></span><span>${String(email).replace(/[<>&"]/g, '')}</span>
    <button class="btn" id="salir">Salir</button>
  </div>
</header>
<main class="adm">
  <p class="note" id="estado"></p>
  <section class="kpis" id="kpis"></section>
  <section class="grid-2">
    ${card('Visitas <span class="card-sub" data-unidad>por día</span>', '<div class="mini"><canvas id="c-visitas" role="img" aria-label="Visitas"></canvas></div>')}
    ${card('Clics a proyectos <span class="card-sub" data-unidad>por día</span>', '<div class="mini"><canvas id="c-proyectos" role="img" aria-label="Clics a proyectos"></canvas></div>')}
  </section>

  <h2>De dónde te visitan</h2>
  <section class="grid-mapa">
    ${card('Visitas por país', `<div class="mapa-wrap" id="mapa">${SVG_MAPA}</div><div class="leyenda" id="leyenda"></div>`)}
    ${card('Top 10 países', '<div id="top-paises"></div>')}
  </section>
  <section class="grid-3">
    ${card('Cómo llegan <span class="card-sub">· usa ?ref=linkedin en tus enlaces</span>', '<div id="t-llegan"></div>')}
    ${card('Nuevos y recurrentes', '<div id="t-visitante"></div>')}
    ${card('Idioma', '<div id="t-idioma"></div>')}
    ${card('Dispositivo', '<div id="t-disp"></div>')}
    ${card('Sistema operativo', '<div id="t-so"></div>')}
    ${card('Navegador', '<div id="t-nav"></div>')}
  </section>
  ${card('A qué hora te visitan <span class="card-sub">· hora de Guatemala</span>', '<div class="big"><canvas id="c-hora" role="img" aria-label="Visitas por hora del día"></canvas></div>')}

  <h2>Qué hacen en el sitio</h2>
  <section class="grid-3">
    ${card('Proyectos que abren', '<div id="t-proyectos"></div>')}
    ${card('Comandos de la terminal', '<div id="t-comandos"></div>')}
    ${card('Huevos de pascua encontrados', '<div id="t-huevos"></div>')}
    ${card('Contacto (info@selvinmejia.com)', '<div id="t-contacto"></div>')}
    ${card('Cómo abren la terminal', '<div id="t-terminal"></div>')}
    ${card('Tema', '<div id="t-tema"></div>')}
  </section>

  <h2>Apoyo</h2>
  <section class="grid-2">
    ${card('Desde dónde abren "Apoya los proyectos"', '<div id="t-origen"></div>')}
    ${card('Monto que eligen en PayPal', '<div id="t-monto"></div>')}
  </section>
  <section class="card">
    <header class="card-head"><h3>Donaciones recibidas <span class="card-sub">· PayPal.me no avisa a la página: cuando te llegue una, regístrala aquí</span></h3><span class="card-sub" id="don-total"></span></header>
    <form class="dform" id="dform">
      <label>Fecha<input type="date" name="fecha" id="f-fecha" required></label>
      <label>Monto<input type="number" name="monto" min="0.01" step="0.01" required placeholder="5"></label>
      <label>Moneda<select name="moneda"><option>USD</option><option>GTQ</option></select></label>
      <label>De (opcional)<input type="text" name="nombre" maxlength="80" placeholder="Nombre"></label>
      <label>Nota (opcional)<input type="text" name="nota" maxlength="200" placeholder="Mensaje"></label>
      <button class="btn btn-primary" type="submit">Registrar</button>
    </form>
    <div id="t-don"></div>
  </section>
  <p class="note">Los conteos son anónimos: no se guardan IPs ni datos personales. El país viene de Cloudflare. Los navegadores con "No rastrear" y los robots no se cuentan. <span id="desde-inicio"></span></p>
</main>
<script>${SHIM}window.addEventListener('DOMContentLoaded', function () { (${clientePanel.toString()})(${seguro({ sinDatos: !!sinDatos })}); });</script>
</body></html>`;
}
