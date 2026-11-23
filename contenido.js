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
                ['estudiando', 'AWS Solutions Architect – Associate (SAA-C03)'],
                ['tiempo libre', 'Creo herramientas web gratuitas y registro las aves de Guatemala con una sonda de audio propia'],
            ],
            en: [
                ['role', 'Senior Cybersecurity Engineer'],
                ['based', 'Guatemala City'],
                ['online', 'since 2011'],
                ['focus', 'Next-generation firewalls, SD-WAN and high availability'],
                ['degree', 'B.S. in Telecommunications Technology and Management'],
                ['studying', 'AWS Solutions Architect – Associate (SAA-C03)'],
                ['free time', 'I build free web tools and log the birds of Guatemala with my own audio probe'],
            ],
        },
        trayectoria: [
            { anios: { es: '2025 — hoy', en: '2025 — now' }, rol: { es: 'Ingeniero Senior de Ciberseguridad', en: 'Senior Cybersecurity Engineer' },
              desc: { es: 'La operación completa de red y seguridad, ahora enfocada en el ecosistema Fortinet: FortiGate, FortiManager y FortiAnalyzer, SD-WAN de alta disponibilidad y ciberseguridad.', en: 'End-to-end network and security operations, now focused on the Fortinet ecosystem: FortiGate, FortiManager and FortiAnalyzer, high-availability SD-WAN and cybersecurity.' } },
            { anios: { es: '2024 — 2025', en: '2024 — 2025' }, rol: { es: 'Coordinador de Infraestructura y Operaciones TI', en: 'IT Infrastructure and Operations Lead' },
              desc: { es: 'Presupuesto y planes de trabajo de infraestructura: servidores, HCI, respaldos, NAC, EDR y el traslado del centro de datos. Disponibilidad de red superior al 99.9 %.', en: 'Infrastructure budget and work plans: servers, HCI, backups, NAC, EDR and the data center move. Network availability above 99.9%.' } },
            { anios: { es: '2016 — 2024', en: '2016 — 2024' }, rol: { es: 'Técnico en Telecomunicaciones', en: 'Telecommunications Technician' },
              desc: { es: 'Redes de plantas, fincas y oficinas en Guatemala y México: segmentación, migración a Fortinet, enlaces de microondas, Wi-Fi y las primeras SD-WAN.', en: 'Networks for plants, farms and offices in Guatemala and Mexico: segmentation, Fortinet migration, microwave links, Wi-Fi and the first SD-WAN rollouts.' } },
            { anios: { es: '2011 — 2016', en: '2011 — 2016' }, rol: { es: 'Seguridad e Infraestructura en Banca', en: 'Security and Infrastructure in Banking' },
              desc: { es: 'Firewall, proxy, IPS y monitoreo con PRTG para servicios a nivel nacional.', en: 'Firewall, proxy, IPS and PRTG monitoring for nationwide services.' } },
        ],
        // Trabajo destacado (sin nombres de empresas ni datos internos)
        destacados: [
            { id: 'segmentacion', titulo: { es: 'Segmentación de red', en: 'Network segmentation' },
              desc: { es: 'Del assessment a la implementación por fases, con switches Cisco y Meraki y pruebas de rutas en cada sede.', en: 'From assessment to phased rollout, with Cisco and Meraki switches and route testing at every site.' } },
            { id: 'firewall', titulo: { es: 'Migración a Fortinet', en: 'Fortinet migration' },
              desc: { es: 'Cambio de firewall, perfiles de navegación, VPN sitio a sitio, servicios publicados y registros en FortiAnalyzer.', en: 'Firewall replacement, web filtering profiles, site-to-site VPN, published services and FortiAnalyzer logging.' } },
            { id: 'rural', titulo: { es: 'Conectividad en el campo', en: 'Rural connectivity' },
              desc: { es: 'Enlaces de microondas Ubiquiti, Starlink y SD-WAN para llevar red a fincas, plantas y campamentos.', en: 'Ubiquiti microwave links, Starlink and SD-WAN to bring the network to farms, plants and camps.' } },
            { id: 'capacidad', titulo: { es: 'Capacidad y redundancia', en: 'Capacity and redundancy' },
              desc: { es: 'Estudios de capacidad mensuales y pruebas de redundancia programadas en cada sede, con PRTG como base.', en: 'Monthly capacity studies and scheduled redundancy tests at every site, built on PRTG.' } },
            { id: 'auditoria', titulo: { es: 'Auditoría y hardening', en: 'Audit and hardening' },
              desc: { es: 'Auditorías de TI, escaneo de vulnerabilidades, remediación de pruebas de ethical hacking, NAC y EDR.', en: 'IT audits, vulnerability scanning, ethical hacking remediation, NAC and EDR rollouts.' } },
            { id: 'datacenter', titulo: { es: 'Centro de datos', en: 'Data center' },
              desc: { es: 'Infraestructura hiperconvergente, respaldos con NetBackup, CMDB y el plan para trasladar el centro de datos.', en: 'Hyperconverged infrastructure, NetBackup backups, a CMDB and the plan to move the data center.' } },
        ],
        stack: [
            { id: 'seguridad', titulo: { es: 'Seguridad', en: 'Security' },
              items: ['FortiGate', 'FortiManager', 'FortiAnalyzer', 'Palo Alto Networks', 'Cisco ASA', 'CrowdStrike', 'Darktrace', 'Forescout NAC'] },
            { id: 'redes', titulo: { es: 'Redes', en: 'Networking' },
              items: ['Cisco IOS', 'Cisco Meraki', { es: 'Switches Dell', en: 'Dell switches' }, 'Fortinet SD-WAN', 'VMware VeloCloud', 'Ubiquiti PtP / PtMP', 'Ubiquiti UniFi · UISP', 'Starlink'] },
            { id: 'infra', titulo: { es: 'Infraestructura', en: 'Infrastructure' },
              items: ['VMware vSphere', { es: 'Hiperconvergencia (HCI)', en: 'Hyperconverged (HCI)' }, 'Veritas NetBackup', 'Active Directory', 'WSUS', 'Cisco Webex Room Kit'] },
            { id: 'monitoreo', titulo: { es: 'Monitoreo', en: 'Monitoring' },
              items: ['PRTG', 'SolarWinds', 'OpManager', 'Wireshark', 'Aranda'] },
            { id: 'certs', titulo: { es: 'Certificaciones', en: 'Certifications' },
              items: ['Cisco CCNA Routing & Switching', 'Cisco CCNA Wireless', 'Fortinet NSE 1 – 4', 'Fortinet FortiOS 6.2', 'Ubiquiti UBWS · UBWA · UEWA',
                      { es: 'AWS SAA-C03 · en curso', en: 'AWS SAA-C03 · in progress', curso: true }] },
        ],
    },

    servicios: [
        {
            id: 'packetlens',
            color: 'azul',
            url: 'https://packetlens.selvinmejia.com',
            nombre: { es: 'PacketLens', en: 'PacketLens' },
            tipo: { es: 'herramienta · redes', en: 'tool · networking' },
            desc: {
                es: 'Sube una captura de Wireshark y obtén un diagnóstico claro: quién habla con quién, qué conexiones fallan, latencias, TLS y seguridad. Todo se procesa en tu navegador.',
                en: 'Upload a Wireshark capture and get a clear diagnosis: who talks to whom, which connections fail, latency, TLS and security. Everything runs in your browser.',
            },
            etiquetas: ['PCAP', 'TCP/IP', 'TLS', 'Workers AI'],
        },
        {
            id: 'aves',
            color: 'verde',
            url: 'https://aves.selvinmejia.com',
            nombre: { es: 'Diario de Aves', en: 'Bird Diary' },
            tipo: { es: 'sensor · bioacústica', en: 'sensor · bioacoustics' },
            desc: {
                es: 'Una sonda escucha día y noche y publica qué aves cantaron.',
                en: 'A probe listens day and night and publishes which birds sang.',
            },
            etiquetas: ['Audio', 'iNaturalist', 'Open-Meteo'],
        },
        {
            id: 'secreto',
            color: 'corinto',
            url: 'https://secreto.selvinmejia.com',
            nombre: { es: 'Amigo Secreto', en: 'Secret Santa' },
            tipo: { es: 'app · temporada', en: 'app · seasonal' },
            desc: {
                es: 'Sorteo, listas de deseos y mensajes anónimos para tu intercambio.',
                en: 'Draw, wish lists and anonymous messages for your gift exchange.',
            },
            etiquetas: [{ es: 'Sorteo', en: 'Draw' }, { es: 'Listas de Deseos', en: 'Wish Lists' }, { es: 'Mensajes Anónimos', en: 'Anonymous Messages' }],
        },
        {
            id: 'mired',
            color: 'naranja',
            url: 'https://mired.selvinmejia.com',
            privado: true,
            nombre: { es: 'Mi Red', en: 'My Network' },
            tipo: { es: 'privado · red de la casa', en: 'private · home network' },
            desc: {
                es: 'El router de la casa, vigilado y sin puertos abiertos.',
                en: 'The home router, monitored, with no open ports.',
            },
            etiquetas: ['Cloudflare Tunnel', 'Cloudflare Access', 'Node.js'],
        },
    ],

    banco: [
        {
            nombre: { es: 'AWS Solutions Architect – Associate', en: 'AWS Solutions Architect – Associate' },
            desc: {
                es: 'Preparándome para el SAA-C03: llevar lo aprendido en redes y seguridad a la nube.',
                en: 'Preparing for the SAA-C03: taking networking and security experience to the cloud.',
            },
            estado: 'estudiando',
        },
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
            texto: { es: 'PacketLens estrena nombre y dominio: packetlens.selvinmejia.com.', en: 'PacketLens gets a new name and domain: packetlens.selvinmejia.com.' },
        },
        {
            fecha: '2026-11-19', nivel: 'deploy', origen: 'packetlens',
            texto: { es: 'PacketLens v2: diagrama de flujo, seguridad TLS y explicaciones con IA.', en: 'PacketLens v2: flow diagram, TLS security checks and AI explanations.' },
        },
        {
            fecha: '2026-11-10', nivel: 'deploy', origen: 'mired',
            texto: { es: 'Mi Red en línea: el router de la casa ya tiene quien lo vigile.', en: 'My Network is live: the home router finally has someone watching it.' },
        },
    ],
};
