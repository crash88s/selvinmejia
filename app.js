/* selvinmejia.com — interfaz: idioma, tema, estado en vivo, bitácora, banco y terminal */
(function () {
    'use strict';

    const C = window.CONTENIDO;
    const root = document.documentElement;
    const $ = (s, el = document) => el.querySelector(s);
    const $$ = (s, el = document) => [...el.querySelectorAll(s)];
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const TZ = 'America/Guatemala';
    const REFRESCO = 60_000;

    /* Conteos anónimos para el panel (/panel): sin IPs ni datos personales.
       Si el navegador pide no rastrear, no se cuenta nada. */
    const NO_CONTAR = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1' || location.protocol === 'file:';
    function evento(tipo, detalle = '', extra = {}) {
        if (NO_CONTAR) return;
        try {
            const body = JSON.stringify({ t: tipo, d: detalle, ...extra });
            if (navigator.sendBeacon) navigator.sendBeacon('/api/evento', new Blob([body], { type: 'text/plain' }));
            else fetch('/api/evento', { method: 'POST', body, keepalive: true }).catch(() => {});
        } catch (e) { /* sin conteo */ }
    }
    function origenVisita() {
        let r = '';
        try {
            const q = new URLSearchParams(location.search);
            r = (q.get('ref') || q.get('utm_source') || '').toLowerCase();
            if (r) {
                q.delete('ref'); q.delete('utm_source'); q.delete('utm_medium'); q.delete('utm_campaign');
                history.replaceState(null, '', `${location.pathname}${q.toString() ? `?${q}` : ''}${location.hash}`);
            }
            if (!r && document.referrer) r = new URL(document.referrer).hostname.toLowerCase();
        } catch (e) { /* sin origen */ }
        if (!r) return 'directo';
        const M = [[/linkedin|lnkd/, 'linkedin'], [/facebook|^fb$|(^|\.)fb\./, 'facebook'], [/instagram/, 'instagram'], [/twitter|^x$|(^|\.)x\.com$|(^|\.)t\.co$/, 'x'],
            [/google/, 'google'], [/bing/, 'bing'], [/duckduckgo/, 'duckduckgo'], [/whatsapp|wa\.me/, 'whatsapp'], [/github/, 'github'],
            [/youtube|youtu\.be/, 'youtube'], [/tiktok/, 'tiktok'], [/reddit/, 'reddit'], [/selvinmejia\.com$/, 'sitio']];
        for (const [re, k] of M) if (re.test(r)) return k;
        return 'otro';
    }

    let lang = root.lang === 'en' ? 'en' : 'es';
    let estado = null;        // última respuesta de /api/estado
    let estadoError = false;

    const t = (k, vars) => {
        let s = (window.I18N[lang] && window.I18N[lang][k]) ?? window.I18N.es[k] ?? k;
        if (vars) for (const [a, b] of Object.entries(vars)) s = s.replaceAll(`{${a}}`, b);
        return s;
    };
    const L = (o) => (o && typeof o === 'object' ? o[lang] ?? o.es : o);
    const host = (u) => new URL(u).host;
    const num = (n) => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'es-GT').format(n);

    /* ------------------------------------------------------------ idioma */
    function aplicarIdioma() {
        root.lang = lang;
        document.title = t('meta.title');
        $('meta[name="description"]').setAttribute('content', t('meta.desc'));
        $$('[data-i18n]').forEach((el) => {
            const k = el.dataset.i18n;
            if (k === 'panel.cargando' && estado) return;
            el.textContent = t(k);
        });
        $$('[data-i18n-attr]').forEach((el) => {
            el.dataset.i18nAttr.split(',').forEach((par) => {
                const [attr, k] = par.split(':');
                el.setAttribute(attr.trim(), t(k.trim()));
            });
        });
        $$('.lang-switch button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
        if ($('#pie-hint')) $('#pie-hint').innerHTML = esc(t('pie.secreto', { k: '§' })).replace('§', '<kbd>`</kbd>');
        renderTodo();
    }
    function cambiarIdioma(nuevo) {
        lang = nuevo === 'en' ? 'en' : 'es';
        try { localStorage.setItem('sm.lang', lang); } catch (e) {}
        evento('idioma', lang);
        const u = new URL(location.href);
        if (u.searchParams.has('lang')) { u.searchParams.set('lang', lang); history.replaceState(null, '', u); }
        aplicarIdioma();
    }
    $$('.lang-switch button').forEach((b) => b.addEventListener('click', () => cambiarIdioma(b.dataset.lang)));

    /* -------------------------------------------------------------- tema */
    function cambiarTema(nuevo) {
        const tema = nuevo || (root.dataset.theme === 'dark' ? 'light' : 'dark');
        root.dataset.theme = tema;
        $('meta[name="theme-color"]').setAttribute('content', tema === 'dark' ? '#07090d' : '#f5f7fa');
        try { localStorage.setItem('sm.theme', tema); } catch (e) {}
        evento('tema', tema);
    }
    $('#tema').addEventListener('click', () => cambiarTema());

    /* ------------------------------------------------------------- reloj */
    function horaGT(fecha = new Date(), seg = true) {
        return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'es-GT', {
            timeZone: TZ, hour: '2-digit', minute: '2-digit', ...(seg ? { second: '2-digit' } : {}), hour12: false,
        }).format(fecha);
    }
    function fechaGT(fecha = new Date()) {
        return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha);
    }
    function hace(iso) {
        const s = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000));
        const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
        if (s < 60) return rtf.format(-s, 'second');
        return rtf.format(-Math.round(s / 60), 'minute');
    }
    function tic() {
        $('#reloj').textContent = horaGT();
        if (estado) $('#revisado').textContent = t('panel.revisado', { t: hace(estado.actualizado) });
    }

    /* ------------------------------------------------------- clima (WMO) */
    const WMO = {
        es: { 0: 'despejado', 1: 'casi despejado', 2: 'parcialmente nublado', 3: 'nublado', 45: 'niebla', 48: 'niebla', 51: 'llovizna', 53: 'llovizna', 55: 'llovizna', 61: 'lluvia leve', 63: 'lluvia', 65: 'lluvia fuerte', 80: 'chubascos', 81: 'chubascos', 82: 'chubascos fuertes', 95: 'tormenta', 96: 'tormenta', 99: 'tormenta' },
        en: { 0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'fog', 51: 'drizzle', 53: 'drizzle', 55: 'drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain', 80: 'showers', 81: 'showers', 82: 'heavy showers', 95: 'thunderstorm', 96: 'thunderstorm', 99: 'thunderstorm' },
    };
    const climaTxt = (c) => (c ? `${Math.round(c.temp)} °C · ${WMO[lang][c.codigo] || '—'}` : '—');

    /* ----------------------------------------------------------- helpers */
    const svcEstado = (id) => (estado && estado.servicios ? estado.servicios.find((s) => s.id === id) : null);
    const barras = (ms) => (ms < 300 ? 4 : ms < 700 ? 3 : ms < 1500 ? 2 : 1);
    function diasNavidad() {
        const hoy = fechaGT();
        const [y] = hoy.split('-').map(Number);
        let nav = `${y}-12-25`;
        if (hoy > nav) nav = `${y + 1}-12-25`;
        return Math.round((Date.parse(nav) - Date.parse(hoy)) / 86400e3);
    }

    /* ------------------------------------------------------------ panel */
    function renderPanel() {
        const box = $('#estado-global');
        const txt = $('#estado-txt');
        const led = $('[data-led="global"]');
        let e = 'cargando';
        if (estadoError && !estado) { e = 'error'; txt.textContent = t('panel.sinDatos'); }
        else if (estado) {
            const malos = estado.servicios.filter((s) => !s.ok).length;
            e = malos === 0 ? 'ok' : malos === estado.servicios.length ? 'caido' : 'parcial';
            txt.textContent = malos === 0 ? t('panel.todos') : t('panel.parcial', { n: malos, t: estado.servicios.length });
        } else txt.textContent = t('panel.cargando');
        box.dataset.estado = e;
        led.className = 'led ' + (e === 'ok' ? 'ok' : e === 'parcial' ? 'warn' : e === 'cargando' ? '' : 'bad');

        $('#panel-lista').innerHTML = C.servicios.map((s) => {
            const st = svcEstado(s.id);
            const cls = !st ? '' : st.ok ? 'ok' : 'bad';
            const ms = st ? (st.ok ? `${st.ms} ms` : st.error || '—') : '···';
            return `<li><span class="led ${cls}"></span><span class="host">${esc(host(s.url))}</span>
                <span class="code">${s.privado ? '🔒 ' : ''}${st ? (st.codigo || '---') : ''}</span>
                <span class="ms">${st && st.ok ? `<span class="lat" data-n="${barras(st.ms)}"><i></i><i></i><i></i><i></i></span>` : ''}${esc(ms)}</span></li>`;
        }).join('');

        const c = estado && estado.clima;
        $('#clima').innerHTML = c ? `${Math.round(c.temp)} °C <small>${esc(WMO[lang][c.codigo] || '')}</small>` : '—';
        $('#clima').title = c && c.humedad != null ? t('panel.humedad', { n: c.humedad }) : '';
        tic();
    }

    /* ----------------------------------------------------------- tarjetas */
    const ICONO_SVC = {
        packetlens: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/><path d="M6.5 10.5h1.6l1.2-2.6 2 5.2 1.2-2.6h1.5"/></svg>',
        netkit: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7M3 12.5h18M10 12.5v2h4v-2"/></svg>',
        aves: '<svg viewBox="0 0 24 24"><path d="M16 7.5a3 3 0 0 0-5.8 1.1L4 13.5c2.5 3 7 3.6 10 1.3A6.5 6.5 0 0 0 16.6 9"/><path d="m16 7.5 3.5 1-3 .9"/><path d="m9 17-1 3.5M12 17.2l.5 3.3"/></svg>',
        secreto: '<svg viewBox="0 0 24 24"><rect x="3.5" y="9" width="17" height="11.5" rx="1.5"/><path d="M2.5 9h19M12 9v11.5"/><path d="M12 9c-1.5-3.5-5.5-4.5-5.5-1.8C6.5 9 12 9 12 9Zm0 0c1.5-3.5 5.5-4.5 5.5-1.8C17.5 9 12 9 12 9Z"/></svg>',
        mired: '<svg viewBox="0 0 24 24"><path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9 14.2a4.3 4.3 0 0 1 6 0M10.6 16.4a2 2 0 0 1 2.8 0"/></svg>',
    };
    const FLECHA = '<svg class="flecha" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';

    // 7 min · 1 h 13 min · 2 d 3 h
    function lapso(m) {
        if (m < 60) return `${m} min`;
        if (m < 1440) return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
        return `${Math.floor(m / 1440)} d${Math.floor((m % 1440) / 60) ? ` ${Math.floor((m % 1440) / 60)} h` : ''}`;
    }
    const HERRAMIENTA_NK = {
        'mi-ip': { es: 'Mi IP', en: 'My IP' }, subredes: { es: 'Subredes IPv4', en: 'IPv4 subnets' }, ipv6: { es: 'IPv6', en: 'IPv6' },
        dns: { es: 'Consulta DNS', en: 'DNS lookup' }, correo: { es: 'SPF/DKIM/DMARC', en: 'SPF/DKIM/DMARC' }, mac: { es: 'Fabricante por MAC', en: 'MAC vendor' },
        whois: { es: 'Whois', en: 'Whois' }, http: { es: 'Cabeceras HTTP', en: 'HTTP headers' }, conversor: { es: 'Conversor de IP', en: 'IP converter' }, puertos: { es: 'Puertos', en: 'Ports' },
    };

    /* Dato en vivo de cada app: [estado (ok|warn|bad|''), línea principal, línea secundaria] */
    const VIVO = {
        packetlens() {
            const a = estado && estado.packetlens;
            return a ? ['', `<b>${num(a.analisis30)}</b> ${esc(t('app.capturas'))}`, t('app.visitas', { n: num(a.visitas30) })] : null;
        },
        netkit() {
            const n = estado && estado.netkit;
            if (!n) return null;
            const top = n.top ? L(HERRAMIENTA_NK[n.top] || { es: n.top, en: n.top }) : '';
            return ['', `<b>${num(n.usos30)}</b> ${esc(t('app.consultas'))}`, top ? t('app.top', { h: top }) : ''];
        },
        aves() {
            const s = estado && estado.sonda;
            if (!s) return null;
            const cls = s.estado === 'escuchando' ? 'ok' : s.estado === 'pausa' || s.estado === 'sin_audio' ? 'warn' : 'bad';
            const det = [];
            if (s.estado === 'sin_senal' || s.estado === 'sin_datos') { if (s.reporteMin != null) det.push(t('sonda.reporte', { m: lapso(s.reporteMin) })); }
            else {
                if (s.audioMin != null) det.push(t('app.audio', { m: lapso(s.audioMin) }));
                if (s.bateria != null) det.push(`${s.cargando ? '⚡' : '🔋'} ${s.bateria} %`);
            }
            return [cls, `${esc(t('sonda.titulo'))} <b>${esc(t('sonda.' + s.estado))}</b>`, det.join(' · ')];
        },
        secreto() {
            const d = diasNavidad();
            return ['', d === 0 ? `<b>🎄 ${esc(t('sec.hoy'))}</b>` : `<b>${num(d)}</b> ${esc(t('sec.faltan'))}`, ''];
        },
        mired() {
            const st = svcEstado('mired');
            if (!st) return null;
            return [st.ok ? 'ok' : 'bad', `${esc(t('mr.tunel'))} <b>${esc(st.ok ? t('mr.arriba') : t('mr.abajo'))}</b>`, t('app.privado')];
        },
    };

    function renderCards() {
        const cont = $('#cards');
        cont.classList.remove('par');
        cont.classList.add('lanzador');
        cont.innerHTML = C.servicios.map((s) => {
            const st = svcEstado(s.id);
            const e = !st ? 'cargando' : st.ok ? 'ok' : 'caido';
            const enlace = s.privado ? s.url : `${s.url}${lang === 'en' ? (s.id === 'aves' ? '/en/' : '/?lang=en') : ''}`;
            const v = (VIVO[s.id] || (() => null))();
            const vivo = v
                ? `<span class="app-vivo ${v[0]}">${v[0] ? '<i class="pt"></i>' : ''}<span class="v1">${v[1]}</span>${v[2] ? `<span class="v2">${esc(v[2])}</span>` : ''}</span>`
                : '<span class="app-vivo"><span class="skel" style="width:70%"></span></span>';
            const latencia = !st ? t('svc.revisando') : st.ok ? `${t('svc.operativo')} · ${st.ms} ms` : t('svc.caido');
            return `<a class="svc app c-${esc(s.color || 'azul')}" href="${esc(enlace)}" rel="noopener" data-estado="${e}" data-id="${esc(s.id)}">
                <span class="app-arte" aria-hidden="true">
                    <span class="app-ico">${ICONO_SVC[s.id] || ''}</span>
                    <span class="app-led ${e === 'ok' ? 'ok' : e === 'caido' ? 'bad' : ''}" title="${esc(latencia)}"></span>
                    ${s.privado ? '<span class="app-candado">🔒</span>' : ''}
                </span>
                <span class="app-txt">
                    <span class="app-nombre">${esc(L(s.nombre))}${s.beta ? ' <span class="tag-beta">beta</span>' : ''}</span>
                    <span class="app-lema">${esc(L(s.lema || s.tipo))}</span>
                    ${vivo}
                </span>
                <span class="app-ir">${esc(s.privado ? t('app.entrar') : t('svc.abrir'))} ${FLECHA}</span>
            </a>`;
        }).join('');
    }

    /* ---------------------------------------------------------- bitácora */
    function eventosVivos() {
        if (!estado) return [];
        const ev = [];
        const hora = horaGT(new Date(estado.actualizado), false);
        for (const s of estado.servicios) {
            const nom = host(C.servicios.find((x) => x.id === s.id)?.url || `https://${s.id}`);
            if (!s.ok) ev.push({ t: hora, nivel: 'error', origen: s.id, texto: t('log.auto.caido', { s: nom, c: s.codigo || s.error || '—' }) });
            else if (s.ms > 2000) ev.push({ t: hora, nivel: 'aviso', origen: s.id, texto: t('log.auto.lento', { s: nom, ms: s.ms }) });
        }
        const a = estado.aves && (estado.aves[lang] || estado.aves.es || estado.aves.en);
        if (a && a.hallazgo) {
            ev.push({
                t: hora, nivel: 'info', origen: 'sonda',
                texto: t('log.auto.aves', { h: a.hallazgo, r: a.rareza ? ` (${a.rareza})` : '', e: a.especies, d: a.detecciones }),
            });
        }
        return ev;
    }
    function renderLog() {
        const vivos = eventosVivos().map((e) => ({ ...e, vivo: true }));
        const fijos = (C.bitacora || []).map((e) => ({ t: e.fecha, nivel: e.nivel, origen: e.origen, texto: L(e.texto) }));
        $('#log').innerHTML = [...vivos, ...fijos].map((e) =>
            `<li class="${e.vivo ? 'vivo-evt' : ''}"><span class="t">${esc(e.t)}</span><span class="n ${esc(e.nivel)}">${esc(e.nivel)}</span>
             <span class="m"><span class="o">${esc(e.origen)}:</span>${esc(e.texto)}</span></li>`).join('');
    }

    /* -------------------------------------------------------------- banco */
    function renderBanco() {
        $('#banco-lista').innerHTML = (C.banco || []).map((b) => `<li>
            <div class="fila"><h3>${esc(L(b.nombre))}</h3><span class="est ${esc(b.estado)}">${esc(t('banco.' + b.estado))}</span></div>
            <p>${esc(L(b.desc))}</p>
            ${Number.isFinite(b.progreso) ? `<div class="barra" role="progressbar" aria-valuenow="${b.progreso}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(L(b.nombre))}"><i style="width:${Math.max(0, Math.min(100, b.progreso))}%"></i></div>` : ''}
        </li>`).join('');
    }

    /* ------------------------------------------------------------- perfil */
    function renderPerfil() {
        const pf = C.perfil;
        if (!pf) { $('#perfil').hidden = true; return; }
        const ficha = L(pf.ficha);
        const ancho = Math.max(...ficha.map(([k]) => k.length)) + 2;
        $('#perfil-txt').innerHTML =
            `<p><span class="p">$</span> whoami</p><p class="out"><b>selvin.mejia</b></p>` +
            `<p><span class="p">$</span> cat ${ES() ? 'perfil' : 'profile'}.txt</p>` +
            ficha.map(([k, v]) => `<p class="kv"><span class="kk">${esc(k.padEnd(ancho))}</span><span>${esc(v)}</span></p>`).join('') +
            `<p><span class="p">$</span> <span class="cursor"></span></p>`;
        $('#perfil-tray').innerHTML = pf.trayectoria.map((x, i) => `<li class="${i === 0 ? 'hoy' : ''}">
            <span class="anios mono">${esc(L(x.anios))}</span><b>${esc(L(x.rol))}</b><span class="d">${esc(L(x.desc))}</span></li>`).join('');
        $('#perfil-dest').innerHTML = (pf.destacados || []).map((d) => `<article class="dest">
            <span class="dest-ico" aria-hidden="true">${ICONOS_DEST[d.id] || ''}</span><h3>${esc(L(d.titulo))}</h3><p>${esc(L(d.desc))}</p></article>`).join('');
        $('#perfil-stack').innerHTML = pf.stack.map((g) => `<div class="grupo g-${esc(g.id)}">
            <h3>${ICONOS[g.id] || ''}${esc(L(g.titulo))}</h3>
            <ul>${g.items.map((x) => `<li${x && x.curso ? ' class="curso"' : ''}>${esc(L(x))}</li>`).join('')}</ul></div>`).join('');
    }
    const ICONOS_DEST = {
        segmentacion: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
        firewall: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14.5h18M9 4v5M15 9v5.5M9 14.5V20"/></svg>',
        rural: '<svg viewBox="0 0 24 24"><path d="M12 21V11"/><path d="M8.5 7.5a5 5 0 0 1 7 0M6 5a8.5 8.5 0 0 1 12 0"/><circle cx="12" cy="10" r="1.4"/><path d="M8 21h8"/></svg>',
        capacidad: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
        auditoria: '<svg viewBox="0 0 24 24"><path d="M9 4h6l1 2h3v14H5V6h3Z"/><path d="m9 13 2 2 4-4"/></svg>',
        datacenter: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="6" rx="1.5"/><rect x="4" y="11" width="16" height="6" rx="1.5"/><path d="M8 6h.01M8 14h.01M4 21h16"/></svg>',
    };
    const ICONOS = {
        seguridad: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6Z"/><path d="m9 12 2 2 4-4"/></svg>',
        redes: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-2h12v2"/></svg>',
        monitoreo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l2-5 4 10 2-5h6"/></svg>',
        infra: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="7" rx="1.5"/><rect x="4" y="14" width="16" height="7" rx="1.5"/><path d="M8 6.5h.01M8 17.5h.01"/></svg>',
        certs: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9" r="5"/><path d="m9 13.5-1.5 7.5 4.5-2.5 4.5 2.5-1.5-7.5"/></svg>',
    };

    function renderTodo() {
        renderPerfil();
        renderPanel();
        renderCards();
        renderLog();
        renderBanco();
    }

    /* ------------------------------------------------------ /api/estado */
    async function cargarEstado() {
        try {
            const r = await fetch('/api/estado', { headers: { Accept: 'application/json' } });
            if (!r.ok) throw new Error(r.status);
            const j = await r.json();
            if (!j.servicios) throw new Error('formato');
            estado = j;
            estadoError = false;
        } catch (e) {
            estadoError = true;
        }
        renderTodo();
        return estado;
    }

    /* ============================================================ APOYO */
    const apoyo = $('#apoyo');
    let focoApoyo = null;
    $$('.monto', apoyo).forEach((a) => {
        const m = a.dataset.monto;
        a.href = m === 'otro' ? C.apoyar : `${C.apoyar}/${m}USD`;
        a.addEventListener('click', () => { $('#apoyo-gracias').hidden = false; evento('donar_clic', m); });
    });
    function abrirApoyo(desde) {
        evento('donar_ver', typeof desde === 'string' ? desde : 'pie');
        focoApoyo = document.activeElement;
        $('#apoyo-gracias').hidden = true;
        apoyo.hidden = false;
        setTimeout(() => $('.monto', apoyo).focus(), 20);
    }
    function cerrarApoyo() {
        apoyo.hidden = true;
        if (!term.hidden) input.focus();
        else if (focoApoyo && focoApoyo.focus) focoApoyo.focus();
    }
    $$('[data-apoyo]').forEach((b) => b.addEventListener('click', () => abrirApoyo(b.dataset.apoyo || 'pie')));
    $('[data-cerrar]', apoyo).addEventListener('click', cerrarApoyo);
    apoyo.addEventListener('click', (e) => { if (e.target === apoyo) cerrarApoyo(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !apoyo.hidden) { e.stopImmediatePropagation(); cerrarApoyo(); } }, true);

    /* ================================================ HUEVOS DE PASCUA */
    const ALIAS_EXTRA = {};
    const HUEVOS = {
        matrix: { nombre: 'The Matrix', pista: { es: 'Hay que elegir una pastilla…', en: 'You have to pick a pill…' } },
        bttf: { nombre: 'Volver al futuro', pista: { es: 'A 88 millas por hora verás algo serio.', en: 'At 88 miles per hour you will see some serious stuff.' } },
        rpo: { nombre: 'Ready Player One', pista: { es: 'Un código clásico de consola, en la página.', en: 'A classic console code, on the page.' } },
        spiderman: { nombre: 'Spider-Man', pista: { es: 'Pide poderes de administrador.', en: 'Ask for admin powers.' } },
        ironman: { nombre: 'Iron Man', pista: { es: 'Llama al asistente de Tony.', en: "Call Tony's assistant." } },
        avengers: { nombre: 'Avengers', pista: { es: 'Reúne a todo el equipo.', en: 'Assemble the whole team.' } },
        saw: { nombre: 'SAW', pista: { es: 'Alguien quiere jugar un juego.', en: 'Someone wants to play a game.' } },
        rapido: { nombre: 'Rápido y furioso', pista: { es: 'Un botón de óxido nitroso.', en: 'A nitrous oxide button.' } },
        tortugas: { nombre: 'Tortugas Ninja', pista: { es: 'Una palabra de surfistas y pizza.', en: 'A surfer word and pizza.' } },
        gadget: { nombre: 'Inspector Gadget', pista: { es: 'Go-go… ¿qué?', en: 'Go-go… what?' } },
        rangers: { nombre: 'Power Rangers', pista: { es: 'Es hora de transformarse.', en: "It's that time." } },
        pokemon: { nombre: 'Pokémon', pista: { es: 'Consulta la enciclopedia de bolsillo.', en: 'Check the pocket encyclopedia.' } },
        naruto: { nombre: 'Naruto', pista: { es: '¡De veras!', en: 'Believe it!' } },
        dbz: { nombre: 'Dragon Ball Z', pista: { es: 'Carga la técnica de la tortuga.', en: "Charge the turtle's technique." } },
        deathnote: { nombre: 'Death Note', pista: { es: 'Borra todo a la fuerza.', en: 'Force-delete everything.' } },
    };
    const encontrados = new Set();
    try { JSON.parse(localStorage.getItem('sm.huevos') || '[]').forEach((x) => HUEVOS[x] && encontrados.add(x)); } catch (e) {}
    let toastT = null;
    function huevo(id) {
        if (EFECTOS[id] && !matchMedia('(prefers-reduced-motion: reduce)').matches) EFECTOS[id]();
        if (!HUEVOS[id] || encontrados.has(id)) return;
        encontrados.add(id);
        evento('huevo', id);
        try { localStorage.setItem('sm.huevos', JSON.stringify([...encontrados])); } catch (e) {}
        let el = $('#toast');
        if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
        el.innerHTML = `<span>🥚</span><div><b>${esc(ES() ? 'Huevo encontrado' : 'Egg found')}: ${esc(HUEVOS[id].nombre)}</b><small>${encontrados.size} / ${Object.keys(HUEVOS).length}</small></div>`;
        el.className = 'ver';
        clearTimeout(toastT);
        toastT = setTimeout(() => { el.className = ''; }, 3800);
        contarHuevos();
    }
    function contarHuevos() {
        const c = $('#huevo-cuenta');
        if (c) c.textContent = `${encontrados.size} / ${Object.keys(HUEVOS).length}`;
        const b = $('#huevo-pie');
        if (b) b.classList.toggle('alguno', encontrados.size > 0);
    }

    /* ---------- efectos visuales de cada huevo */
    const capa = (clase, html = '', ms = 3000) => {
        const el = document.createElement('div');
        el.className = 'fx ' + clase;
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = html;
        document.documentElement.appendChild(el);   // fuera de <body>: el destello del 88 usa filter en body
        setTimeout(() => el.remove(), ms);
        return el;
    };
    function lluviaEmoji(emojis, n = 26) {
        const html = Array.from({ length: n }, () => {
            const e = emojis[Math.floor(Math.random() * emojis.length)];
            return `<i style="left:${Math.random() * 100}%;animation-delay:${(Math.random() * 1.2).toFixed(2)}s;animation-duration:${(1.8 + Math.random() * 1.6).toFixed(2)}s;font-size:${20 + Math.random() * 22}px">${e}</i>`;
        }).join('');
        capa('fx-lluvia', html, 4200);
    }
    const cruzar = (emoji, clase = '') => capa('fx-cruza ' + clase, `<i>${emoji}</i>`, 2600);
    function bocadilloPollito(texto) {
        const caja = $('.avatar-box');
        if (!caja) return;
        const b = document.createElement('span');
        b.className = 'pio';
        b.textContent = texto;
        caja.appendChild(b);
        setTimeout(() => b.remove(), 2200);
    }
    const EFECTOS = {
        bttf: () => { capa('fx-estela', '<i></i><i></i>', 1800); capa('fx-88 mono', '88 MPH', 1800); },
        rpo: () => lluviaEmoji(['🥚', '🥚', '🗝️', '🏆']),
        spiderman: () => capa('fx-telarana', '<svg viewBox="0 0 200 200"><g fill="none" stroke="currentColor" stroke-width="1.4"><path d="M200 0 0 200M200 0 60 200M200 0 130 200M200 0 0 130M200 0 0 60M200 0 0 0"/><path d="M170 0q-4 26 30 30M130 0q-8 62 70 70M88 0q-12 100 112 112M45 0q-14 140 155 155"/></g></svg>', 4200),
        ironman: () => capa('fx-hud', '<i></i><i></i><i></i><b class="mono">J.A.R.V.I.S. · ONLINE</b>', 3200),
        avengers: () => lluviaEmoji(['⚡', '🛡️', '🔨', '💎', '🕷️']),
        saw: () => capa('fx-saw', '<b class="mono">¿QUIERES JUGAR UN JUEGO?</b>'.replace('¿QUIERES JUGAR UN JUEGO?', ES() ? '¿QUIERES JUGAR UN JUEGO?' : 'DO YOU WANT TO PLAY A GAME?'), 2600),
        rapido: () => cruzar('🏎️', 'rapido'),
        tortugas: () => lluviaEmoji(['🍕', '🍕', '🐢']),
        gadget: () => cruzar('🚁', 'gadget'),
        pokemon: () => bocadilloPollito(ES() ? '¡Pío! ⚡' : 'Peep! ⚡'),
        naruto: () => lluviaEmoji(['🍥', '🍜', '🍥'], 20),
        dbz: () => capa('fx-rayo', '<i></i>', 1600),
        deathnote: () => capa('fx-manzana', '<i>🍎</i>', 2600),
    };

    // Lluvia de Matrix en toda la página (unos segundos)
    function lluviaMatrix(ms = 6000) {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches || $('#lluvia')) return;
        const cv = document.createElement('canvas');
        cv.id = 'lluvia';
        document.body.appendChild(cv);
        const cx = cv.getContext('2d');
        const W = (cv.width = innerWidth), H = (cv.height = innerHeight);
        const f = 16, cols = Math.ceil(W / f), y = Array.from({ length: cols }, () => Math.random() * -50);
        const ch = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789';
        const fin = performance.now() + ms;
        (function cuadro(ahora) {
            cx.fillStyle = 'rgba(0, 8, 3, 0.12)';
            cx.fillRect(0, 0, W, H);
            cx.font = `${f}px ui-monospace, Menlo, monospace`;
            for (let i = 0; i < cols; i++) {
                cx.fillStyle = Math.random() > 0.96 ? '#d9ffe4' : '#22c55e';
                cx.fillText(ch[Math.floor(Math.random() * ch.length)], i * f, y[i] * f);
                if (y[i] * f > H && Math.random() > 0.975) y[i] = 0;
                y[i]++;
            }
            if (ahora < fin) requestAnimationFrame(cuadro);
            else { cv.classList.add('fuera'); setTimeout(() => cv.remove(), 800); }
        })(performance.now());
    }

    // Ready Player One: código Konami en la página
    const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let kIdx = 0;
    document.addEventListener('keydown', (e) => {
        const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        kIdx = k === KONAMI[kIdx] ? kIdx + 1 : k === KONAMI[0] ? 1 : 0;
        if (kIdx === KONAMI.length) {
            kIdx = 0;
            huevo('rpo');
        }
    });

    // Pokémon: clic al pollito
    const pollito = $('.avatar .av-ave');
    if (pollito) {
        pollito.style.cursor = 'pointer';
        pollito.addEventListener('click', (e) => { e.stopPropagation(); huevo('pokemon'); if (encontrados.has('pokemon')) bocadilloPollito(ES() ? '¡Pío!' : 'Peep!'); });
    }

    // Códigos escritos en cualquier parte de la página (sin abrir la terminal)
    const CODIGOS = { matrix: 'matrix', delorean: 'bttf', morph: 'rangers', cowabunga: 'tortugas', jarvis: 'ironman', kamehameha: 'dbz', dattebayo: 'naruto', pikachu: 'pokemon', avengers: 'avengers', jigsaw: 'saw', gadget: 'gadget', spidey: 'spiderman', ryuk: 'deathnote', toretto: 'rapido' };
    let tecleo = '';
    document.addEventListener('keydown', (e) => {
        if (/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || '') || e.metaKey || e.ctrlKey || e.key.length !== 1) return;
        tecleo = (tecleo + e.key.toLowerCase()).slice(-12);
        for (const [palabra, id] of Object.entries(CODIGOS)) {
            if (tecleo.endsWith(palabra)) {
                tecleo = '';
                if (id === 'matrix') lluviaMatrix();
                if (id === 'rangers') { root.classList.add('ranger'); setTimeout(() => root.classList.remove('ranger'), 3200); }
                if (id === 'bttf') { document.body.classList.add('flash'); setTimeout(() => document.body.classList.remove('flash'), 700); }
                huevo(id);
            }
        }
    });

    // Pistas discretas
    const reloj = $('#reloj');
    if (reloj) reloj.title = '88 mph → delorean';
    const av = $('.avatar');
    if (av) av.addEventListener('mouseenter', () => { av.querySelector('title').textContent = ES() ? 'Sigue al pollito blanco… (5 clics)' : 'Follow the white chick… (5 clicks)'; }, { once: true });
    try {
        console.log('%c🥚 ¿Curioseando el código? Hay 15 huevos de pascua escondidos.\n%cAbre la terminal con ` y escribe: huevos\n…o prueba el código Konami. ↑↑↓↓←→←→BA',
            'font: 600 14px system-ui; color: #fbbf24', 'font: 13px ui-monospace, monospace; color: #22d3ee');
    } catch (e) {}

    // Matrix: cinco clics al avatar
    let clicsAvatar = 0, clicsT = null;
    $('.avatar') && $('.avatar').addEventListener('click', () => {
        clicsAvatar++;
        clearTimeout(clicsT);
        clicsT = setTimeout(() => { clicsAvatar = 0; }, 1500);
        if (clicsAvatar >= 5) { clicsAvatar = 0; lluviaMatrix(); huevo('matrix'); }
    });

    /* =========================================================== TERMINAL */
    const term = $('#term');
    const out = $('#term-out');
    const input = $('#term-input');
    const historial = [];
    let hIdx = 0;
    let focoPrevio = null;

    const linea = (html, cls = '') => {
        const d = document.createElement('div');
        if (cls) d.className = cls;
        d.innerHTML = html;
        out.appendChild(d);
        out.scrollTop = out.scrollHeight;
    };
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));
    const svcPorNombre = (n) => C.servicios.find((s) => s.id === n || host(s.url) === n || host(s.url).split('.')[0] === n);

    function abrirTerm(como) {
        if (!term.hidden) return;
        evento('terminal', como === 'tecla' ? 'tecla' : 'boton');
        focoPrevio = document.activeElement;
        term.hidden = false;
        document.body.style.overflow = 'hidden';
        if (!out.childElementCount) {
            linea(`<span class="c">selvinmejia.com</span> <span class="d">— NOC v1 · ${esc(fechaGT())} ${esc(horaGT())} GT</span>`);
            linea(t('term.bienvenida'));
            linea('');
        }
        setTimeout(() => input.focus(), 20);
    }
    function cerrarTerm() {
        term.hidden = true;
        document.body.style.overflow = '';
        if (focoPrevio && focoPrevio.focus) focoPrevio.focus();
    }
    $$('[data-term-open]').forEach((b) => b.addEventListener('click', () => abrirTerm('boton')));
    $('#term-x').addEventListener('click', cerrarTerm);
    term.addEventListener('click', (e) => { if (e.target === term) cerrarTerm(); });
    document.addEventListener('keydown', (e) => {
        const enCampo = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') && document.activeElement !== input;
        if ((e.key === '`' || e.key === '~') && term.hidden && !enCampo) { e.preventDefault(); abrirTerm('tecla'); }
        else if (e.key === 'Escape' && !term.hidden) cerrarTerm();
    });

    const ES = () => lang === 'es';
    const COMANDOS = {
        help() {
            const filas = ES() ? [
                ['whoami', 'quién soy'], ['ls', 'lista los servicios'], ['status', 'estado en vivo de todo'],
                ['ping <servicio>', 'ping a ' + C.servicios.map((x) => x.id).join(', ')], ['traceroute selvin', 'la ruta hasta mí'],
                ['open <servicio>', 'abre un proyecto'], ['aves', 'el hallazgo del día'], ['clima', 'el clima en Ciudad de Guatemala'],
                ['date', 'fecha y hora en Guatemala'], ['uptime', 'cuánto llevamos en línea'], ['lang es|en', 'cambia el idioma'],
                ['theme dark|light', 'cambia el tema'], ['apoyar', 'invítame un café'], ['contacto', 'mi correo'], ['history', 'comandos que escribiste'], ['clear', 'limpia la pantalla'], ['exit', 'cierra la terminal'],
            ] : [
                ['whoami', 'who I am'], ['ls', 'list services'], ['status', 'live status of everything'],
                ['ping <service>', 'ping ' + C.servicios.map((x) => x.id).join(', ')], ['traceroute selvin', 'the route to me'],
                ['open <service>', 'open a project'], ['birds', 'find of the day'], ['weather', 'weather in Guatemala City'],
                ['date', 'date and time in Guatemala'], ['uptime', 'how long the site has been up'], ['lang es|en', 'switch language'],
                ['theme dark|light', 'switch theme'], ['support', 'buy me a coffee'], ['contact', 'my email'], ['history', 'commands you typed'], ['clear', 'clear the screen'], ['exit', 'close the terminal'],
            ];
            linea(filas.map(([c, d]) => `  <span class="c">${esc(c.padEnd(20))}</span><span class="d">${esc(d)}</span>`).join('\n'));
            linea(`\n<span class="w">🥚 ${ES() ? 'Hay huevos de pascua escondidos en este sitio. Escribe' : 'There are easter eggs hidden on this site. Type'}</span> <span class="c">${ES() ? 'huevos' : 'eggs'}</span>`);
        },
        whoami() {
            const pf = C.perfil;
            if (pf) {
                const ficha = L(pf.ficha);
                const ancho = Math.max(...ficha.map(([k]) => k.length)) + 2;
                linea(`<b>selvin.mejia</b>\n` + ficha.map(([k, v]) => `<span class="d">${esc(k.padEnd(ancho))}</span>${esc(v)}`).join('\n') +
                    `\n<span class="d">${ES() ? 'Prefiero que hablen los proyectos: escribe ' : 'I let the projects speak: type '}</span><span class="c">ls</span>`);
                return;
            }
            linea(ES()
                ? '<b>Selvin Mejía</b> — ingeniero de redes en Guatemala.\nConstruyo herramientas pequeñas, útiles y gratuitas.\nCuando no estoy viendo paquetes en Wireshark, estoy escuchando aves.\n<span class="d">Prefiero que hablen los proyectos: escribe </span><span class="c">ls</span>'
                : '<b>Selvin Mejía</b> — network engineer in Guatemala.\nI build small, useful, free tools.\nWhen I am not reading packets in Wireshark, I am listening to birds.\n<span class="d">I let the projects speak: type </span><span class="c">ls</span>');
        },
        ls() {
            linea(C.servicios.map((s) => {
                const st = svcEstado(s.id);
                const e = !st ? '<span class="d">?</span>' : st.ok ? '<span class="ok">●</span>' : '<span class="e">●</span>';
                return `${e} <span class="c">${esc(s.id.padEnd(12))}</span>${s.privado ? '🔒' : '  '}<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(host(s.url))}</a>  <span class="d">${esc(L(s.tipo))}</span>`;
            }).join('\n'));
        },
        async status() {
            linea(`<span class="d">${ES() ? 'consultando…' : 'querying…'}</span>`);
            await cargarEstado();
            if (!estado) return linea(`<span class="e">${esc(t('panel.sinDatos'))}</span>`);
            const malos = estado.servicios.filter((s) => !s.ok).length;
            linea(estado.servicios.map((s) => `${s.ok ? '<span class="ok">UP  </span>' : '<span class="e">DOWN</span>'}  ${esc(s.id.padEnd(12))} ${esc(String(s.codigo || '---'))}  ${esc(String(s.ms).padStart(5))} ms`).join('\n'));
            linea(malos === 0 ? `<span class="ok">${esc(t('panel.todos'))}</span>` : `<span class="w">${esc(t('panel.parcial', { n: malos, t: estado.servicios.length }))}</span>`);
        },
        async ping(args) {
            const s = svcPorNombre(args[0]);
            if (!s) return linea(`<span class="e">ping: ${esc(args[0] || '')}: ${ES() ? 'servicio desconocido. Prueba: ' : 'unknown service. Try: '}${C.servicios.map((x) => x.id).join(', ')}</span>`);
            const h = host(s.url);
            linea(`PING ${esc(h)}: ${ES() ? 'midiendo desde tu navegador' : 'measuring from your browser'}`);
            const tiempos = [];
            for (let i = 0; i < 4; i++) {
                const t0 = performance.now();
                try {
                    await fetch(`${s.url}/favicon.ico?p=${Date.now()}`, { mode: 'no-cors', cache: 'no-store' });
                    const ms = performance.now() - t0;
                    tiempos.push(ms);
                    linea(`${ES() ? 'respuesta de' : 'reply from'} ${esc(h)}: seq=${i} ${ES() ? 'tiempo' : 'time'}=${ms.toFixed(1)} ms`);
                } catch (e) {
                    linea(`<span class="e">${ES() ? 'tiempo agotado' : 'request timeout'} seq=${i}</span>`);
                }
                await espera(250);
            }
            const ok = tiempos.length;
            const prom = ok ? tiempos.reduce((a, b) => a + b, 0) / ok : 0;
            linea(`<span class="d">--- ${esc(h)} ping ---\n4 ${ES() ? 'enviados' : 'transmitted'}, ${ok} ${ES() ? 'recibidos' : 'received'}, ${Math.round((1 - ok / 4) * 100)}% ${ES() ? 'pérdida' : 'loss'}${ok ? `, ${ES() ? 'promedio' : 'avg'} ${prom.toFixed(1)} ms` : ''}</span>`);
        },
        async traceroute(args) {
            const dest = (args[0] || 'selvin').toLowerCase();
            const saltos = ES() ? [
                ['tu-navegador.local', 'el punto de partida'], ['cloudflare-edge', 'el borde más cercano a ti'],
                ['guatemala.gt', 'tierra de volcanes y quetzales'], ['cafe.dispensador', 'parada técnica obligatoria'],
                ['wireshark.pcapng', 'revisando que no haya retransmisiones'], ['patio.sonda', 'un clarinero responde primero'],
                ['selvin.mejia', 'llegaste. ¡Bienvenido!'],
            ] : [
                ['your-browser.local', 'the starting point'], ['cloudflare-edge', 'the edge closest to you'],
                ['guatemala.gt', 'land of volcanoes and quetzals'], ['coffee.dispenser', 'mandatory technical stop'],
                ['wireshark.pcapng', 'checking for retransmissions'], ['backyard.probe', 'a grackle answers first'],
                ['selvin.mejia', 'you made it. Welcome!'],
            ];
            if (dest !== 'selvin' && dest !== 'selvinmejia.com') return linea(`<span class="w">traceroute: ${ES() ? 'solo conozco la ruta hasta' : 'I only know the route to'} selvin</span>`);
            linea(`traceroute ${ES() ? 'a' : 'to'} selvin.mejia, 30 hops max`);
            for (let i = 0; i < saltos.length; i++) {
                await espera(280);
                const ms = (3 + i * 4 + Math.random() * 3).toFixed(1);
                linea(` ${String(i + 1).padStart(2)}  <span class="c">${esc(saltos[i][0].padEnd(20))}</span>${ms} ms  <span class="d">${esc(saltos[i][1])}</span>`);
            }
        },
        open(args) {
            const s = svcPorNombre(args[0]);
            if (!s) return linea(`<span class="e">open: ${ES() ? 'servicio desconocido' : 'unknown service'}</span>`);
            linea(`<span class="ok">→</span> ${ES() ? 'abriendo' : 'opening'} ${esc(host(s.url))}…${s.privado ? ` <span class="w">(${esc(t('mr.login'))})</span>` : ''}`);
            window.open(s.url, '_blank', 'noopener');
        },
        async aves() {
            if (!estado) await cargarEstado();
            const a = estado && estado.aves && (estado.aves[lang] || estado.aves.es || estado.aves.en);
            if (!a) return linea(`<span class="w">${esc(t('aves.sinDatos'))}</span>`);
            if (!a.hallazgo) return linea(esc(a.texto));
            linea(`<span class="v">🐦 ${esc(a.hallazgo)}</span>${a.rareza ? ` <span class="w">[${esc(a.rareza)}]</span>` : ''}\n${num(a.especies)} ${esc(t('aves.especies'))} · ${num(a.detecciones)} ${esc(t('aves.detecciones'))}\n<a href="https://aves.selvinmejia.com${ES() ? '/' : '/en/'}" target="_blank" rel="noopener">aves.selvinmejia.com</a>`);
        },
        async clima() {
            if (!estado) await cargarEstado();
            const c = estado && estado.clima;
            if (!c) return linea(`<span class="w">${ES() ? 'Sin datos del clima ahora mismo.' : 'No weather data right now.'}</span>`);
            linea(`${esc(t('panel.clima'))}: <b>${esc(climaTxt(c))}</b>${c.humedad != null ? ` · ${esc(t('panel.humedad', { n: c.humedad }))}` : ''}  <span class="d">(Open-Meteo)</span>`);
        },
        date() {
            const f = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'es-GT', { timeZone: TZ, dateStyle: 'full', timeStyle: 'medium' }).format(new Date());
            linea(`${esc(f)} <span class="d">(America/Guatemala, UTC−6)</span>`);
        },
        uptime() {
            const anios = new Date().getFullYear() - 2011;
            linea(`<span class="d">${ES() ? `ingeniero: up ${anios} años (desde 2011), 0 caídas graves reportadas` : `engineer: up ${anios} years (since 2011), 0 major outages reported`}</span>`);
            const d = Math.max(0, Math.floor((Date.now() - Date.parse(C.lanzamiento + 'T00:00:00-06:00')) / 86400e3));
            linea(ES() ? `${horaGT()} up ${d} ${d === 1 ? 'día' : 'días'}, 1 usuario (tú), carga: café 0.82, 0.91, 1.00` : `${horaGT()} up ${d} ${d === 1 ? 'day' : 'days'}, 1 user (you), load average: coffee 0.82, 0.91, 1.00`);
        },
        lang(args) {
            const n = (args[0] || '').toLowerCase();
            if (n !== 'es' && n !== 'en') return linea('<span class="w">lang es | lang en</span>');
            cambiarIdioma(n);
            linea(`<span class="ok">✓</span> ${n === 'es' ? 'Idioma: español' : 'Language: English'}`);
        },
        theme(args) {
            const n = (args[0] || '').toLowerCase();
            if (n && n !== 'dark' && n !== 'light') return linea('<span class="w">theme dark | theme light</span>');
            cambiarTema(n || undefined);
            linea(`<span class="ok">✓</span> theme: ${esc(root.dataset.theme)}`);
        },
        history() { linea(historial.map((h, i) => `${String(i + 1).padStart(4)}  ${esc(h)}`).join('\n') || '<span class="d">(vacío)</span>'); },
        clear() { out.innerHTML = ''; },
        exit() { cerrarTerm(); },
        sudo() {
            linea(`<span class="v">🕷 ${ES() ? 'Un gran poder conlleva una gran responsabilidad.' : 'With great power comes great responsibility.'}</span>\n<span class="e">${ES() ? 'selvin no está en el archivo sudoers. Este incidente será reportado.' : 'selvin is not in the sudoers file. This incident will be reported.'}</span>`);
            huevo('spiderman');
        },
        echo(args) { linea(esc(args.join(' '))); },
        contacto() {
            const c = correo();
            linea(`${ES() ? '¿Una consulta, una idea o un proyecto? Escríbeme:' : 'A question, an idea or a project? Write to me:'}\n<a href="mailto:${c}">${c}</a>`);
            evento('contacto', 'terminal');
        },
        apoyar() { linea(`<span class="v">♥</span> ${esc(t('apoyo.titulo'))}`); abrirApoyo('terminal'); },
        rm(args) {
            if (!args.join(' ').includes('-rf')) return linea(`<span class="e">rm: ${ES() ? 'permiso denegado' : 'permission denied'}</span>`);
            linea(`<span class="v">📓 ${ES() ? 'Escribiste un nombre en la Death Note… pero era un directorio. Ryuk se ríe. Permiso denegado.' : 'You wrote a name in the Death Note… but it was a directory. Ryuk laughs. Permission denied.'}</span>`);
            huevo('deathnote');
        },
    };
    /* ------------------------------------------------- huevos de pascua */
    const anioAzar = () => [1885, 1955, 1985, 2015][Math.floor(Math.random() * 4)];
    Object.assign(COMANDOS, {
        huevos() {
            const n = encontrados.size;
            linea(`<b>🥚 ${ES() ? 'Huevos de pascua' : 'Easter eggs'}: ${n} / ${Object.keys(HUEVOS).length}</b>`);
            linea(Object.entries(HUEVOS).map(([id, h]) => encontrados.has(id)
                ? `  <span class="ok">✓</span> ${esc(h.nombre)}`
                : `  <span class="d">· ${esc(L(h.pista))}</span>`).join('\n'));
            if (n === Object.keys(HUEVOS).length) linea(`<span class="ok">${ES() ? '¡Los encontraste todos! Eres un verdadero Gunter.' : 'You found them all! A true Gunter.'}</span>`);
        },
        matrix() {
            linea(`<span class="ok">${ES() ? 'Despierta, Neo…' : 'Wake up, Neo…'}</span>\n<span class="d">${ES() ? 'Sigue al pollito blanco. 🐤' : 'Follow the white chick. 🐤'}</span>`);
            lluviaMatrix();
            huevo('matrix');
        },
        pastilla(args) {
            const c = (args[0] || '').toLowerCase();
            if (c === 'azul' || c === 'blue') return linea(`<span class="c">${ES() ? 'Fin de la historia. Despiertas en tu cama y crees lo que quieras creer.' : 'The story ends. You wake up in your bed and believe whatever you want.'}</span>`);
            if (c === 'roja' || c === 'red') return COMANDOS.matrix();
            linea(`<span class="w">${ES() ? '¿Roja o azul?' : 'Red or blue?'}</span>`);
        },
        flux() {
            linea(`⚡ ${ES() ? 'Condensador de flujo: 1.21 gigawatts' : 'Flux capacitor: 1.21 gigawatts'}\n🚗 88 mph… <b>${ES() ? 'destino' : 'destination'}: ${anioAzar()}</b>`);
            document.body.classList.add('flash');
            setTimeout(() => document.body.classList.remove('flash'), 700);
            huevo('bttf');
        },
        jarvis() {
            linea(`<span class="c">J.A.R.V.I.S.: ${ES() ? 'todos los sistemas en línea, señor. El traje está listo.' : 'all systems online, sir. The suit is ready.'}</span>`);
            huevo('ironman');
        },
        async avengers() {
            linea(`<b>${ES() ? 'Avengers… ¡reúnanse!' : 'Avengers… assemble!'}</b>`);
            await COMANDOS.status();
            huevo('avengers');
        },
        jigsaw() {
            linea(`<span class="e">🎭 ${ES() ? 'Hola, visitante. ¿Quieres jugar un juego? Encuentra todos los huevos antes de que se acabe el tiempo.' : 'Hello, visitor. Do you want to play a game? Find every egg before time runs out.'}</span>`);
            huevo('saw');
        },
        nos() {
            linea(`<span class="c">🏎 NOS ${ES() ? 'activado' : 'engaged'}: ping → 0.25 ms</span> <span class="d">(${ES() ? 'en la vida real no' : 'not in real life'})</span>\n${ES() ? 'Lo más importante siempre será la familia.' : 'The most important thing will always be family.'}`);
            huevo('rapido');
        },
        cowabunga() {
            linea(`🍕 <b>${ES() ? '¡Cowabunga!' : 'Cowabunga!'}</b> ${ES() ? 'Cuatro pizzas entregadas en la alcantarilla.' : 'Four pizzas delivered to the sewer.'}`);
            huevo('tortugas');
        },
        gadget() {
            linea(`🕵️ <b>${ES() ? '¡Go-go-gadget terminal!' : 'Go-go-gadget terminal!'}</b>\n<span class="d">${ES() ? '…salió el helicóptero del sombrero. Otra vez.' : '…the hat helicopter came out. Again.'}</span>`);
            huevo('gadget');
        },
        morph() {
            linea(`<b>${ES() ? '¡Es hora de transformarse!' : "It's morphin' time!"}</b> 🔴🔵🟡🩷⚫`);
            root.classList.add('ranger');
            setTimeout(() => root.classList.remove('ranger'), 3200);
            huevo('rangers');
        },
        pokedex(args) {
            linea(`<b>Pokédex #0088 — ${ES() ? 'Pollo' : 'Pollo'}</b>\n${ES() ? 'Tipo: Normal / Red. Habilidad: troubleshooting. Evoluciona con café.' : 'Type: Normal / Network. Ability: troubleshooting. Evolves with coffee.'}\n<span class="d">${ES() ? 'Suele verse en el hombro de su entrenador.' : 'Often seen on its trainer’s shoulder.'}</span>`);
            huevo('pokemon');
        },
        dattebayo() {
            linea(`🍥 <b>${ES() ? '¡De veras!' : 'Believe it!'}</b> ${ES() ? 'Nunca retrocedo en un ticket: ese es mi camino ninja.' : 'I never back down from a ticket: that is my ninja way.'}`);
            huevo('naruto');
        },
        kamehameha() {
            linea(`<span class="c">${ES() ? 'Ka… me… ha… me…' : 'Ka… me… ha… me…'}</span>`);
            setTimeout(() => {
                linea(`<span class="c">HAAAAA ════════════════════════▶ 💥</span>\n<span class="w">${ES() ? '¡Su nivel de pelea es de más de 8000!' : "It's over 9000!"}</span>`);
                huevo('dbz');
            }, 600);
        },
    });
    Object.assign(ALIAS_EXTRA, {
        neo: 'matrix', morpheus: 'matrix', morfeo: 'matrix', pill: 'pastilla',
        '88': 'flux', delorean: 'flux', doc: 'flux', marty: 'flux',
        ironman: 'jarvis', stark: 'jarvis', assemble: 'avengers', 'reúnanse': 'avengers', vengadores: 'avengers',
        saw: 'jigsaw', juego: 'jigsaw', familia: 'nos', family: 'nos', toretto: 'nos',
        pizza: 'cowabunga', tortugas: 'cowabunga', tmnt: 'cowabunga', 'go-go-gadget': 'gadget', inspector: 'gadget',
        rangers: 'morph', 'morphin': 'morph', pikachu: 'pokedex', pokemon: 'pokedex', 'pokémon': 'pokedex', pollo: 'pokedex',
        naruto: 'dattebayo', rasengan: 'dattebayo', goku: 'kamehameha', vegeta: 'kamehameha', dbz: 'kamehameha',
        eggs: 'huevos', easter: 'huevos', spiderman: 'sudo', spidey: 'sudo', kira: 'rm', ryuk: 'rm',
    });

    const ALIAS = { '?': 'help', ayuda: 'help', servicios: 'ls', services: 'ls', estado: 'status', birds: 'aves', weather: 'clima', fecha: 'date', abrir: 'open', tema: 'theme', idioma: 'lang', cls: 'clear', mail: 'contacto', email: 'contacto', correo: 'contacto', contact: 'contacto', donate: 'apoyar', support: 'apoyar', donar: 'apoyar', salir: 'exit', quit: 'exit', about: 'whoami', 'cat': 'whoami', tracert: 'traceroute' };

    async function ejecutar(texto) {
        const limpio = texto.trim();
        linea(esc(limpio), 'cmd');
        if (!limpio) return;
        historial.push(limpio);
        hIdx = historial.length;
        const [cmd, ...args] = limpio.split(/\s+/);
        const nombre = ALIAS[cmd.toLowerCase()] || ALIAS_EXTRA[cmd.toLowerCase()] || cmd.toLowerCase();
        const fn = COMANDOS[nombre];
        evento('comando', fn ? nombre.replace(/[^a-z0-9_]/g, '').slice(0, 24) : 'desconocido');
        if (!fn) return linea(`<span class="e">${esc(cmd)}: ${ES() ? 'comando no encontrado. Escribe' : 'command not found. Type'} </span><span class="c">help</span>`);
        input.disabled = true;
        try { await fn(args); } finally { input.disabled = false; if (!term.hidden) input.focus(); }
    }
    $('#term-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const v = input.value;
        input.value = '';
        ejecutar(v);
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' && historial.length) { e.preventDefault(); hIdx = Math.max(0, hIdx - 1); input.value = historial[hIdx]; }
        else if (e.key === 'ArrowDown') { e.preventDefault(); hIdx = Math.min(historial.length, hIdx + 1); input.value = historial[hIdx] || ''; }
        else if (e.key === 'Tab') {
            e.preventDefault();
            const v = input.value.trimStart();
            const partes = v.split(/\s+/);
            const opciones = partes.length <= 1
                ? Object.keys(COMANDOS).filter((c) => c.startsWith(partes[0]))
                : C.servicios.map((s) => s.id).filter((c) => c.startsWith(partes[partes.length - 1]));
            if (opciones.length === 1) { partes[partes.length - 1] = opciones[0]; input.value = partes.join(' ') + ' '; }
            else if (opciones.length > 1) linea(`<span class="d">${esc(opciones.join('  '))}</span>`);
        }
        else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); out.innerHTML = ''; }
    });

    /* ----------------------------------------------------------- contacto */
    // El correo se arma en el navegador (menos spam de robots que leen el HTML)
    const correo = () => ['info', 'selvinmejia.com'].join('@');
    function pintarContacto() {
        const c = correo();
        $$('[data-correo]').forEach((a) => { a.href = `mailto:${c}`; a.querySelector('[data-correo-txt]') ? (a.querySelector('[data-correo-txt]').textContent = c) : (a.textContent = c); });
    }
    $$('[data-correo]').forEach((a) => a.addEventListener('click', () => evento('contacto', 'correo')));
    const copiar = $('#copiar-correo');
    if (copiar) copiar.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(correo()); } catch (e) { return; }
        copiar.classList.add('ok');
        copiar.querySelector('span').textContent = t('contacto.copiado');
        evento('contacto', 'copiar');
        setTimeout(() => { copiar.classList.remove('ok'); copiar.querySelector('span').textContent = t('contacto.copiar'); }, 1800);
    });
    $('#cards').addEventListener('click', (e) => {
        const a = e.target.closest('a.svc');
        if (a && a.dataset.id) evento('proyecto', a.dataset.id);
    });

    /* -------------------------------------------------------------- inicio */
    $('#anio').textContent = fechaGT().slice(0, 4);
    aplicarIdioma();
    pintarContacto();
    contarHuevos();
    {
        let nueva = true, vuelve = 0;
        try {
            nueva = !sessionStorage.getItem('sm.v');
            sessionStorage.setItem('sm.v', '1');
            vuelve = localStorage.getItem('sm.visto') ? 1 : 0;
            localStorage.setItem('sm.visto', '1');
        } catch (e) { /* modo privado */ }
        if (nueva) evento('visita', lang, { o: origenVisita(), r: vuelve, th: root.dataset.theme });
    }
    if ($('#huevo-pie')) $('#huevo-pie').addEventListener('click', () => { abrirTerm(); setTimeout(() => ejecutar('huevos'), 60); });
    cargarEstado();
    setInterval(tic, 1000);
    setInterval(() => { if (!document.hidden) cargarEstado(); }, REFRESCO);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && estado && Date.now() - Date.parse(estado.actualizado) > REFRESCO) cargarEstado();
    });
})();
