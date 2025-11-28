// main.js (Versão Final Consolidada)

// Importações (Certifique-se que o importmap no index.html está correto)
import { Viewer } from '@photo-sphere-viewer/core';
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';
import { GyroscopePlugin } from '@photo-sphere-viewer/gyroscope-plugin';

// Referências do DOM e Variáveis Globais
let $floorList, $plan, $viewerSection, $viewerContainer, $planTitle, $welcomeOverlay;

let FLOORS_DINAMICO = [];
let PANORAMAS_DATA_DINAMICO = {};
let photoSphereViewer;
let markersPluginInstance;
let pinnedMarkerId = null;
let currentlyShownTooltipId = null;

let blockUnpinOnClick = false;

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

    // Lógica de Mídia
    if (mediaFiles.length > 1) {
        const slides = mediaFiles.map(file => {
            const filePath = `images/${file}`;
            const isVideo = file.toLowerCase().endsWith('.mp4') || file.toLowerCase().endsWith('.webm');
            // 'ontouchstart' stopPropagation permite clicar no vídeo sem mover o 360
            return isVideo ? `<div class="swiper-slide"><video src="${filePath}" controls playsinline ontouchstart="event.stopPropagation()"></video></div>` : `<div class="swiper-slide"><img src="${filePath}" alt="${Titulo}"></div>`;
        }).join('');
        mediaHTML = `<div id="swiper-${id}" class="swiper-container"><div class="swiper-wrapper">${slides}</div><div class="swiper-pagination"></div><div class="swiper-button-prev"></div><div class="swiper-button-next"></div></div>`;
    } else if (mediaFiles.length === 1) {
        const file = mediaFiles[0];
        const filePath = `images/${file}`;
        const isVideo = file.toLowerCase().endsWith('.mp4') || file.toLowerCase().endsWith('.webm');
        const singleMediaContent = isVideo ? `<video src="${filePath}" controls playsinline ontouchstart="event.stopPropagation()"></video>` : `<img src="${filePath}" alt="${Titulo}">`;
        mediaHTML = `<div class="tooltip-media-single">${singleMediaContent}</div>`;
    }

    // Lógica de Texto (Envolto em DIV para scroll independente)
    let textHTML = '<div class="tooltip-text-content">';
    if (Titulo) textHTML += `<h2>${Titulo}</h2>`;
    if (Descricao) textHTML += `<p>${Descricao}</p>`;
    
    // Navegação
    if (Pano_Destino_ID && Pano_Destino_ID.length > 0) {
        textHTML += `<p class="nav-link" onclick="window.dispatchEvent(new CustomEvent('navigate-pano', {detail: '${Pano_Destino_ID}'}))">Clique para navegar</p>`;
    }
    textHTML += '</div>';

    return mediaHTML + textHTML;
}

function togglePolygonDrawingMode() {
    isDrawingPolygon = !isDrawingPolygon; currentPolygonPoints = [];
    if (isDrawingPolygon) {
        console.log("--- MODO DE DESENHO DE POLÍGONO ATIVADO ---");
        photoSphereViewer.setOption('mousewheel', false); photoSphereViewer.setCursor('crosshair');
    } else {
        console.log("--- MODO DE DESENHO DE POLÍGONO DESATIVADO ---");
        photoSphereViewer.setOption('mousewheel', true); photoSphereViewer.setCursor(null);
    }
}

async function carregarMarkers360DoCSV(caminhoDoArquivoCSV, panoIdOrigem) {
    try {
        const resposta = await fetch(caminhoDoArquivoCSV);
        if (!resposta.ok) { console.warn(`Aviso: CSV de marcadores não encontrado para ${panoIdOrigem}`); return []; }
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
                // O HTML customizado (media + text) é inserido aqui
                tooltip: { content: tooltipContent, persistent: false }, 
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
    } catch (error) { console.error(`Erro ao processar marcadores 360:`, error); return []; }
}

function getPointMarkerConfig(id, isNavigation, data) {
    const color = isNavigation ? '#FFD700' : 'white';
    const svgIcon = isNavigation ? `<svg viewBox="0 0 100 100" width="100%" height="100%"><path fill="currentColor" d="M50 0C27.9 0 10 17.9 10 40c0 22.1 40 60 40 60s40-37.9 40-60C90 17.9 72.1 0 50 0zm0 55c-8.3 0-15-6.7-15-15s6.7-15 15-15 15 6.7 15 15-6.7 15-15 15z"/></svg>` : `<svg viewBox="0 0 100 100" width="100%" height="100%"><circle cx=50 cy=50 r=25 fill="currentColor"/><circle cx=50 cy=50 r=40 stroke-width=10 fill="none" stroke="currentColor"/></svg>`;
    return {
        position: { yaw: data.Yaw, pitch: data.Pitch },
        html: `<button data-marker-id="${id}" style="width:100%;height:100%;padding:0;border:none;background:none;color:${color};border-radius:50%;filter:drop-shadow(0 10px 5px rgba(0,0,0,0.2));cursor:pointer;">${svgIcon}</button>`,
        size: { width: 25, height: 25 },
    };
}

async function carregarDadosDoCSV(caminhoDoArquivoCSV) {
    try {
        const resposta = await fetch(caminhoDoArquivoCSV);
        if (!resposta.ok) throw new Error(`Erro ao carregar o CSV principal: ${resposta.statusText}`);
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
    } catch (error) { console.error("Erro fatal ao carregar dados do CSV principal:", error); return []; }
}

async function getBestImageFormat(basePath) {
    const webpUrl = `${basePath}.webp`;
    try { const response = await fetch(webpUrl, { method: 'HEAD' }); if (response.ok) return webpUrl; } catch (error) {}
    return `${basePath}.png`;
}

function unpinCurrentMarker() {
    if (pinnedMarkerId) {
        if (markersPluginInstance) {
            try {
                markersPluginInstance.updateMarker({ id: pinnedMarkerId, tooltip: { persistent: false } });
                markersPluginInstance.hideMarkerTooltip(pinnedMarkerId);
            } catch (e) { }
        }
        pinnedMarkerId = null;
    }
}

/* ==========================================================================
   INICIALIZAÇÃO DA APLICAÇÃO
   ========================================================================== */

async function inicializarAplicacao() {
    console.log("Aplicação inicializada.");

    $floorList = document.getElementById('floor-list');
    $plan = document.getElementById('plan');
    $viewerSection = document.querySelector('.viewer');
    $viewerContainer = document.getElementById('viewer');
    $planTitle = document.querySelector('.plan h2');
    $welcomeOverlay = document.getElementById('welcome-overlay');

    // Estado Inicial
    if ($planTitle) $planTitle.textContent = 'Planta Baixa';
    $plan.setAttribute('map-url', 'panos/placeholder.png');
    $plan.markers = [];
    
    // Texto de boas-vindas
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
        $viewerContainer.innerHTML = '<div style="text-align: center; color: #ff0000; padding: 20px;">Erro ao carregar dados.</div>';
        return;
    }

    $floorList.innerHTML = '';
    FLOORS_DINAMICO.forEach((f, idx) => {
        const li = document.createElement('li'); li.textContent = f.name; li.addEventListener('click', () => loadFloor(idx)); $floorList.append(li);
    });

    // Configuração do Viewer com Gyroscope
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
                    if (viewer.panel.isVisible(MARKERS_PANEL_ID)) { 
                        viewer.panel.hide(MARKERS_PANEL_ID); 
                    } else { 
                        const currentMarkers = markersPluginInstance.getMarkers(); 
                        let panelContent = ''; 
                        if (currentMarkers.length > 0) { 
                            panelContent = '<div class="psv-panel-menu psv-panel-menu--stripped"><h1 class="psv-panel-menu-title">Marcadores</h1><ul class="psv-panel-menu-list">'; 
                            currentMarkers.forEach(marker => { 
                                const markerTitle = marker.data && marker.data.titleForList ? marker.data.titleForList : marker.id; 
                                panelContent += `<li class="psv-panel-menu-item" data-marker-id="${marker.id}" tabindex="0"><span class="psv-panel-menu-item-label">${markerTitle}</span></li>`; 
                            }); 
                            panelContent += '</ul></div>'; 
                        } else { 
                            panelContent = '<p style="padding: 1em; text-align: center;">Nenhum marcador disponível.</p>'; 
                        } 
                        viewer.panel.show({ 
                            id: MARKERS_PANEL_ID, content: panelContent, noMargin: true, 
                            clickHandler: (target) => { 
                                const listItem = target.closest('.psv-panel-menu-item'); 
                                if (listItem) { const markerId = listItem.dataset.markerId; if (markerId) { markersPluginInstance.gotoMarker(markerId, 1500); viewer.panel.hide(MARKERS_PANEL_ID); } } 
                            } 
                        }); 
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

    // CRUCIAL: Impede que scroll e toques no tooltip movam o 360
    markersPluginInstance.addEventListener('open-tooltip', ({ marker }) => {
        if (marker.tooltip.tooltipEl) {
            const eventsToStop = [
                'mousedown', 'click', 'pointerdown', 
                'touchstart', 'touchmove', 'touchend', 
                'wheel', 'mousewheel', 'DOMMouseScroll' // Adicionado scroll
            ];
            
            eventsToStop.forEach(eventName => {
                marker.tooltip.tooltipEl.addEventListener(eventName, (event) => {
                    event.stopPropagation();
                }, { capture: true });
            });
        }
    });

    markersPluginInstance.addEventListener('select-marker', async ({ marker }) => {
        if (marker.data && marker.data.isNavigation && marker.data.panoDestinoId) {
            await handleNavigation(marker.data.panoDestinoId);
            return;
        }
        const isAlreadyPinned = (pinnedMarkerId === marker.id);
        unpinCurrentMarker();
        if (!isAlreadyPinned) {
            blockUnpinOnClick = true;
            markersPluginInstance.updateMarker({ id: marker.id, tooltip: { persistent: true } });
            markersPluginInstance.showMarkerTooltip(marker.id);
            pinnedMarkerId = marker.id;
        }
        const swiperContainer = document.querySelector(`#swiper-${marker.id}`);
        if (swiperContainer && !swiperContainer.classList.contains('swiper-initialized')) {
            new Swiper(swiperContainer, {
                loop: true,
                navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
                pagination: { el: '.swiper-pagination', clickable: true },
            });
        }
    });

    markersPluginInstance.addEventListener('enter-marker', ({ marker }) => {
        if (pinnedMarkerId && pinnedMarkerId !== marker.id) { unpinCurrentMarker(); }
    });

    $viewerContainer.style.visibility = 'hidden';
    
    photoSphereViewer.addEventListener('click', (e) => {
        if (blockUnpinOnClick) { blockUnpinOnClick = false; return; }
        if (!e.data.marker) { unpinCurrentMarker(); }
        handleViewerClick(e);
    });

    window.addEventListener('navigate-pano', (e) => {
        handleNavigation(e.detail);
    });

    window.togglePolygonDrawingMode = togglePolygonDrawingMode;
    
    await customElements.whenDefined('floor-plan');
    $plan.addEventListener('marker-click', handleMarkerClick);
    $plan.addEventListener('marker-over', handlePlanMarkerOver);
    $plan.addEventListener('marker-out', handlePlanMarkerOut);
    
    injetarSVGPatternsNoDOM();
}

/* ==========================================================================
   NAVEGAÇÃO E EVENTOS
   ========================================================================== */

async function handleNavigation(targetPanoId) {
    unpinCurrentMarker();
    const targetPanoramaData = PANORAMAS_DATA_DINAMICO[targetPanoId];
    if (targetPanoramaData) {
        $viewerSection.classList.add('loading');
        try {
            photoSphereViewer.setOption('caption', targetPanoramaData.localName);
            await photoSphereViewer.setPanorama(targetPanoramaData.path, { transition: { duration: 1500, zoom: 0 } });
            photoSphereViewer.zoom(0);

            $welcomeOverlay.classList.add('hidden');
            $viewerContainer.style.visibility = 'visible';
            markersPluginInstance.setMarkers(targetPanoramaData.markers || []);
            const targetFloor = FLOORS_DINAMICO.find(f => f.name === targetPanoramaData.floorName);
            const currentFloorIndex = FLOORS_DINAMICO.findIndex(f => f.markers.some(m => m.panoId === $plan.activePanoId));
            const targetFloorIndex = FLOORS_DINAMICO.indexOf(targetFloor);
            if (targetFloor && currentFloorIndex !== -1 && currentFloorIndex !== targetFloorIndex) {
                await loadFloor(targetFloorIndex, true);
            }
            $plan.activePanoId = targetPanoId;
        } catch (loadError) {
            console.error(`Erro ao carregar panorama de destino (${targetPanoId}):`, loadError);
        } finally {
            $viewerSection.classList.remove('loading');
        }
    }
}

async function loadFloor(index, fromPanoNavigation = false) {
    unpinCurrentMarker();
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
    unpinCurrentMarker();
    if (photoSphereViewer && photoSphereViewer.panel.isVisible(MARKERS_PANEL_ID)) {
        photoSphereViewer.panel.hide(MARKERS_PANEL_ID);
    }
    
    $viewerSection.classList.add('loading');
    const { pano, marker } = e.detail;
    const panoId = pano;
    const panoramaData = PANORAMAS_DATA_DINAMICO[panoId];

    // UX Mobile: Rola até o viewer
    if (window.innerWidth <= 820) {
        setTimeout(() => {
            $viewerContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }

    try {
        if (panoramaData) {
            $plan.activePanoId = panoId;
            photoSphereViewer.setOption('caption', marker.label || panoramaData.localName);
            await photoSphereViewer.setPanorama(panoramaData.path, { transition: { duration: 1500, zoom: 0 } });
            photoSphereViewer.zoom(0);

            $viewerContainer.style.visibility = 'visible';
            $welcomeOverlay.classList.add('hidden');
            if (markersPluginInstance) {
                markersPluginInstance.setMarkers(panoramaData.markers || []);
            }
        } else { throw new Error('Dados do panorama não encontrados'); }
    } catch (loadError) {
        console.error("Erro no carregamento:", loadError);
        $plan.activePanoId = null;
        $welcomeOverlay.classList.remove('hidden');
        $viewerContainer.style.visibility = 'hidden';
    } finally {
        $viewerSection.classList.remove('loading');
    }
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
            console.log(`Ponto adicionado: { yaw: ${yaw.toFixed(4)}, pitch: ${pitch.toFixed(4)} }`);
        } else {
            if (currentPolygonPoints.length >= 3) {
                console.log("\\n--- JSON DO POLÍGONO FINALIZADO ---");
                console.log(JSON.stringify(currentPolygonPoints, null, 2));
            }
            togglePolygonDrawingMode();
        }
        return;
    }
}

async function handlePlanMarkerOver(e) {
    const { pano, marker } = e.detail;
    if ($plan.activePanoId !== pano) return;

    const panoramaData = PANORAMAS_DATA_DINAMICO[pano];
    if (panoramaData && panoramaData.markers && panoramaData.markers.length > 0) {
        let targetMarker = panoramaData.markers.find(m => m.listContent && marker.label && m.listContent === marker.label);
        if (targetMarker && targetMarker.id) {
            markersPluginInstance.showMarkerTooltip(targetMarker.id);
            currentlyShownTooltipId = targetMarker.id;
        }
    }
}

function handlePlanMarkerOut() {
    if (currentlyShownTooltipId) {
        if (pinnedMarkerId !== currentlyShownTooltipId) {
            markersPluginInstance.hideMarkerTooltip(currentlyShownTooltipId);
        }
        currentlyShownTooltipId = null;
    }
}

document.addEventListener('DOMContentLoaded', inicializarAplicacao);