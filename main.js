// main.js - VERSÃO COM LOGS DE DIAGNÓSTICO

// Importações
import { Viewer } from '@photo-sphere-viewer/core';
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';

// Referências do DOM e Variáveis Globais
let $floorList, $plan, $viewerSection, $viewerContainer, $planTitle, $welcomeOverlay;

let FLOORS_DINAMICO = [];
let PANORAMAS_DATA_DINAMICO = {};
export const isMobile = /Mobi|Android/i.test(navigator.userAgent);
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
    'restrita': { fill: 'rgba(255, 0, 0, 0.3 )', stroke: 'red', 'stroke-width': '3px', 'stroke-dasharray': '8 4' }, 'segura': { fill: 'rgba(0, 255, 0, 0.3)', stroke: 'green', 'stroke-width': '2px' }, 'default': { fill: 'rgba(100, 100, 100, 0.3)', stroke: '#666', 'stroke-width': '2px' }, 'contorno-azul': { fill: 'none', stroke: 'blue', 'stroke-width': '3px' }, 'azul': { fill: 'rgba(0, 255, 255, 0.3)', stroke: 'blue', 'stroke-width': '3px' }, 'contorno-verde': { fill: 'none', stroke: 'green', 'stroke-width': '3px' }, 'contorno-vermelho': { fill: 'none', stroke: 'red', 'stroke-width': '3px' }, 'contorno-amarelo': { fill: 'none', stroke: 'yellow', 'stroke-width': '3px' }, 'listrado-azul': { fill: 'url(#stripes-blue)', stroke: 'blue', 'stroke-width': '3px' }, 'listrado-verde': { fill: 'url(#stripes-green)', stroke: 'green', 'stroke-width': '3px' }, 'listrado-vermelho': { fill: 'url(#stripes-red)', stroke: 'red', 'stroke-width': '3px' }, 'listrado-amarelo': { fill: 'url(#stripes-yellow)', stroke: 'yellow', 'stroke-width': '3px' }, 'tracejado-azul': { fill: 'none', stroke: 'blue', 'stroke-width': '3px', 'stroke-dasharray': '5 5' }, 'tracejado-verde': { fill: 'none', stroke: 'green', 'stroke-width': '3px', 'stroke-dasharray': '5 5' }, 'tracejado-vermelho': { fill: 'none', stroke: 'red', 'stroke-width': '3px', 'stroke-dasharray': '5 5' }, 'tracejado-amarelo': { fill: 'none', stroke: 'yellow', 'stroke-width': '3px', 'stroke-dasharray': '5 5' }, 'listrado-tracejado-azul': { fill: 'url(#stripes-blue)', stroke: 'blue', 'stroke-width': '3px', 'stroke-dasharray': '5 5' }, 'listrado-tracejado-verde': { fill: 'url(#stripes-green)', stroke: 'green', 'stroke-width': '3px', 'stroke-dasharray': '5 5' }, 'listrado-tracejado-vermelho': { fill: 'url(#stripes-red)', stroke: 'red', 'stroke-width': '3px', 'stroke-dasharray': '5 5' }, 'listrado-tracejado-amarelo': { fill: 'url(#stripes-yellow)', stroke: 'yellow', 'stroke-width': '3px', 'stroke-dasharray': '5 5' }
};

function createCarouselTooltipHTML(markerData) {
    const { id, Titulo, Descricao, Imagem, Pano_Destino_ID } = markerData;
    const mediaString = Imagem ? Imagem.replace(/"/g, '') : '';
    const mediaFiles = mediaString.split(',').map(file => file.trim()).filter(file => file);
    let mediaHTML = '';

    if (mediaFiles.length > 1) {
        const slides = mediaFiles.map(file => {
            const filePath = `images/${file}`;
            const isVideo = file.toLowerCase().endsWith('.mp4') || file.toLowerCase().endsWith('.webm');
            return isVideo
                ? `<div class="swiper-slide"><video src="${filePath}" controls></video></div>`
                : `<div class="swiper-slide"><img src="${filePath}" alt="${Titulo}"></div>`;
        }).join('');
        mediaHTML = `<div id="swiper-${id}" class="swiper-container"><div class="swiper-wrapper">${slides}</div><div class="swiper-pagination"></div><div class="swiper-button-prev"></div><div class="swiper-button-next"></div></div>`;
    
    } else if (mediaFiles.length === 1) {
        const file = mediaFiles[0];
        const filePath = `images/${file}`;
        const isVideo = file.toLowerCase().endsWith('.mp4') || file.toLowerCase().endsWith('.webm');
        const singleMediaContent = isVideo
            ? `<video src="${filePath}" controls></video>`
            : `<img src="${filePath}" alt="${Titulo}">`;
        mediaHTML = `<div class="tooltip-media-single">${singleMediaContent}</div>`;
    }

    let tooltipContent = mediaHTML;
    if (Titulo) { tooltipContent += `<h2 style="margin:8px 0;text-align:center;font-size:1.2em;color:#fff;">${Titulo}</h2>`; }
    if (Descricao) { tooltipContent += `<p style="margin:0;text-align:justify;font-size:0.9em;color:#eee;">${Descricao}</p>`; }
    if (Pano_Destino_ID && Pano_Destino_ID.length > 0) { tooltipContent += `<p style="margin-top:10px;text-align:center;font-size:0.8em;color:#FFD700;">Clique para navegar</p>`; }
    return tooltipContent;
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
    return new Promise((resolve) => {
        Papa.parse(caminhoDoArquivoCSV, {
            download: true,
            header: true,
            skipEmptyLines: true,
            delimiter: ';',
            complete: async (results) => {
                if (results.errors.length > 0) {
                    console.warn(`Aviso: Erros ao analisar ${caminhoDoArquivoCSV}`, results.errors);
                    return resolve([]);
                }

                const dados = results.data;
                const markers = [];

                for (const [index, markerDataFromCSV] of dados.entries()) {
                    const currentMarkerId = `${panoIdOrigem}-marker-${index}`;
                    
                    const markerData = {
                        Titulo: markerDataFromCSV.Titulo || 'Marcador sem título',
                        Descricao: markerDataFromCSV.Descricao || '',
                        Imagem: markerDataFromCSV.Imagem || '',
                        Pitch: parseFloat(markerDataFromCSV.Pitch || 0),
                        Yaw: parseFloat(markerDataFromCSV.Yaw || 0),
                        Pano_Destino_ID: markerDataFromCSV.Pano_Destino_ID || '',
                        poligono_json: markerDataFromCSV.poligono_json || '',
                        Tipo_Poligono_CSS: markerDataFromCSV.Tipo_Poligono_CSS || ''
                    };

                    const isNavigationMarker = markerData.Pano_Destino_ID.length > 0;
                    const tooltipContent = createCarouselTooltipHTML({ ...markerData, id: currentMarkerId });

                    let markerConfig = {
                        id: currentMarkerId,
                        tooltip: { content: tooltipContent, persistent: false, style: { background: 'rgba(30, 30, 30, 0.9)', color: 'white', borderRadius: '10px', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)', padding: '15px', fontSize: '14px', textAlign: 'left', transition: 'opacity 0.2s ease-out, transform 0.2s ease-out', opacity: '0', transform: 'translateY(10px) scale(0.9)' }, className: 'psv-tooltip-custom-visible' },
                        listContent: markerData.Titulo,
                        data: { titleForList: markerData.Titulo, panoDestinoId: markerData.Pano_Destino_ID, isNavigation: isNavigationMarker }
                    };

                    if (markerData.poligono_json) {
                        try {
                            const poligonoData = await fetch(`markers/${markerData.poligono_json}`).then(res => res.json());
                            if (Array.isArray(poligonoData) && poligonoData.every(v => typeof v.yaw === 'number' && typeof v.pitch === 'number')) {
                                markerConfig.polygon = poligonoData; markerConfig.svgStyle = POLYGON_STYLES[markerData.Tipo_Poligono_CSS] || POLYGON_STYLES['default']; markerConfig.className = `${markerConfig.className || ''} ${markerData.Tipo_Poligono_CSS || 'default'}`.trim();
                            } else if (!isNaN(markerData.Pitch) && !isNaN(markerData.Yaw)) { Object.assign(markerConfig, getPointMarkerConfig(currentMarkerId, isNavigationMarker, markerData)); }
                        } catch (e) { if (!isNaN(markerData.Pitch) && !isNaN(markerData.Yaw)) { Object.assign(markerConfig, getPointMarkerConfig(currentMarkerId, isNavigationMarker, markerData)); } }
                    } else {
                        if (!isNaN(markerData.Pitch) && !isNaN(markerData.Yaw)) { Object.assign(markerConfig, getPointMarkerConfig(currentMarkerId, isNavigationMarker, markerData)); } else { continue; }
                    }
                    markers.push(markerConfig);
                }
                resolve(markers);
            },
            error: (error) => {
                console.warn(`Aviso: Não foi possível baixar ${caminhoDoArquivoCSV}`, error);
                resolve([]);
            }
        });
    });
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
    return new Promise((resolve, reject) => {
        Papa.parse(caminhoDoArquivoCSV, {
            download: true,
            header: true,
            skipEmptyLines: true,
            delimiter: ';',
            complete: async (results) => {
                if (results.errors.length > 0) {
                    console.error("Erros ao analisar o CSV principal:", results.errors);
                    return reject(new Error("Falha ao analisar o CSV principal."));
                }

                const dados = results.data;
                const floorsMap = new Map();
                
                for (const linha of dados) {
                    const pavimento = linha.Pavimento;
                    if (!pavimento) continue;

                    if (!floorsMap.has(pavimento)) {
                        floorsMap.set(pavimento, {
                            name: pavimento,
                            fileBasePath: `plans/${pavimento.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '_').replace(/º/g, '')}`,
                            markers: [],
                            description: linha.Descricao_Pavimento || '',
                        });
                    }

                    const imagem360 = (linha.Imagem_360 || '').replace(/^\//, '');
                    if (imagem360) {
                        const idUnico = linha.ID_Unico || `pano${Date.now()}`;
                        const markersInfoCSV = (linha.Markers_Info || '').replace(/^\//, '');
                        
                        PANORAMAS_DATA_DINAMICO[idUnico] = {
                            path: `panos/${imagem360}`,
                            markers: markersInfoCSV ? await carregarMarkers360DoCSV(markersInfoCSV, idUnico) : [],
                            floorName: pavimento,
                            localName: linha.Local
                        };

                        floorsMap.get(pavimento).markers.push({
                            x: parseInt(linha.X),
                            y: parseInt(linha.Y),
                            panoId: idUnico,
                            radius: 15,
                            color: '#a8a8a8',
                            label: linha.Local
                        });
                    }
                }
                resolve(Array.from(floorsMap.values()));
            },
            error: (error) => {
                console.error("Erro de rede ao baixar o CSV principal:", error);
                reject(error);
            }
        });
    });
}

async function getBestImageFormat(basePath) {
    const webpUrl = `${basePath}.webp`;
    try {
        const response = await fetch(webpUrl, { method: 'HEAD' }); if (response.ok) return webpUrl;
    } catch (error) {}
    return `${basePath}.png`;
}

function unpinCurrentMarker() {
    if (pinnedMarkerId) {
        const marker = markersPluginInstance.getMarker(pinnedMarkerId);
        if (marker) {
            markersPluginInstance.updateMarker({
                id: pinnedMarkerId,
                tooltip: { persistent: false }
            });
            markersPluginInstance.hideMarkerTooltip(pinnedMarkerId);
        }
        pinnedMarkerId = null;
    }
}

// ▼▼▼ FUNÇÃO ATUALIZADA COM LOGS DE DIAGNÓSTICO ▼▼▼
async function inicializarAplicacao() {
    console.log("Aplicação inicializada.");

    $floorList = document.getElementById('floor-list');
    $plan = document.getElementById('plan');
    $viewerSection = document.querySelector('.viewer');
    $viewerContainer = document.getElementById('viewer');
    $planTitle = document.querySelector('.plan h2');
    $welcomeOverlay = document.getElementById('welcome-overlay');

    if ($planTitle) {
        $planTitle.textContent = 'Planta Baixa';
    }
    
    const welcomeContent = $welcomeOverlay.querySelector('.welcome-content');
    welcomeContent.innerHTML = `<h2>Bem-vindo ao Tour Interativo do Instituto Tecnológico de Agropecuária de Pitangui</h2>
<p>Explore os espaços do instituto de forma fácil, intuitiva e imersiva:</p>
<ul>
  <li><strong>Escolha um pavimento</strong> na lista à esquerda para carregar a planta correspondente.</li>
  <li>Na planta, <strong>clique sobre os marcadores</strong> para acessar a visualização em 360° do local.</li>
  <li>Durante a visualização 360°, <strong>clique e arraste</strong> a imagem para explorar o ambiente ao seu redor.</li>
  <li>Alguns pontos na imagem 360° possuem <strong>marcadores interativos</strong>: ao clicar neles, você pode fixá-los e acessar mídias relacionadas (como fotos e vídeos) com informações detalhadas sobre o local.</li>
</ul>`;

    try {
        console.log("Tentando carregar 'dados/marcadores.csv'...");
        FLOORS_DINAMICO = await carregarDadosDoCSV('dados/marcadores.csv');
        
        console.log("SUCESSO: CSV principal carregado. Dados:", FLOORS_DINAMICO);

    } catch (error) {
        console.error("FALHA CATASTRÓFICA ao carregar dados do CSV principal:", error);
        $viewerContainer.innerHTML = '<div style="text-align: center; color: #ff0000; padding: 20px;">Erro fatal ao carregar dados. Verifique o console para mais detalhes.</div>';
        return;
    }

    if (FLOORS_DINAMICO.length === 0) {
        console.error("AVISO: O arquivo CSV foi lido, mas resultou em 0 pavimentos. Verifique o conteúdo do arquivo 'marcadores.csv'. A aplicação não pode continuar.");
        return;
    }

    console.log("Dados carregados. Construindo a lista de pavimentos...");

    $floorList.innerHTML = '';
    FLOORS_DINAMICO.forEach((f, idx) => {
        const li = document.createElement('li'); li.textContent = f.name; li.addEventListener('click', () => loadFloor(idx)); $floorList.append(li);
    });

    console.log("Inicializando o Photo Sphere Viewer...");

    photoSphereViewer = new Viewer({
        container: $viewerContainer, panorama: null, caption: '', loadingImg: null,
        navbar: [ 'zoom', 'move', 'markers', { id: 'markers-list-button', content: MARKERS_LIST_ICON, title: 'Lista de Marcadores', className: 'custom-markers-list-button', onClick: (viewer) => { if (viewer.panel.isVisible(MARKERS_PANEL_ID)) { viewer.panel.hide(MARKERS_PANEL_ID); } else { const currentMarkers = markersPluginInstance.getMarkers(); let panelContent = ''; if (currentMarkers.length > 0) { panelContent = '<div class="psv-panel-menu psv-panel-menu--stripped"><h1 class="psv-panel-menu-title">Marcadores</h1><ul class="psv-panel-menu-list">'; currentMarkers.forEach(marker => { const markerTitle = marker.data && marker.data.titleForList ? marker.data.titleForList : marker.id; panelContent += `<li class="psv-panel-menu-item" data-marker-id="${marker.id}" tabindex="0"><span class="psv-panel-menu-item-label">${markerTitle}</span></li>`; }); panelContent += '</ul></div>'; } else { panelContent = '<p style="padding: 1em; text-align: center;">Nenhum marcador disponível.</p>'; } viewer.panel.show({ id: MARKERS_PANEL_ID, content: panelContent, noMargin: true, clickHandler: (target) => { const listItem = target.closest('.psv-panel-menu-item'); if (listItem) { const markerId = listItem.dataset.markerId; if (markerId) { markersPluginInstance.gotoMarker(markerId, 1500); viewer.panel.hide(MARKERS_PANEL_ID); } } } }); } } }, 'caption', 'fullscreen' ],
        plugins: [ [MarkersPlugin] ],
    });

    console.log("Photo Sphere Viewer inicializado. Obtendo plugin de marcadores...");

    markersPluginInstance = photoSphereViewer.getPlugin(MarkersPlugin);

    markersPluginInstance.addEventListener('open-tooltip', ({ marker }) => {
        if (marker.tooltip.tooltipEl) {
            ['mousedown', 'click', 'pointerdown'].forEach(eventName => {
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
        if (pinnedMarkerId && pinnedMarkerId !== marker.id) {
            unpinCurrentMarker();
        }
    });

    $viewerContainer.style.visibility = 'hidden';
    
    photoSphereViewer.addEventListener('click', (e) => {
        if (blockUnpinOnClick) {
            blockUnpinOnClick = false; 
            return; 
        }
        
        if (!e.data.marker) {
            unpinCurrentMarker();
        }
        
        handleViewerClick(e);
    });

    window.togglePolygonDrawingMode = togglePolygonDrawingMode;
    await customElements.whenDefined('floor-plan');
    $plan.addEventListener('marker-click', handleMarkerClick);
    
    $plan.addEventListener('marker-over', handlePlanMarkerOver);
    $plan.addEventListener('marker-out', handlePlanMarkerOut);
    
    injetarSVGPatternsNoDOM();

    console.log("Inicialização completa. Aplicação pronta.");
}

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
        
        $plan.loadMap(mapUrl, floorData.markers); 
        
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
    try {
        if (panoramaData) {
            $plan.activePanoId = panoId;
            photoSphereViewer.setOption('caption', marker.label);
            await photoSphereViewer.setPanorama(panoramaData.path, { transition: { duration: 1500, zoom: 0 } });
            photoSphereViewer.zoom(0);

            $viewerContainer.style.visibility = 'visible';
            $welcomeOverlay.classList.add('hidden');
            if (markersPluginInstance) {
                markersPluginInstance.setMarkers(panoramaData.markers || []);
            }
        } else { throw new Error('Panorama data not found'); }
    } catch (loadError) {
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
    const panoId = pano;

    if ($plan.activePanoId !== panoId) {
        return;
    }

    const panoramaData = PANORAMAS_DATA_DINAMICO[panoId];
    if (panoramaData && panoramaData.markers && panoramaData.markers.length > 0) {
        let targetMarker = panoramaData.markers.find(m =>
            m.listContent && marker.label && m.listContent === marker.label
        );

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

function limparEstilosInlineDosPoligonos() {
    setTimeout(() => {
        document.querySelectorAll('.psv-marker--poly path').forEach(path => {
            path.removeAttribute('fill');
            path.removeAttribute('stroke');
            path.removeAttribute('style');
        });
    }, 100);
}

// ▼▼▼ LINHA MAIS IMPORTANTE ▼▼▼
// Garante que a aplicação só comece a ser construída depois que todo o HTML da página estiver pronto.
document.addEventListener('DOMContentLoaded', inicializarAplicacao);