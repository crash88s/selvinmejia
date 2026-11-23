/* ==========================================================================
   CONTENIDO DEL SITIO — este es el único archivo que necesitas tocar
   para mantener selvinmejia.com al día (textos en español e inglés).

   - servicios: tus proyectos publicados. Los datos en vivo (estado, latencia,
     hallazgo del día, capturas analizadas) los pone solo el Worker.
   - banco:     lo que estás construyendo ("En el banco de trabajo").
   - bitacora:  el registro de eventos. Agrega arriba lo más nuevo.
                nivel: 'ok' | 'info' | 'aviso' | 'deploy'
   ========================================================================== */
window.CONTENIDO = {
    lanzamiento: '2026-11-23',
    apoyar: 'https://www.paypal.com/paypalme/crash88s',   // los montos se agregan solos: /3USD, /5USD, /10USD

    // Perfil (sección 04 y comando whoami). Sin datos de contacto ni nombres de empresas, a propósito.
    perfil: {
        rol: { es: 'Ingeniero Senior de Ciberseguridad', en: 'Senior Cybersecurity Engineer' },
        // Líneas del "cat perfil.txt": [etiqueta, valor]
        ficha: {
            es: [
                ['rol', 'Ingeniero Senior de Ciberseguridad'],
                ['base', 'Ciudad de Guatemala'],
                ['en línea', 'desde 2011'],
                ['enfoque', 'Firewalls de nueva generación, SD-WAN y alta disponibilidad'],
                ['formación', 'Lic. en Tecnología y Administración de las Telecomunicaciones'],
                ['fuera', 'Herramientas gratis, aves y café'],
            ],
            en: [
                ['role', 'Senior Cybersecurity Engineer'],
                ['based', 'Guatemala City'],
                ['online', 'since 2011'],
                ['focus', 'Next-generation firewalls, SD-WAN and high availability'],
                ['degree', 'B.S. in Telecommunications Technology and Management'],
                ['off hours', 'Free tools, birds and coffee'],
            ],
        },
        trayectoria: [
            { anios: { es: '2025 — hoy', en: '2025 — now' }, rol: { es: 'Ingeniero Senior de Ciberseguridad', en: 'Senior Cybersecurity Engineer' },
              desc: { es: 'Hardening de firewalls de nueva generación y SD-WAN con failover automático.', en: 'Next-generation firewall hardening and SD-WAN with automatic failover.' } },
            { anios: { es: '2024 — 2025', en: '2024 — 2025' }, rol: { es: 'Coordinador de Infraestructura y Operaciones TI', en: 'IT Infrastructure and Operations Lead' },
              desc: { es: 'Servidores, redes, almacenamiento y continuidad. Disponibilidad de red superior al 99.9 %.', en: 'Servers, networks, storage and continuity. Network availability above 99.9%.' } },
            { anios: { es: '2016 — 2024', en: '2016 — 2024' }, rol: { es: 'Técnico en Telecomunicaciones', en: 'Telecommunications Technician' },
              desc: { es: 'Cisco, Meraki, FortiGate, enlaces Ubiquiti y las primeras SD-WAN.', en: 'Cisco, Meraki, FortiGate, Ubiquiti links and the first SD-WAN rollouts.' } },
            { anios: { es: '2011 — 2016', en: '2011 — 2016' }, rol: { es: 'Seguridad e Infraestructura en Banca', en: 'Security and Infrastructure in Banking' },
              desc: { es: 'Firewall, proxy, IPS y monitoreo con PRTG para servicios a nivel nacional.', en: 'Firewall, proxy, IPS and PRTG monitoring for nationwide services.' } },
        ],
        stack: [
            { id: 'seguridad', titulo: { es: 'Seguridad', en: 'Security' }, items: ['FortiGate', 'FortiManager', 'FortiAnalyzer', 'Palo Alto Networks', 'CrowdStrike', 'Netskope', 'Darktrace', 'Lumu', 'Forescout NAC'] },
            { id: 'redes', titulo: { es: 'Redes', en: 'Networking' }, items: ['Cisco IOS', 'Cisco Meraki', 'SD-WAN', 'Ubiquiti PtP / PtMP'] },
            { id: 'monitoreo', titulo: { es: 'Monitoreo', en: 'Monitoring' }, items: ['PRTG', 'OpManager', 'Wireshark', 'Aranda'] },
            { id: 'certs', titulo: { es: 'Certificaciones', en: 'Certifications' }, items: ['Cisco CCNA R&S', 'Fortinet FortiOS 6.2', 'Ubiquiti UBWS · UBWA · UEWA'] },
        ],
    },

    servicios: [
        {
            id: 'aves',
            url: 'https://aves.selvinmejia.com',
            nombre: { es: 'Diario de Aves', en: 'Bird Diary' },
            tipo: { es: 'sensor · bioacústica', en: 'sensor · bioacoustics' },
            desc: {
                es: 'Una sonda con micrófono escucha día y noche y publica qué aves cantaron en Guatemala.',
                en: 'A microphone probe listens day and night and publishes which birds sang in Guatemala.',
            },
            etiquetas: ['Audio', 'iNaturalist', 'Open-Meteo'],
        },
        {
            id: 'packetlens',
            url: 'https://packetlens.selvinmejia.com',
            nombre: { es: 'PacketLens', en: 'PacketLens' },
            tipo: { es: 'herramienta · redes', en: 'tool · networking' },
            desc: {
                es: 'Convierte una captura de Wireshark en un diagnóstico claro. Todo se procesa en tu navegador.',
                en: 'Turns a Wireshark capture into a clear diagnosis. Everything runs in your browser.',
            },
            etiquetas: ['PCAP', 'TCP/IP', 'TLS', 'Workers AI'],
        },
        {
            id: 'secreto',
            url: 'https://secreto.selvinmejia.com',
            nombre: { es: 'Amigo Secreto', en: 'Secret Santa' },
            tipo: { es: 'app · temporada', en: 'app · seasonal' },
            desc: {
                es: 'Sorteo, listas de deseos y mensajes anónimos para el intercambio de regalos.',
                en: 'Draw, wish lists and anonymous messages for your gift exchange.',
            },
            etiquetas: [{ es: 'Sorteo', en: 'Draw' }, { es: 'Listas de Deseos', en: 'Wish Lists' }, { es: 'Mensajes Anónimos', en: 'Anonymous Messages' }],
        },
        {
            id: 'mired',
            url: 'https://mired.selvinmejia.com',
            privado: true,
            nombre: { es: 'Mi Red', en: 'My Network' },
            tipo: { es: 'privado · red de la casa', en: 'private · home network' },
            desc: {
                es: 'Dashboard del router de la casa: dispositivos conectados, nuevos y bloqueados, sin abrir puertos.',
                en: 'Home router dashboard: connected, new and blocked devices, with no open ports.',
            },
            etiquetas: ['Cloudflare Tunnel', 'Cloudflare Access', 'Node.js'],
        },
    ],

    banco: [
        {
            nombre: { es: 'Próximo Proyecto', en: 'Next Project' },
            desc: {
                es: 'Algo pequeño, útil y gratis. Todavía en la libreta.',
                en: 'Something small, useful and free. Still in the notebook.',
            },
            estado: 'idea',
            progreso: 10,
        },
    ],

    bitacora: [
        {
            fecha: '2026-11-23', nivel: 'deploy', origen: 'selvinmejia.com',
            texto: { es: 'Nuevo sitio principal en línea: un NOC personal con todos los proyectos.', en: 'New main site is live: a personal NOC with every project.' },
        },
        {
            fecha: '2026-11-23', nivel: 'deploy', origen: 'packetlens',
            texto: { es: 'TSHOOT Tool ahora se llama PacketLens y vive en packetlens.selvinmejia.com.', en: 'TSHOOT Tool is now PacketLens, at packetlens.selvinmejia.com.' },
        },
        {
            fecha: '2026-11-19', nivel: 'deploy', origen: 'packetlens',
            texto: { es: 'TSHOOT Tool v2: diagrama de flujo, seguridad TLS y explicaciones con IA.', en: 'TSHOOT Tool v2: flow diagram, TLS security checks and AI explanations.' },
        },
        {
            fecha: '2026-11-10', nivel: 'deploy', origen: 'mired',
            texto: { es: 'Mi Red en línea: el router de la casa ya tiene quien lo vigile.', en: 'My Network is live: the home router finally has someone watching it.' },
        },
    ],
};
