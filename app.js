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
        $('#pie-hint').innerHTML = esc(t('pie.secreto', { k: '§' })).replace('§', '<kbd>`</kbd>');
        renderTodo();
    }
    function cambiarIdioma(nuevo) {
        lang = nuevo === 'en' ? 'en' : 'es';
        try { localStorage.setItem('sm.lang', lang); } catch (e) {}
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
    function vivoAves() {
        if (!estado) return '<span class="skel" style="width:70%"></span><span class="skel" style="width:45%"></span>';
        const a = estado.aves;
        const d = a && (a[lang] || a.es || a.en);
        if (!d || !d.hallazgo) return `<p class="nota">${esc(d && d.texto ? d.texto : t('aves.sinDatos'))}</p>`;
        const rara = /rar/i.test(d.rareza || '');
        return `<div class="k">${esc(t('aves.hallazgo'))}</div>
            <div class="ave">
                ${a.foto ? `<img src="${esc(a.foto)}" alt="${esc(d.hallazgo)}" loading="lazy" referrerpolicy="no-referrer">` : '<span></span>'}
                <div><div class="nombre">${esc(d.hallazgo)}</div>${d.rareza ? `<span class="chip ${rara ? 'rara' : ''}">${esc(d.rareza)}</span>` : ''}</div>
            </div>
            <div class="row">
                <div class="stat"><b>${num(d.especies)}</b><span>${esc(t('aves.especies'))}</span></div>
                <div class="stat"><b>${num(d.detecciones)}</b><span>${esc(t('aves.detecciones'))}</span></div>
            </div>`;
    }
    function vivoPacketlens() {
        if (!estado) return '<span class="skel" style="width:50%"></span><span class="skel" style="width:70%"></span>';
        const a = estado.packetlens;
        if (!a) return `<p class="nota">${esc(t('an.privado'))}</p>`;
        return `<div class="big">${num(a.analisis30)}</div>
            <div class="k">${esc(t('an.mes'))}</div>
            <div class="row">
                <div class="stat"><b>${num(a.analisisTotal)}</b><span>${esc(t('an.total'))}</span></div>
                <div class="stat"><b>${num(a.visitas30)}</b><span>${esc(t('an.visitas'))}</span></div>
            </div>`;
    }
    function vivoSecreto() {
        const d = diasNavidad();
        const mes = Number(fechaGT().slice(5, 7));
        const temporada = mes >= 11;
        return `<div class="big">${d === 0 ? '🎄' : num(d)}</div>
            <div class="k">${esc(d === 0 ? t('sec.hoy') : t('sec.faltan'))}</div>
            <p class="nota">${esc(temporada ? t('sec.temporada') : t('sec.fuera'))}</p>`;
    }
    function vivoMired() {
        const st = svcEstado('mired');
        const tun = !st ? '<span class="d">···</span>'
            : st.ok ? `<b class="ok-t">${esc(t('mr.arriba'))}</b>` : `<b class="bad-t">${esc(t('mr.abajo'))}</b>`;
        return `<div class="candado"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.2"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/><circle cx="12" cy="15.5" r="1.4"/></svg>
            <div><div class="k">${esc(t('mr.titulo'))}</div><div class="kv">${esc(t('mr.tunel'))}: ${tun}</div></div></div>
            <p class="nota">${esc(t('mr.nota'))}</p>`;
    }
    const VIVO = { aves: vivoAves, packetlens: vivoPacketlens, secreto: vivoSecreto, mired: vivoMired };

    function renderCards() {
        $('#cards').innerHTML = C.servicios.map((s) => {
            const st = svcEstado(s.id);
            const e = !st ? 'cargando' : st.ok ? 'ok' : 'caido';
            const etq = !st ? t('svc.revisando') : st.ok ? `${t('svc.operativo')} · ${st.ms} ms` : t('svc.caido');
            const enlace = s.privado ? s.url : `${s.url}${lang === 'en' ? (s.id === 'aves' ? '/en/' : '/?lang=en') : ''}`;
            return `<article class="card${s.privado ? ' privado' : ''}" data-estado="${e}">
                <div class="card-top"><span class="led ${e === 'ok' ? 'ok' : e === 'caido' ? 'bad' : ''}"></span>
                    <span class="host">${esc(host(s.url))}</span><span class="est">${esc(etq)}</span></div>
                <div class="card-body">
                    <span class="tipo">${esc(L(s.tipo))}</span>
                    <h3>${esc(L(s.nombre))}</h3>
                    <p class="desc">${esc(L(s.desc))}</p>
                    <div class="vivo">${(VIVO[s.id] || (() => ''))()}</div>
                    <ul class="tags">${(s.etiquetas || []).map((x) => `<li>${esc(L(x))}</li>`).join('')}</ul>
                </div>
                <div class="card-foot"><a class="card-link" href="${esc(enlace)}" rel="noopener">${s.privado ? '🔒 ' : ''}${esc(t('svc.abrir'))} ${esc(L(s.nombre))} →</a></div>
            </article>`;
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
        a.addEventListener('click', () => { $('#apoyo-gracias').hidden = false; });
    });
    function abrirApoyo() {
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
    $$('[data-apoyo]').forEach((b) => b.addEventListener('click', abrirApoyo));
    $('[data-cerrar]', apoyo).addEventListener('click', cerrarApoyo);
    apoyo.addEventListener('click', (e) => { if (e.target === apoyo) cerrarApoyo(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !apoyo.hidden) { e.stopImmediatePropagation(); cerrarApoyo(); } }, true);

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

    function abrirTerm() {
        if (!term.hidden) return;
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
    $$('[data-term-open]').forEach((b) => b.addEventListener('click', abrirTerm));
    $('#term-x').addEventListener('click', cerrarTerm);
    term.addEventListener('click', (e) => { if (e.target === term) cerrarTerm(); });
    document.addEventListener('keydown', (e) => {
        const enCampo = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') && document.activeElement !== input;
        if ((e.key === '`' || e.key === '~') && term.hidden && !enCampo) { e.preventDefault(); abrirTerm(); }
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
                ['theme dark|light', 'cambia el tema'], ['apoyar', 'invítame un café'], ['history', 'comandos que escribiste'], ['clear', 'limpia la pantalla'], ['exit', 'cierra la terminal'],
            ] : [
                ['whoami', 'who I am'], ['ls', 'list services'], ['status', 'live status of everything'],
                ['ping <service>', 'ping ' + C.servicios.map((x) => x.id).join(', ')], ['traceroute selvin', 'the route to me'],
                ['open <service>', 'open a project'], ['birds', 'find of the day'], ['weather', 'weather in Guatemala City'],
                ['date', 'date and time in Guatemala'], ['uptime', 'how long the site has been up'], ['lang es|en', 'switch language'],
                ['theme dark|light', 'switch theme'], ['support', 'buy me a coffee'], ['history', 'commands you typed'], ['clear', 'clear the screen'], ['exit', 'close the terminal'],
            ];
            linea(filas.map(([c, d]) => `  <span class="c">${esc(c.padEnd(20))}</span><span class="d">${esc(d)}</span>`).join('\n'));
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
        sudo() { linea(`<span class="e">${ES() ? 'selvin no está en el archivo sudoers. Este incidente será reportado.' : 'selvin is not in the sudoers file. This incident will be reported.'}</span>`); },
        echo(args) { linea(esc(args.join(' '))); },
        apoyar() { linea(`<span class="v">♥</span> ${esc(t('apoyo.titulo'))}`); abrirApoyo(); },
        rm(args) { linea(args.join(' ').includes('-rf') ? `<span class="w">${ES() ? 'Buen intento 😄' : 'Nice try 😄'}</span>` : `<span class="e">rm: ${ES() ? 'permiso denegado' : 'permission denied'}</span>`); },
    };
    const ALIAS = { '?': 'help', ayuda: 'help', servicios: 'ls', services: 'ls', estado: 'status', birds: 'aves', weather: 'clima', fecha: 'date', abrir: 'open', tema: 'theme', idioma: 'lang', cls: 'clear', donate: 'apoyar', support: 'apoyar', donar: 'apoyar', salir: 'exit', quit: 'exit', about: 'whoami', 'cat': 'whoami', tracert: 'traceroute' };

    async function ejecutar(texto) {
        const limpio = texto.trim();
        linea(esc(limpio), 'cmd');
        if (!limpio) return;
        historial.push(limpio);
        hIdx = historial.length;
        const [cmd, ...args] = limpio.split(/\s+/);
        const nombre = ALIAS[cmd.toLowerCase()] || cmd.toLowerCase();
        const fn = COMANDOS[nombre];
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

    /* -------------------------------------------------------------- inicio */
    $('#anio').textContent = fechaGT().slice(0, 4);
    aplicarIdioma();
    cargarEstado();
    setInterval(tic, 1000);
    setInterval(() => { if (!document.hidden) cargarEstado(); }, REFRESCO);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && estado && Date.now() - Date.parse(estado.actualizado) > REFRESCO) cargarEstado();
    });
})();
