// main.js (VERSÃO FINAL COM CORREÇÃO DE FLICKER E ESTADO)

import { Viewer } from '@photo-sphere-viewer/core';
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';
import { GyroscopePlugin } from '@photo-sphere-viewer/gyroscope-plugin';

let $floorList, $plan, $viewerSection, $viewerContainer, $planTitle, $welcomeOverlay;
let FLOORS_DINAMICO = [];
let PANORAMAS_DATA_DINAMICO = {};
let photoSphereViewer;
let markersPluginInstance;

// Estados Globais
let pinnedMarkerId = null;       // ID do marcador fixo (clicado)
let hoveredMarkerId = null;      // ID do marcador sob o mouse (usado por hover/tooltip)
let blockUnpinOnClick = false;   // Trava para evitar conflito de clique
let currentlyShownTooltipId = null; // usado nas interações com a planta baixa
let isOpeningTooltip = false;    // CRÍTICO: Flag para impedir flicker/reabertura

const MARKERS_PANEL_ID = 'markers-list-panel';
const MARKERS_LIST_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="currentColor" d="M37.5 90S9.9 51.9 9.9 36.6 22.2 9 37.5 9s27.6 12.4 27.6 27.6S37.5 90 37.5 90zm0-66.3c-6.1 0-11 4.9-11 11s4.9 11 11 11 11-4.9 11-11-4.9-11-11-11zM86.7 55H70c-1.8 0-3.3-1.5-3.3-3.3s1.5-3.3 3.3-3.3h16.7c1.8 0 3.3 1.5 3.3 3.3S88.5 55 86.7 55zm0-25h-15a3.3 3.3 0 0 1-3.3-3.3c0-1.8 1.5-3.3 3.3-3.3h15c1.8 0 3.3 1.5 3.3 3.3 0 1.8-1.5 3.3-3.3 3.3zM56.5 73h30c1.8 0 3.3 1.5 3.3 3.3 0 1.8-1.5 3.3-3.3 3.3h-30a3.3 3.3 0 0 1-3.3-3.3 3.2 3.2 0 0 1 3.3-3.3z"></path></svg>`;

let isDrawingPolygon = false;
let currentPolygonPoints = [];

const POLYGON_STYLES = {
    'restrita': { fill: 'rgba(255, 0, 0, 0.3 )', stroke: 'red', 'stroke-width': '3px', 'stroke-dasharray': '8 4' },
    'segura': { fill: 'rgba(0, 255, 0, 0.3)', stroke: 'green', 'stroke-width': '2px' },
    'default': { fill: 'rgba(100, 100, 100, 0.3)', stroke: '#666', 'stroke-width': '2px' },
};

/* ========================================================================== 
   FUNÇÕES AUXILIARES
   ========================================================================== */

function createCarouselTooltipHTML(markerData) {
    const { id, Titulo, Descricao, Imagem, Pano_Destino_ID } = markerData;
    const mediaString = Imagem ? Imagem.replace(/"/g, '') : '';
    const mediaFiles = mediaString.split(',').map(file => file.trim()).filter(file => file);
    let mediaHTML = '';

    // Botão Fechar (X)
    const closeBtn = `<button class="tooltip-close-btn" onclick="event.preventDefault(); event.stopPropagation(); window.dispatchEvent(new CustomEvent('close-tooltip'))" onmousedown="event.stopPropagation()" ontouchstart="event.stopPropagation()">×</button>`;

    if (mediaFiles.length > 1) {
        const slides = mediaFiles.map(file => {
            const filePath = `images/${file}`;
            const isVideo = file.toLowerCase().endsWith('.mp4') || file.toLowerCase().endsWith('.webm');
            return isVideo 
                ? `<div class="swiper-slide"><video src="${filePath}" controls playsinline onmousedown="event.stopPropagation()" ontouchstart="event.stopPropagation"></video></div>` 
                : `<div class="swiper-slide"><img src="${filePath}" alt="${Titulo}" onmousedown="event.stopPropagation()" ontouchstart="event.stopPropagation"></div>`;
        }).join('');
        mediaHTML = `<div id="swiper-${id}" class="swiper-container"><div class="swiper-wrapper">${slides}</div><div class="swiper-pagination"></div><div class="swiper-button-prev" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()" ontouchstart="event.stopPropagation()"></div><div class="swiper-button-next" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()" ontouchstart="event.stopPropagation()"></div></div>`;
    } else if (mediaFiles.length === 1) {
        const file = mediaFiles[0];
        const filePath = `images/${file}`;
        const isVideo = file.toLowerCase().endsWith('.mp4') || file.toLowerCase().endsWith('.webm');
        const singleMediaContent = isVideo 
            ? `<video src="${filePath}" controls playsinline onmousedown="event.stopPropagation()" ontouchstart="event.stopPropagation"></video>` 
            : `<img src="${filePath}" alt="${Titulo}" onmousedown="event.stopPropagation()" ontouchstart="event.stopPropagation">`;
        mediaHTML = `<div class="tooltip-media-single">${singleMediaContent}</div>`;
    }

    let textHTML = '<div class="tooltip-text-content" onwheel="event.stopPropagation()" ontouchmove="event.stopPropagation()">';
    if (Titulo) textHTML += `<h2>${Titulo}</h2>`;
    if (Descricao) textHTML += `<p>${Descricao}</p>`;
    textHTML += '</div>';

    return closeBtn + mediaHTML + textHTML;
}

function togglePolygonDrawingMode() {
    isDrawingPolygon = !isDrawingPolygon; currentPolygonPoints = [];
    if (isDrawingPolygon) {
        if (photoSphereViewer) { photoSphereViewer.setOption('mousewheel', false); photoSphereViewer.setCursor('crosshair'); }
    } else {
        if (photoSphereViewer) { photoSphereViewer.setOption('mousewheel', true); photoSphereViewer.setCursor(null); }
    }
}

async function carregarMarkers360DoCSV(caminhoDoArquivoCSV, panoIdOrigem) {
    try {
        const resposta = await fetch(caminhoDoArquivoCSV);
        if (!resposta.ok) { console.warn(`Aviso: CSV não encontrado para ${panoIdOrigem}`); return []; }
        const textoCSV = await resposta.text();
        const linhas = textoCSV.trim().split('\n'); const cabecalho = linhas[0].split(';').map(h => h.trim()); const dados = linhas.slice(1);
        const colunas = ['Titulo', 'Descricao', 'Imagem', 'Pitch', 'Yaw', 'Pano_Destino_ID', 'poligono_json', 'Tipo_Poligono_CSS'];
        const indices = colunas.reduce((acc, col) => ({ ...acc, [col]: cabecalho.indexOf(col) }), {});
        
        if ([indices.Titulo, indices.Pitch, indices.Yaw].some(index => index === -1)) return [];
        
        const markers = [];
        for (const [index, linha] of dados.entries()) {
            if (!linha.trim()) continue;
            const valores = linha.split(';').map(v => v.trim()); const currentMarkerId = `${panoIdOrigem}-marker-${index}`;
            const markerDataFromCSV = {
                id: currentMarkerId, Titulo: valores[indices.Titulo] || 'Marcador sem título', Descricao: indices.Descricao > -1 ? (valores[indices.Descricao] || '') : '', Imagem: indices.Imagem > -1 ? (valores[indices.Imagem] || '') : '', Pitch: parseFloat(valores[indices.Pitch] || ''), Yaw: parseFloat(valores[indices.Yaw] || ''), Pano_Destino_ID: indices.Pano_Destino_ID > -1 ? (valores[indices.Pano_Destino_ID] || '') : ''
            };
            const poligonoJsonPath = indices.poligono_json > -1 ? (valores[indices.poligono_json] || '') : ''; const tipoPoligonoCss = indices.Tipo_Poligono_CSS > -1 ? (valores[indices.Tipo_Poligono_CSS] || '') : ''; const isNavigationMarker = markerDataFromCSV.Pano_Destino_ID.length > 0; const tooltipContent = createCarouselTooltipHTML(markerDataFromCSV);
            
            let markerConfig = {
                id: currentMarkerId,
                tooltip: null, // Controlado manualmente
                customTooltip: tooltipContent, 
                listContent: markerDataFromCSV.Titulo, data: { titleForList: markerDataFromCSV.Titulo, panoDestinoId: markerDataFromCSV.Pano_Destino_ID, isNavigation: isNavigationMarker }
            };

            if (poligonoJsonPath) {
                try {
                    const poligonoData = await fetch(`markers/${poligonoJsonPath}`).then(res => res.json());
                    if (Array.isArray(poligonoData) && poligonoData.every(v => typeof v.yaw === 'number' && typeof v.pitch === 'number')) {
                        markerConfig.polygon = poligonoData; markerConfig.svgStyle = POLYGON_STYLES[tipoPoligonoCss] || POLYGON_STYLES['default']; markerConfig.className = `${markerConfig.className || ''} ${tipoPoligonoCss || 'default'}`.trim();
                    } else if (!isNaN(markerDataFromCSV.Pitch) && !isNaN(markerDataFromCSV.Yaw)) { Object.assign(markerConfig, getPointMarkerConfig(currentMarkerId, isNavigationMarker, markerDataFromCSV)); }
                } catch (e) { if (!isNaN(markerDataFromCSV.Pitch) && !isNaN(markerDataFromCSV.Yaw)) { Object.assign(markerConfig, getPointMarkerConfig(currentMarkerId, isNavigationMarker, markerDataFromCSV)); } }
            } else {
                if (!isNaN(markerDataFromCSV.Pitch) && !isNaN(markerDataFromCSV.Yaw)) { Object.assign(markerConfig, getPointMarkerConfig(currentMarkerId, isNavigationMarker, markerDataFromCSV)); } else { continue; }
            }
            markers.push(markerConfig);
        }
        return markers;
    } catch (error) { console.error(`Erro marcadores:`, error); return []; }
}
function getPointMarkerConfig(id, isNavigation, data) {
    const color = isNavigation ? '#FFD700' : 'white';
    const svgIcon = isNavigation ? `<svg viewBox="0 0 100 100" width="100%" height="100%"><path fill="currentColor" d="M50 0C27.9 0 10 17.9 10 40c0 22.1 40 60 40 60s40-37.9 40-60C90 17.9 72.1 0 50 0zm0 55c-8.3 0-15-6.7-15-15s6.7-15 15-15 15 6.7 15 15-6.7 15-15 15z"/></svg>` : `<svg viewBox="0 0 100 100" width="100%" height="100%"><circle cx=50 cy=50 r=25 fill="currentColor"/><circle cx=50 cy=50 r=40 stroke-width=10 fill="none" stroke="currentColor"/></svg>`;
    
    return {
        position: { yaw: data.Yaw, pitch: data.Pitch },
        html: `<button data-marker-id="${id}" onmousedown="event.stopPropagation()" ontouchstart="event.stopPropagation()" style="width:100%;height:100%;padding:0;border:none;background:none;color:${color};border-radius:50%;filter:drop-shadow(0 10px 5px rgba(0,0,0,0.2));cursor:pointer;">${svgIcon}</button>`,
        size: { width: 25, height: 25 },
    };
}

async function carregarDadosDoCSV(caminhoDoArquivoCSV) {
    try {
        const resposta = await fetch(caminhoDoArquivoCSV);
        if (!resposta.ok) throw new Error(`Erro CSV principal: ${resposta.statusText}`);
        const textoCSV = await resposta.text();
        const linhas = textoCSV.trim().split('\n'); const cabecalho = linhas[0].split(';').map(h => h.trim()); const dados = linhas.slice(1);
        const colunas = ['Pavimento', 'Local', 'X', 'Y', 'Imagem_360', 'Markers_Info', 'Descricao_Pavimento', 'ID_Unico'];
        const indices = colunas.reduce((acc, col) => ({ ...acc, [col]: cabecalho.indexOf(col) }), {});
        
        if (['Pavimento', 'Local', 'X', 'Y', 'Imagem_360', 'ID_Unico'].some(col => indices[col] === -1)) return [];
        
        const floorsMap = new Map();
        for (const linha of dados) {
            if (!linha.trim()) continue;
            const valores = linha.split(';').map(v => v.trim());
            const pavimento = valores[indices.Pavimento]; if (!pavimento) continue;
            
            if (!floorsMap.has(pavimento)) {
                floorsMap.set(pavimento, {
                    name: pavimento, fileBasePath: `plans/${pavimento.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '_').replace(/º/g, '')}`, markers: [], description: indices.Descricao_Pavimento > -1 ? valores[indices.Descricao_Pavimento] : '',
                });
            }
            const imagem360 = valores[indices.Imagem_360] ? valores[indices.Imagem_360].replace(/^\//, '') : '';

            if (imagem360) {
                const idUnico = valores[indices.ID_Unico] || `pano${Date.now()}`;
                const markersInfoCSV = indices.Markers_Info > -1 ? (valores[indices.Markers_Info] || '').replace(/^\//, '') : '';
                PANORAMAS_DATA_DINAMICO[idUnico] = {
                    path: `panos/${imagem360}`, markers: markersInfoCSV ? await carregarMarkers360DoCSV(markersInfoCSV, idUnico) : [], floorName: pavimento, localName: valores[indices.Local]
                };
                
                floorsMap.get(pavimento).markers.push({
                    x: parseInt(valores[indices.X]), y: parseInt(valores[indices.Y]), panoId: idUnico, radius: 15, color: '#006837', label: valores[indices.Local]
                });
            }
        }
        return Array.from(floorsMap.values());
    } catch (error) { console.error("Erro fatal CSV:", error); return []; }
}

async function getBestImageFormat(basePath) {
    const webpUrl = `${basePath}.webp`;
    try { const response = await fetch(webpUrl, { method: 'HEAD' }); if (response.ok) return webpUrl; } catch (error) {}
    return `${basePath}.png`;
}

// === LÓGICA DE LIMPEZA ===
function clearAllTooltips() {
    console.log(`DEBUG: clearAllTooltips() iniciado. Pinned: ${pinnedMarkerId} Hovered: ${hoveredMarkerId}`); // L. 182
    if (!markersPluginInstance) { pinnedMarkerId = null; hoveredMarkerId = null; isOpeningTooltip = false; console.log(`DEBUG: clearAllTooltips() finalizado.`); return; }

    // Fechar tooltip fixo, se houver
    if (pinnedMarkerId) {
        try {
            markersPluginInstance.hideMarkerTooltip(pinnedMarkerId);
            markersPluginInstance.updateMarker({ id: pinnedMarkerId, tooltip: null });
        } catch (e) { }
    }
    
    // Fechar tooltip de hover, se houver
    if (hoveredMarkerId) {
        try {
            markersPluginInstance.hideMarkerTooltip(hoveredMarkerId);
            markersPluginInstance.updateMarker({ id: hoveredMarkerId, tooltip: null });
        } catch (e) { }
    }

    pinnedMarkerId = null; // <-- Limpa o estado
    hoveredMarkerId = null;
    currentlyShownTooltipId = null;
    isOpeningTooltip = false; 

    console.log(`DEBUG: clearAllTooltips() finalizado.`); // L. 204
}

async function inicializarAplicacao() {
    console.log("Aplicação inicializada."); // L. 207

    $floorList = document.getElementById('floor-list');
    $plan = document.getElementById('plan');
    $viewerSection = document.querySelector('.viewer');
    $viewerContainer = document.getElementById('viewer');
    $planTitle = document.querySelector('.plan h2');
    $welcomeOverlay = document.getElementById('welcome-overlay');

    if ($planTitle) $planTitle.textContent = 'Planta Baixa';
    if ($plan) { $plan.setAttribute('map-url', 'panos/placeholder.png'); $plan.markers = []; }
    
    const welcomeContent = $welcomeOverlay.querySelector('.welcome-content');
    welcomeContent.innerHTML = `<img src="images/logo-itap.png" alt="Logo ITAP" style="max-width: 150px; margin: 0 auto 20px; display: block;">
        <h2>Bem-vindo ao Tour Interativo do ITAP</h2>
        <p>Explore os espaços do instituto de forma fácil, intuitiva e imersiva:</p>
        <ul>
        <li><strong>Escolha um pavimento</strong> na lista acima para carregar a planta.</li>
        <li>Na planta, <strong>clique sobre os marcadores verdes</strong> para abrir a visão 360°.</li>
        <li>No ambiente 360°, use o mouse ou <strong>gire seu celular</strong> para olhar ao redor.</li>
        </ul>`;

    FLOORS_DINAMICO = await carregarDadosDoCSV('dados/marcadores.csv');
    if (FLOORS_DINAMICO.length === 0) {
        if ($viewerContainer) $viewerContainer.innerHTML = '<div style="text-align: center; color: #ff0000; padding: 20px;">Erro ao carregar dados.</div>';
        return;
    }

    if ($floorList) {
        $floorList.innerHTML = '';
        FLOORS_DINAMICO.forEach((f, idx) => {
            const li = document.createElement('li'); li.textContent = f.name; li.addEventListener('click', () => loadFloor(idx)); $floorList.append(li);
        });
    }

    photoSphereViewer = new Viewer({
        container: $viewerContainer,
        panorama: null, 
        caption: '', 
        loadingImg: null,
        navbar: [ 
            'zoom', 'move', 'gyroscope', 'markers', 
            { 
                id: 'markers-list-button', 
                content: MARKERS_LIST_ICON, 
                title: 'Lista de Marcadores', 
                className: 'custom-markers-list-button', 
                onClick: (viewer) => { 
                    if (!markersPluginInstance) return;
                    if (viewer.panel.isVisible(MARKERS_PANEL_ID)) { viewer.panel.hide(MARKERS_PANEL_ID); } else { 
                        const currentMarkers = markersPluginInstance.getMarkers ? markersPluginInstance.getMarkers() : [];
                        let panelContent = '';
                        if (currentMarkers.length > 0) { 
                            panelContent = '<div class="psv-panel-menu psv-panel-menu--stripped"><h1 class="psv-panel-menu-title">Marcadores</h1><ul class="psv-panel-menu-list">';
                            currentMarkers.forEach(marker => { const markerTitle = marker.data && marker.data.titleForList ? marker.data.titleForList : marker.id; panelContent += `<li class="psv-panel-menu-item" data-marker-id="${marker.id}" tabindex="0"><span class="psv-panel-menu-item-label">${markerTitle}</span></li>`; });
                            panelContent += '</ul></div>'; 
                        } else { panelContent = '<p style="padding: 1em; text-align: center;">Nenhum marcador disponível.</p>'; }
                        viewer.panel.show({ id: MARKERS_PANEL_ID, content: panelContent, noMargin: true, clickHandler: (target) => { const listItem = target.closest('.psv-panel-menu-item'); if (listItem) { const markerId = listItem.dataset.markerId; if (markerId) { markersPluginInstance.gotoMarker(markerId, 1500); viewer.panel.hide(MARKERS_PANEL_ID); } } } });
                    } 
                } 
            }, 
            'caption', 'fullscreen' 
        ],
        plugins: [ 
            [MarkersPlugin],
            [GyroscopePlugin] 
        ],
    });

    markersPluginInstance = photoSphereViewer.getPlugin(MarkersPlugin);

    // Helper: detect mobile (we only enable hover on desktop)
    const isMobileView = () => (window.innerWidth <= 820) || ('ontouchstart' in window && navigator.maxTouchPoints > 0);

    // Eventos do Tooltip (Proteção) + lógica de fechar quando sair da tooltip
    markersPluginInstance.addEventListener('open-tooltip', ({ marker }) => {
        try {
            if (marker && marker.tooltip && marker.tooltip.tooltipEl) {
                const tooltipEl = marker.tooltip.tooltipEl;
                const rootTooltip = tooltipEl.closest('.psv-tooltip') || tooltipEl;

                // PREVINE MÚLTIPLA REGISTRAÇÃO DE EVENTOS
                if (!tooltipEl._initialized) {
                    tooltipEl._initialized = true;

                    // 🔑 Lógica de Fechamento via pointerleave (ao sair da área do tooltip)
                    rootTooltip.addEventListener('pointerleave', () => {
                        // Se não estiver fixado, fecha.
                        if (pinnedMarkerId !== marker.id) {
                            markersPluginInstance.hideMarkerTooltip(marker.id);
                            markersPluginInstance.updateMarker({ id: marker.id, tooltip: null });
                            hoveredMarkerId = null; // Fecha imediatamente
                        }
                    });

                    // 🔑 Reforço de bloqueio e cursor default para evitar cursor 'mover'
                    rootTooltip.style.cursor = 'default';
                    
                    // Impede que tooltip roube eventos do mouse/scroll/click
                    ['mousedown','click','pointerdown','pointerup','touchstart','touchend','wheel','mousewheel','DOMMouseScroll']
                        .forEach(evt => {
                            tooltipEl.addEventListener(evt, e => e.stopPropagation(), { passive: false });
                            rootTooltip.addEventListener(evt, e => e.stopPropagation(), { passive: false });
                        });
                }
            }
        } catch (e) {
            console.error('Erro em open-tooltip listener', e);
        }
    });

    // --- HOVER (PC) ---
    markersPluginInstance.addEventListener('enter-marker', ({ marker }) => {
        // 1. Se já tem um marcador fixo (pinned), ignora o hover.
        if (pinnedMarkerId) return;

        // 2. Se for mobile/pequena tela, não usamos hover.
        const isMobile = isMobileView();
        if (isMobile) return;
        
        console.log(`DEBUG: enter-marker disparado para: ${marker.id}. Pinned: ${pinnedMarkerId}. Mobile: ${isMobile}.`); // L. 334

        // 🔑 CORREÇÃO CRÍTICA CONTRA O FLICKER: Se já estamos abrindo ou em hover neste marcador, ignora.
        if (isOpeningTooltip || hoveredMarkerId === marker.id) {
            return; 
        }

        if (marker && marker.config && marker.config.customTooltip) {
            // Limpar qualquer estado de hover anterior para evitar tooltips fantasmas.
            if (hoveredMarkerId && hoveredMarkerId !== marker.id) {
                clearAllTooltips(); 
            }
            
            hoveredMarkerId = marker.id;
            isOpeningTooltip = true; // CRÍTICO: Seta a flag de abertura (bloqueia re-entries)
            
            console.log(`DEBUG: Iniciando hover e abrindo tooltip para ${marker.id}.`); // L. 344

            try {
                // Abre o tooltip como não persistente
                markersPluginInstance.updateMarker({ 
                    id: marker.id, 
                    tooltip: { content: marker.config.customTooltip, persistent: false } 
                });
                
                // Delay para dar tempo ao PSV de renderizar E para liberar a flag de transição.
                setTimeout(() => {
                    if (hoveredMarkerId === marker.id && !pinnedMarkerId) {
                        markersPluginInstance.showMarkerTooltip(marker.id);
                    }
                    // Libera a flag após a tentativa de abertura ser concluída
                    isOpeningTooltip = false; 
                }, 100); 
            } catch (e) {
                console.error("Erro ao tentar abrir tooltip em hover", e);
                isOpeningTooltip = false; // Libera a flag em caso de erro
            }
        }
    });

    // --- LEAVE (PC) ---
    markersPluginInstance.addEventListener('leave-marker', ({ marker }) => {
        
        // 1. Se o marcador atual é o fixo (pinned), não fecha.
        if (pinnedMarkerId === marker.id) return;

        // 🔑 CORREÇÃO CRÍTICA: Fechamento forçado com delay para contornar o roubo de eventos do Canvas.
        const markerIdToClose = marker.id;
        
        setTimeout(() => {
            // Se após o delay, o marcador ainda for o ID que disparou o leave,
            // e não estiver fixo E *não* estiver em processo de abertura (isOpeningTooltip)
            if (hoveredMarkerId === markerIdToClose && pinnedMarkerId !== markerIdToClose && !isOpeningTooltip) {
                try {
                    // Força o fechamento
                    markersPluginInstance.hideMarkerTooltip(markerIdToClose);
                    markersPluginInstance.updateMarker({ id: markerIdToClose, tooltip: null });
                    hoveredMarkerId = null; // Libera o estado.
                } catch (e) {
                    // ignora
                }
            }
        }, 100); 
    });
    // --- CLIQUE (PC/MOBILE) ---
    markersPluginInstance.addEventListener('select-marker', async ({ marker }) => {
        try {
            // --- LÓGICA DE NAVEGAÇÃO ---
            // Se for marcador de navegação, navega e para a execução.
            if (marker.data && marker.data.isNavigation && marker.data.panoDestinoId) {
                clearAllTooltips();
                await handleNavigation(marker.data.panoDestinoId);
                return;
            }
            
            // --- LÓGICA DE INFORMAÇÃO (FIXAÇÃO) ---
            
            // 1. Limpa o estado de hover anterior para evitar conflitos
            if (hoveredMarkerId) {
                try {
                    if (markersPluginInstance) {
                        markersPluginInstance.hideMarkerTooltip(hoveredMarkerId);
                        markersPluginInstance.updateMarker({ id: hoveredMarkerId, tooltip: null });
                    }
                    hoveredMarkerId = null;
                } catch (e) {}
            }
            
            // 2. TOGGLE: Se clicar no mesmo marcador fixo, fecha tudo e desativa.
            if (pinnedMarkerId === marker.id) {
                clearAllTooltips();
                return;
            }

            // 3. Abrir novo marcador fixo: fecha anterior e abre o fixo
            // Devemos limpar antes de fixar o novo para fechar o anterior (se houver).
            clearAllTooltips(); 
            
            blockUnpinOnClick = true;

            // Move câmera/posição
            try {
                if (marker.position) {
                    photoSphereViewer.animate({
                        yaw: marker.position.yaw,
                        pitch: marker.position.pitch,
                        speed: 1000,
                    });
                } else {
                    markersPluginInstance.gotoMarker(marker.id, 1000);
                }
            } catch (e) {}

            // Abre o tooltip de forma persistente (pinned)
            if (marker.config && marker.config.customTooltip) {
                // ATUALIZAÇÃO CRÍTICA: Define a tooltip como persistente
                markersPluginInstance.updateMarker({ 
                    id: marker.id, 
                    tooltip: { content: marker.config.customTooltip, persistent: true } 
                });

                // ATUALIZAÇÃO CRÍTICA: Define o estado global e mostra a tooltip IMEDIATAMENTE.
                markersPluginInstance.showMarkerTooltip(marker.id);
                pinnedMarkerId = marker.id; // <-- Estado fixado aqui!

                // Inicializa o swiper/carousel (Mantido em setTimeout para segurança da renderização DOM)
                setTimeout(() => {
                    const swiperContainer = document.querySelector(`#swiper-${marker.id}`);
                    if (swiperContainer && !swiperContainer.classList.contains('swiper-initialized')) {
                        new Swiper(swiperContainer, {
                            loop: true,
                            observer: true, 
                            observeParents: true,
                            navigation: { 
                                nextEl: swiperContainer.querySelector('.swiper-button-next'), 
                                prevEl: swiperContainer.querySelector('.swiper-button-prev') 
                            },
                            pagination: { el: '.swiper-pagination', clickable: true },
                        });
                    }
                }, 100); 
            }

            setTimeout(() => { blockUnpinOnClick = false; }, 600);
        } catch (e) {
            console.error('Erro select-marker', e);
        }
    });

    $viewerContainer.style.visibility = 'hidden';
    
    photoSphereViewer.addEventListener('click', (e) => {
        if (blockUnpinOnClick) return;
        // Se clicar fora do marcador, limpa tudo.
        if (!e.data || !e.data.marker) { 
            console.log(`DEBUG: Clique fora do marcador. Tentando limpar tooltips.`); 
            clearAllTooltips(); 
        }
        handleViewerClick(e);
    });

    // Listener Botão Fechar
    window.addEventListener('close-tooltip', () => {
        clearAllTooltips();
    });

    window.addEventListener('navigate-pano', (e) => {
        handleNavigation(e.detail);
    });

    window.togglePolygonDrawingMode = togglePolygonDrawingMode;
    
    await customElements.whenDefined('floor-plan');
    if ($plan) {
        $plan.addEventListener('marker-click', handleMarkerClick);
        $plan.addEventListener('marker-over', handlePlanMarkerOver);
        $plan.addEventListener('marker-out', handlePlanMarkerOut);
    }
    
    injetarSVGPatternsNoDOM();
}

// Torna a função globalmente acessível para ser chamada por eventos de clique de marcador
window.handleNavigation = handleNavigation;

async function handleNavigation(targetPanoId) {
    clearAllTooltips(); // Limpeza vital ao navegar
    const targetPanoramaData = PANORAMAS_DATA_DINAMICO[targetPanoId];
    if (targetPanoramaData) {
        $viewerSection.classList.add('loading');
        try {
            photoSphereViewer.setOption('caption', targetPanoramaData.localName);
            await photoSphereViewer.setPanorama(targetPanoramaData.path, { transition: { duration: 1500, zoom: 0 } });
            photoSphereViewer.zoom(0);

            $welcomeOverlay.classList.add('hidden');
            $viewerContainer.style.visibility = 'visible';
            if (markersPluginInstance) markersPluginInstance.setMarkers(targetPanoramaData.markers || []);
            const targetFloor = FLOORS_DINAMICO.find(f => f.name === targetPanoramaData.floorName);
            const currentFloorIndex = FLOORS_DINAMICO.findIndex(f => f.markers.some(m => m.panoId === $plan.activePanoId));
            const targetFloorIndex = FLOORS_DINAMICO.indexOf(targetFloor);
            if (targetFloor && currentFloorIndex !== -1 && currentFloorIndex !== targetFloorIndex) {
                await loadFloor(targetFloorIndex, true);
            }
            $plan.activePanoId = targetPanoId;
        } catch (loadError) { console.error(`Erro nav:`, loadError); } finally { $viewerSection.classList.remove('loading'); }
    }
}

async function loadFloor(index, fromPanoNavigation = false) {
    clearAllTooltips(); // Limpeza vital ao trocar andar
    if (photoSphereViewer && photoSphereViewer.panel.isVisible(MARKERS_PANEL_ID)) {
        photoSphereViewer.panel.hide(MARKERS_PANEL_ID);
    }
    if (!fromPanoNavigation) {
        $welcomeOverlay.classList.remove('hidden');
        $viewerContainer.style.visibility = 'hidden';
    } else {
        $welcomeOverlay.classList.add('hidden');
        $viewerContainer.style.visibility = 'visible';
    }
    [...$floorList.children].forEach(li => li.classList.remove('active'));
    if (FLOORS_DINAMICO[index]) {
        $floorList.children[index].classList.add('active');
    }
    const floorData = FLOORS_DINAMICO[index];
    if (floorData) {
        const welcomeContent = $welcomeOverlay.querySelector('.welcome-content');
        welcomeContent.innerHTML = `<h2>${floorData.name}</h2><p>${floorData.description || 'Explore os pontos de interesse na planta.'}</p>`;
        if ($planTitle) $planTitle.textContent = floorData.name;
        const mapUrl = await getBestImageFormat(floorData.fileBasePath);
        $plan.setAttribute('map-url', mapUrl);
        $plan.markers = floorData.markers;
        if (!fromPanoNavigation) $plan.activePanoId = null;
    }
}

async function handleMarkerClick(e) {
    clearAllTooltips();
    if (photoSphereViewer && photoSphereViewer.panel.isVisible(MARKERS_PANEL_ID)) {
        photoSphereViewer.panel.hide(MARKERS_PANEL_ID);
    }
    $viewerSection.classList.add('loading');
    const { pano, marker } = e.detail;
    const panoId = pano;
    const panoramaData = PANORAMAS_DATA_DINAMICO[panoId];
    if (window.innerWidth <= 820) {
        setTimeout(() => { $viewerContainer.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
    }
    try {
        if (panoramaData) {
            $plan.activePanoId = panoId;
            photoSphereViewer.setOption('caption', marker.label || panoramaData.localName);
            await photoSphereViewer.setPanorama(panoramaData.path, { transition: { duration: 1500, zoom: 0 } });
            photoSphereViewer.zoom(0);
            $viewerContainer.style.visibility = 'visible';
            $welcomeOverlay.classList.add('hidden');
            if (markersPluginInstance) { markersPluginInstance.setMarkers(panoramaData.markers || []); }
        } else { throw new Error('Panorama não encontrado'); }
    } catch (loadError) { console.error("Erro carregamento:", loadError); $plan.activePanoId = null; $welcomeOverlay.classList.remove('hidden'); $viewerContainer.style.visibility = 'hidden'; } finally { $viewerSection.classList.remove('loading'); }
}

function injetarSVGPatternsNoDOM() {
    const svgDefsContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg' );
    svgDefsContainer.setAttribute('style', 'position: absolute; width: 0; height: 0;');
    svgDefsContainer.innerHTML = `<defs><pattern id="stripes-blue" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="10" stroke="blue" stroke-width="2" stroke-opacity="0.4"/></pattern><pattern id="stripes-green" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="10" stroke="green" stroke-width="2" stroke-opacity="0.4"/></pattern><pattern id="stripes-red" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="10" stroke="red" stroke-width="2" stroke-opacity="0.4"/></pattern><pattern id="stripes-yellow" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="10" stroke="yellow" stroke-width="2" stroke-opacity="0.4"/></pattern></defs>`;
    document.body.appendChild(svgDefsContainer);
}

async function handleViewerClick(event) {
    if (isDrawingPolygon) {
        if (!event.data.rightclick) {
            const { yaw, pitch } = event.data;
            currentPolygonPoints.push({ yaw, pitch });
            console.log(`Ponto: { yaw: ${yaw.toFixed(4)}, pitch: ${pitch.toFixed(4)} }`);
        } else {
            if (currentPolygonPoints.length >= 3) {
                console.log("JSON POLÍGONO:", JSON.stringify(currentPolygonPoints, null, 2));
            }
            togglePolygonDrawingMode();
        }
    }
}

async function handlePlanMarkerOver(e) {
    const { pano, marker } = e.detail;
    if ($plan.activePanoId !== pano) return;
    const panoramaData = PANORAMAS_DATA_DINAMICO[pano];
    if (panoramaData && panoramaData.markers) {
        let targetMarker = panoramaData.markers.find(m => m.listContent && marker.label && m.listContent === marker.label);
        if (targetMarker && targetMarker.id) {
            // Verifica se o marcador já não está fixo ou em hover para evitar flicker
            if (pinnedMarkerId === targetMarker.id || hoveredMarkerId === targetMarker.id) return;

            if (markersPluginInstance) {
                // Abre o tooltip temporariamente, a lógica de fechar será a mesma do leave-marker
                markersPluginInstance.showMarkerTooltip(targetMarker.id);
                currentlyShownTooltipId = targetMarker.id;
            }
        }
    }
}

function handlePlanMarkerOut() {
    if (currentlyShownTooltipId) {
        if (pinnedMarkerId !== currentlyShownTooltipId) {
            if (markersPluginInstance) markersPluginInstance.hideMarkerTooltip(currentlyShownTooltipId);
        }
        currentlyShownTooltipId = null;
    }
}

document.addEventListener('DOMContentLoaded', inicializarAplicacao);