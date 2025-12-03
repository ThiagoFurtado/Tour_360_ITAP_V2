// main.js (VERSÃO FINAL: AUTO-CORREÇÃO SOB DEMANDA)

import { Viewer } from '@photo-sphere-viewer/core';
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';
import { GyroscopePlugin } from '@photo-sphere-viewer/gyroscope-plugin';

let $floorList, $plan, $viewerSection, $viewerContainer, $planTitle, $welcomeOverlay;
let FLOORS_DINAMICO = [];
let PANORAMAS_DATA_DINAMICO = {};
let photoSphereViewer;
let markersPluginInstance;

// === ESTADOS GLOBAIS ===
let pinnedMarkerId = null;       
let hoveredMarkerId = null;      
let blockUnpinOnClick = false;   
let currentlyShownTooltipId = null; 
let lastEnterTime = 0; 
const FLICKER_TOLERANCE_MS = 300; 

// === ARMAZENAMENTO GLOBAL DE SWIPERS ===
window.SWIPERS = {};

const MARKERS_PANEL_ID = 'markers-list-panel';
const MARKERS_LIST_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="currentColor" d="M37.5 90S9.9 51.9 9.9 36.6 22.2 9 37.5 9s27.6 12.4 27.6 27.6S37.5 90 37.5 90zm0-66.3c-6.1 0-11 4.9-11 11s4.9 11 11 11 11-4.9 11-11-4.9-11-11-11zM86.7 55H70c-1.8 0-3.3-1.5-3.3-3.3s1.5-3.3 3.3-3.3h16.7c1.8 0 3.3 1.5 3.3 3.3S88.5 55 86.7 55zm0-25h-15a3.3 3.3 0 0 1-3.3-3.3c0-1.8 1.5-3.3 3.3-3.3h15c1.8 0 3.3 1.5 3.3 3.3 0 1.8-1.5 3.3-3.3 3.3zM56.5 73h30c1.8 0 3.3 1.5 3.3 3.3 0 1.8-1.5 3.3-3.3 3.3h-30a3.3 3.3 0 0 1-3.3-3.3 3.2 3.2 0 0 1 3.3-3.3z"></path></svg>`;

const POLYGON_STYLES = {
    'restrita': { fill: 'rgba(255, 0, 0, 0.3 )', stroke: 'red', 'stroke-width': '3px', 'stroke-dasharray': '8 4' },
    'segura': { fill: 'rgba(0, 255, 0, 0.3)', stroke: 'green', 'stroke-width': '2px' },
    'default': { fill: 'rgba(100, 100, 100, 0.3)', stroke: '#666', 'stroke-width': '2px' },
};

// === FUNÇÃO GLOBAL DE CLIQUE (AGORA COM AUTO-INICIALIZAÇÃO) ===
window.manualSwiperClick = function(event, markerId, direction) {
    if(event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
    }
    
    console.log(`🔥 CLIQUE DETECTADO: ${direction} em ${markerId}`);
    
    // 1. Tenta recuperar instância existente
    let swiperInstance = window.SWIPERS[markerId];

    // 2. Se não existir (o bug que estamos enfrentando), inicializa AGORA
    if (!swiperInstance) {
        console.warn(`⚠️ Instância não encontrada. Tentando inicialização "Just-in-Time" para ${markerId}...`);
        
        const container = document.getElementById(`swiper-${markerId}`);
        if (container) {
            try {
                swiperInstance = new Swiper(container, {
                    loop: true,
                    nested: true,
                    observer: true, 
                    observeParents: true,
                    simulateTouch: false,
                    preventClicks: false,
                    preventClicksPropagation: false,
                    navigation: false, 
                    pagination: { el: container.querySelector('.swiper-pagination'), clickable: true },
                });
                
                // Salva para o próximo clique ser rápido
                window.SWIPERS[markerId] = swiperInstance;
                console.log("✅ Inicialização de emergência bem sucedida!");
                
                // Configura bloqueio de propagação para futuros scrolls
                ['touchstart','touchmove','wheel','mousewheel'].forEach(evt => { 
                    container.addEventListener(evt, e => e.stopPropagation(), { passive: true }); 
                });
            } catch (err) {
                console.error("❌ Falha crítica ao inicializar Swiper sob demanda:", err);
            }
        } else {
            console.error(`❌ Elemento DOM #swiper-${markerId} não encontrado!`);
        }
    }

    // 3. Executa a ação
    if (swiperInstance) {
        if (direction === 'next') {
            swiperInstance.slideNext();
        } else {
            swiperInstance.slidePrev();
        }
    }
    return false;
};

window.manualCloseTooltip = function(event) {
    if(event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const closeEvent = new CustomEvent('close-tooltip');
    window.dispatchEvent(closeEvent);
};

/* ========================================================================== 
   FUNÇÕES AUXILIARES
   ========================================================================== */

function createCarouselTooltipHTML(markerData) {
    const { id, Titulo, Descricao, Imagem, Pano_Destino_ID } = markerData;
    const isNavigation = Pano_Destino_ID.length > 0;
    
    const mediaString = Imagem ? Imagem.replace(/"/g, '') : '';
    const mediaFiles = mediaString.split(',').map(file => file.trim()).filter(file => file);
    let mediaHTML = '';

    let closeBtn = '';
    if (!isNavigation) {
        closeBtn = `<button class="tooltip-close-btn" style="pointer-events: auto !important; cursor: pointer;" onclick="window.manualCloseTooltip(event)">×</button>`;
    }

    if (mediaFiles.length > 1) {
        const slides = mediaFiles.map(file => {
            const filePath = `images/${file}`;
            const isVideo = file.toLowerCase().endsWith('.mp4') || file.toLowerCase().endsWith('.webm');
            return isVideo 
                ? `<div class="swiper-slide"><video src="${filePath}" controls playsinline onmousedown="event.stopPropagation()"></video></div>` 
                : `<div class="swiper-slide"><img src="${filePath}" alt="${Titulo}" onmousedown="event.stopPropagation()"></div>`;
        }).join('');
        
        mediaHTML = `
        <div id="swiper-${id}" class="swiper-container">
            <div class="swiper-wrapper">${slides}</div>
            <div class="swiper-pagination"></div>
            
            <div class="swiper-button-prev" 
                 style="pointer-events: auto !important; cursor: pointer; z-index: 9999;"
                 onclick="window.manualSwiperClick(event, '${id}', 'prev')">
            </div>
            
            <div class="swiper-button-next" 
                 style="pointer-events: auto !important; cursor: pointer; z-index: 9999;"
                 onclick="window.manualSwiperClick(event, '${id}', 'next')">
            </div>
        </div>`;
    } else if (mediaFiles.length === 1) {
        const file = mediaFiles[0];
        const filePath = `images/${file}`;
        const isVideo = file.toLowerCase().endsWith('.mp4') || file.toLowerCase().endsWith('.webm');
        const singleMediaContent = isVideo 
            ? `<video src="${filePath}" controls playsinline onmousedown="event.stopPropagation()"></video>` 
            : `<img src="${filePath}" alt="${Titulo}" onmousedown="event.stopPropagation()">`;
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
            
            const poligonoJsonPath = indices.poligono_json > -1 ? (valores[indices.poligono_json] || '') : ''; 
            const tipoPoligonoCss = indices.Tipo_Poligono_CSS > -1 ? (valores[indices.Tipo_Poligono_CSS] || '') : ''; 
            const isNavigationMarker = markerDataFromCSV.Pano_Destino_ID.length > 0; 
            
            let tooltipConfig = {
                content: isNavigationMarker 
                         ? `<div class="tooltip-nav-simple">${markerDataFromCSV.Titulo}</div>` 
                         : createCarouselTooltipHTML(markerDataFromCSV),
                className: isNavigationMarker ? 'psv-tooltip-nav' : 'psv-tooltip-fixed-center',
                position: 'top center',
                trigger: 'custom' 
            };
            
            let markerConfig = {
                id: currentMarkerId,
                tooltip: tooltipConfig,
                listContent: markerDataFromCSV.Titulo, 
                data: { 
                    titleForList: markerDataFromCSV.Titulo, 
                    panoDestinoId: markerDataFromCSV.Pano_Destino_ID, 
                    isNavigation: isNavigationMarker
                }
            };

            if (poligonoJsonPath) {
                try {
                    const poligonoData = await fetch(`markers/${poligonoJsonPath}`).then(res => res.json());
                    if (Array.isArray(poligonoData)) {
                        markerConfig.polygon = poligonoData; markerConfig.svgStyle = POLYGON_STYLES[tipoPoligonoCss] || POLYGON_STYLES['default']; markerConfig.className = `${markerConfig.className || ''} ${tipoPoligonoCss || 'default'}`.trim();
                    } else if (!isNaN(markerDataFromCSV.Pitch)) { Object.assign(markerConfig, getPointMarkerConfig(currentMarkerId, isNavigationMarker, markerDataFromCSV)); }
                } catch (e) { if (!isNaN(markerDataFromCSV.Pitch)) { Object.assign(markerConfig, getPointMarkerConfig(currentMarkerId, isNavigationMarker, markerDataFromCSV)); } }
            } else {
                if (!isNaN(markerDataFromCSV.Pitch)) { Object.assign(markerConfig, getPointMarkerConfig(currentMarkerId, isNavigationMarker, markerDataFromCSV)); } else { continue; }
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
        html: `<div data-marker-id="${id}" class="psv-marker-target" style="width:100%;height:100%;color:${color};cursor:pointer;">${svgIcon}</div>`,
        size: { width: 25, height: 25 },
    };
}

async function carregarDadosDoCSV(caminhoDoArquivoCSV) {
    try {
        const resposta = await fetch(caminhoDoArquivoCSV);
        if (!resposta.ok) throw new Error(`Erro CSV principal`);
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
                PANORAMAS_DATA_DINAMICO[idUnico] = { path: `panos/${imagem360}`, markers: markersInfoCSV ? await carregarMarkers360DoCSV(markersInfoCSV, idUnico) : [], floorName: pavimento, localName: valores[indices.Local] };
                floorsMap.get(pavimento).markers.push({ x: parseInt(valores[indices.X]), y: parseInt(valores[indices.Y]), panoId: idUnico, radius: 15, color: '#006837', label: valores[indices.Local] });
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

function clearAllTooltips() {
    if (!markersPluginInstance) { pinnedMarkerId = null; hoveredMarkerId = null; return; }
    if (pinnedMarkerId) { markersPluginInstance.hideMarkerTooltip(pinnedMarkerId); markersPluginInstance.updateMarker({ id: pinnedMarkerId, tooltip: { persistent: false } }); }
    if (hoveredMarkerId && hoveredMarkerId !== pinnedMarkerId) { markersPluginInstance.hideMarkerTooltip(hoveredMarkerId); }
    pinnedMarkerId = null; hoveredMarkerId = null; currentlyShownTooltipId = null;
}

async function inicializarAplicacao() {
    console.log("Aplicação inicializada."); 

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
        <ul><li><strong>Escolha um pavimento</strong> na lista acima.</li><li><strong>Clique sobre os marcadores verdes</strong> na planta.</li></ul>`;

    FLOORS_DINAMICO = await carregarDadosDoCSV('dados/marcadores.csv');
    if (FLOORS_DINAMICO.length === 0) { if ($viewerContainer) $viewerContainer.innerHTML = '<div style="text-align: center; color: #ff0000; padding: 20px;">Erro ao carregar dados.</div>'; return; }

    if ($floorList) {
        $floorList.innerHTML = '';
        FLOORS_DINAMICO.forEach((f, idx) => {
            const li = document.createElement('li'); li.textContent = f.name; li.addEventListener('click', () => loadFloor(idx)); $floorList.append(li);
        });
    }

    photoSphereViewer = new Viewer({
        container: $viewerContainer, panorama: null, caption: '', loadingImg: null,
        navbar: [ 'zoom', 'move', 'gyroscope', 'markers', { id: 'markers-list-button', content: MARKERS_LIST_ICON, title: 'Lista de Marcadores', className: 'custom-markers-list-button', onClick: (viewer) => { if (!markersPluginInstance) return; viewer.panel.isVisible(MARKERS_PANEL_ID) ? viewer.panel.hide(MARKERS_PANEL_ID) : viewer.panel.show({ id: MARKERS_PANEL_ID, content: 'Lista', noMargin: true }); } }, 'caption', 'fullscreen' ],
        plugins: [ [MarkersPlugin], [GyroscopePlugin] ],
    });

    markersPluginInstance = photoSphereViewer.getPlugin(MarkersPlugin);
    const isMobileView = () => (window.innerWidth <= 820) || ('ontouchstart' in window && navigator.maxTouchPoints > 0);

    // --- EVENTO CRÍTICO: CONFIGURAÇÃO DO TOOLTIP ---
    // Mesmo com a inicialização sob demanda no clique, mantemos este listener
    // para tentar inicializar o mais cedo possível (pré-carregamento)
    markersPluginInstance.addEventListener('open-tooltip', ({ marker }) => {
        try {
            if (marker && marker.tooltip && marker.tooltip.tooltipEl) {
                const tooltipEl = marker.tooltip.tooltipEl;
                
                tooltipEl.addEventListener('mouseleave', () => {
                    if (pinnedMarkerId !== marker.id) {
                        markersPluginInstance.hideMarkerTooltip(marker.id);
                        hoveredMarkerId = null;
                    }
                });

                if (!tooltipEl._initialized) {
                    tooltipEl._initialized = true;
                    
                    // Bloqueio Passivo para scroll
                    ['touchstart','touchmove','wheel','mousewheel','DOMMouseScroll'].forEach(evt => { 
                        tooltipEl.addEventListener(evt, e => e.stopPropagation(), { passive: true }); 
                    });
                    
                    // Bloqueio Ativo para clique
                    ['mousedown','click','pointerdown','pointerup'].forEach(evt => { 
                        tooltipEl.addEventListener(evt, e => e.stopPropagation()); 
                    });
                    
                    // Tentativa de inicialização padrão (caso funcione)
                    setTimeout(() => {
                        const swiperContainer = document.getElementById(`swiper-${marker.id}`);
                        if (swiperContainer && !window.SWIPERS[marker.id]) {
                            const swiperInstance = new Swiper(swiperContainer, {
                                loop: true,
                                nested: true,
                                observer: true, 
                                observeParents: true,
                                simulateTouch: false,
                                preventClicks: false,
                                preventClicksPropagation: false,
                                navigation: false, 
                                pagination: { el: swiperContainer.querySelector('.swiper-pagination'), clickable: true },
                            });
                            window.SWIPERS[marker.id] = swiperInstance;
                        }
                    }, 50);
                }
            }
        } catch (e) { console.error('Erro em open-tooltip listener', e); }
    });

    // --- HOVER (PC) ---
    markersPluginInstance.addEventListener('enter-marker', ({ marker }) => {
        if (pinnedMarkerId && pinnedMarkerId !== marker.id) return;
        if (isMobileView()) return;
        
        lastEnterTime = Date.now();
        if (hoveredMarkerId && hoveredMarkerId !== marker.id) {
            markersPluginInstance.hideMarkerTooltip(hoveredMarkerId);
        }
        hoveredMarkerId = marker.id;
        markersPluginInstance.showMarkerTooltip(marker.id);
    });

    // --- LEAVE (PC) ---
    markersPluginInstance.addEventListener('leave-marker', ({ marker }) => {
        if (pinnedMarkerId === marker.id) return;

        const timeDiff = Date.now() - lastEnterTime;
        const isInfoMarker = !marker.data.isNavigation;
        
        if (isInfoMarker && timeDiff < FLICKER_TOLERANCE_MS) return;

        if (hoveredMarkerId === marker.id) {
            markersPluginInstance.hideMarkerTooltip(marker.id);
            hoveredMarkerId = null; 
        }
    });

    // --- CLIQUE (PC/MOBILE) ---
    markersPluginInstance.addEventListener('select-marker', async ({ marker }) => {
        if (marker.data && marker.data.isNavigation && marker.data.panoDestinoId) { clearAllTooltips(); await handleNavigation(marker.data.panoDestinoId); return; }
        if (pinnedMarkerId === marker.id) { clearAllTooltips(); return; }

        clearAllTooltips();
        blockUnpinOnClick = true;
        try { if (marker.position) { photoSphereViewer.animate({ yaw: marker.position.yaw, pitch: marker.position.pitch, speed: 1000 }); } else { markersPluginInstance.gotoMarker(marker.id, 1000); } } catch (e) {}

        pinnedMarkerId = marker.id;
        markersPluginInstance.updateMarker({ id: marker.id, tooltip: { persistent: true } });
        markersPluginInstance.showMarkerTooltip(marker.id);
        setTimeout(() => { blockUnpinOnClick = false; }, 600);
    });

    $viewerContainer.style.visibility = 'hidden';
    photoSphereViewer.addEventListener('click', (e) => { if (blockUnpinOnClick) return; if (!(e.data && e.data.marker)) { clearAllTooltips(); } });
    window.addEventListener('close-tooltip', () => { clearAllTooltips(); });
    window.addEventListener('navigate-pano', (e) => { handleNavigation(e.detail); });
    await customElements.whenDefined('floor-plan');
    if ($plan) { $plan.addEventListener('marker-click', handleMarkerClick); $plan.addEventListener('marker-over', handlePlanMarkerOver); $plan.addEventListener('marker-out', handlePlanMarkerOut); }
    // Injeca CSS/SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.style='position:absolute;width:0;height:0;'; svg.innerHTML=`<defs>...</defs>`;
    document.body.appendChild(svg);
}

window.handleNavigation = handleNavigation;
async function handleNavigation(targetPanoId) { /* ... Lógica mantida ... */ clearAllTooltips(); const targetPanoramaData = PANORAMAS_DATA_DINAMICO[targetPanoId]; if (targetPanoramaData) { $viewerSection.classList.add('loading'); try { photoSphereViewer.setOption('caption', targetPanoramaData.localName); await photoSphereViewer.setPanorama(targetPanoramaData.path, { transition: { duration: 1500, zoom: 0 } }); photoSphereViewer.zoom(0); $welcomeOverlay.classList.add('hidden'); $viewerContainer.style.visibility = 'visible'; if (markersPluginInstance) markersPluginInstance.setMarkers(targetPanoramaData.markers || []); const targetFloor = FLOORS_DINAMICO.find(f => f.name === targetPanoramaData.floorName); const currentFloorIndex = FLOORS_DINAMICO.findIndex(f => f.markers.some(m => m.panoId === $plan.activePanoId)); const targetFloorIndex = FLOORS_DINAMICO.indexOf(targetFloor); if (targetFloor && currentFloorIndex !== -1 && currentFloorIndex !== targetFloorIndex) { await loadFloor(targetFloorIndex, true); } $plan.activePanoId = targetPanoId; } catch (loadError) { console.error(`Erro nav:`, loadError); } finally { $viewerSection.classList.remove('loading'); } } }
async function loadFloor(index, fromPanoNavigation = false) { /* ... Lógica mantida ... */ clearAllTooltips(); if (photoSphereViewer && photoSphereViewer.panel.isVisible(MARKERS_PANEL_ID)) { photoSphereViewer.panel.hide(MARKERS_PANEL_ID); } if (!fromPanoNavigation) { $welcomeOverlay.classList.remove('hidden'); $viewerContainer.style.visibility = 'hidden'; } else { $welcomeOverlay.classList.add('hidden'); $viewerContainer.style.visibility = 'visible'; } [...$floorList.children].forEach(li => li.classList.remove('active')); if (FLOORS_DINAMICO[index]) { $floorList.children[index].classList.add('active'); } const floorData = FLOORS_DINAMICO[index]; if (floorData) { const welcomeContent = $welcomeOverlay.querySelector('.welcome-content'); welcomeContent.innerHTML = `<h2>${floorData.name}</h2><p>${floorData.description || 'Explore.'}</p>`; if ($planTitle) $planTitle.textContent = floorData.name; const mapUrl = await getBestImageFormat(floorData.fileBasePath); $plan.setAttribute('map-url', mapUrl); $plan.markers = floorData.markers; if (!fromPanoNavigation) $plan.activePanoId = null; } }
async function handleMarkerClick(e) { /* ... Lógica mantida ... */ clearAllTooltips(); if (photoSphereViewer && photoSphereViewer.panel.isVisible(MARKERS_PANEL_ID)) { photoSphereViewer.panel.hide(MARKERS_PANEL_ID); } $viewerSection.classList.add('loading'); const { pano, marker } = e.detail; const panoId = pano; const panoramaData = PANORAMAS_DATA_DINAMICO[panoId]; if (window.innerWidth <= 820) { setTimeout(() => { $viewerContainer.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100); } try { if (panoramaData) { $plan.activePanoId = panoId; photoSphereViewer.setOption('caption', marker.label || panoramaData.localName); await photoSphereViewer.setPanorama(panoramaData.path, { transition: { duration: 1500, zoom: 0 } }); photoSphereViewer.zoom(0); $viewerContainer.style.visibility = 'visible'; $welcomeOverlay.classList.add('hidden'); if (markersPluginInstance) { markersPluginInstance.setMarkers(panoramaData.markers || []); } } else { throw new Error('Panorama não encontrado'); } } catch (loadError) { console.error("Erro carregamento:", loadError); $plan.activePanoId = null; $welcomeOverlay.classList.remove('hidden'); $viewerContainer.style.visibility = 'hidden'; } finally { $viewerSection.classList.remove('loading'); } }
async function handlePlanMarkerOver(e) { /* ... Lógica mantida ... */ const { pano, marker } = e.detail; if ($plan.activePanoId !== pano) return; const panoramaData = PANORAMAS_DATA_DINAMICO[pano]; if (panoramaData && panoramaData.markers) { let targetMarker = panoramaData.markers.find(m => m.listContent && marker.label && m.listContent === marker.label); if (targetMarker && targetMarker.id) { if (pinnedMarkerId === targetMarker.id || hoveredMarkerId === targetMarker.id) return; if (markersPluginInstance) { markersPluginInstance.showMarkerTooltip(targetMarker.id); currentlyShownTooltipId = targetMarker.id; } } } }
function handlePlanMarkerOut() { /* ... Lógica mantida ... */ if (currentlyShownTooltipId) { if (pinnedMarkerId !== currentlyShownTooltipId) { if (markersPluginInstance) markersPluginInstance.hideMarkerTooltip(currentlyShownTooltipId); } currentlyShownTooltipId = null; } }

document.addEventListener('DOMContentLoaded', inicializarAplicacao);