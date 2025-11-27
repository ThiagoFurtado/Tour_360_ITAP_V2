import { Viewer } from "../libs/photo-sphere-viewer.module.js";
import { MarkersPlugin } from "../libs/photo-sphere-viewer-markers.module.js";

export class PanoViewer extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        // Carregar os CSS dentro do Shadow DOM
        const styleLink = document.createElement('link');
        styleLink.rel = 'stylesheet';
        styleLink.href = '../libs/photo-sphere-viewer.css';

        const markersStyleLink = document.createElement('link');
        markersStyleLink.rel = 'stylesheet';
        markersStyleLink.href = '../libs/photo-sphere-viewer-markers.css';
        
        // Estilos personalizados para os marcadores
        const customStyle = document.createElement('style');
        customStyle.textContent = `
            .marker-tooltip {
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 10px;
                border-radius: 8px;
                font-family: Arial, sans-serif;
                font-size: 14px;
                max-width: 300px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            
            .marker-tooltip h3 {
                margin: 0 0 8px 0;
                font-size: 16px;
                font-weight: bold;
                color: #fff;
            }
            
            .marker-tooltip p {
                margin: 0 0 8px 0;
                line-height: 1.4;
            }
            
            .marker-tooltip img {
                width: 100%;
                max-width: 200px;
                height: auto;
                border-radius: 4px;
                margin-top: 8px;
            }
            
            .marker-pin {
                width: 32px;
                height: 32px;
                background: #ff4444;
                border: 3px solid white;
                border-radius: 50%;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: 14px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            }
            
            .marker-pin:hover {
                transform: scale(1.2);
                background: #ff6666;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            }
            
            .marker-pin.info {
                background: #4444ff;
            }
            
            .marker-pin.warning {
                background: #ffaa00;
            }
            
            .marker-pin.success {
                background: #44ff44;
            }
        `;
        
        this.shadowRoot.append(styleLink, markersStyleLink, customStyle);
        
        // Container para o viewer dentro do shadow DOM
        const viewerContainer = document.createElement('div');
        viewerContainer.style.width = '100%';
        viewerContainer.style.height = '100%';
        this.shadowRoot.appendChild(viewerContainer);

        this.viewer = new Viewer({
            container: viewerContainer,
            panorama: null,
            plugins: [
                [MarkersPlugin, {
                    markers: [],
                }],
            ],
        });

        // Evento quando o viewer está pronto
        this.viewer.addEventListener('ready', () => {
            this.markersPlugin = this.viewer.getPlugin(MarkersPlugin);
            
            // Configura eventos dos marcadores
            this.setupMarkerEvents();
            
            if (this._pendingMarkers) {
                this.markers = this._pendingMarkers;
                delete this._pendingMarkers;
            }

            // Adicione o listener de clique aqui, dentro do escopo da classe PanoViewer
            // Este listener é para cliques genéricos no panorama, não em marcadores específicos
            this.viewer.addEventListener('click', (event) => {
                // Verifique se event.data existe e contém yaw e pitch antes de desestruturar
                if (event.data && typeof event.data.yaw !== 'undefined' && typeof event.data.pitch !== 'undefined') {
                    const { yaw, pitch } = event.data;

                    // console.log(`Coordenadas Esféricas do clique:`); // Comentado para evitar logs duplicados com main.js
                    // console.log(`Yaw: ${yaw} radianos`);
                    // console.log(`Pitch: ${pitch} radianos`);
                } else {
                    // console.log("Clique detectado, mas coordenadas esféricas (yaw, pitch) não disponíveis para este ponto. Objeto event.data:", event.data); // Comentado
                }
            });
        }, { once: true });
    }

    static get observedAttributes() {
        return ['panorama'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'panorama' && oldValue !== newValue) {
            if (this.viewer && typeof this.viewer.setPanorama === 'function') {
                this.viewer.setPanorama(newValue).catch(e => console.error(e));
            }
        }
    }

    setupMarkerEvents() {
        if (!this.markersPlugin) return;

            // Evento de hover nos marcadores (Removido para evitar problemas em dispositivos móveis)
            // A lógica de exibição de tooltip agora é controlada pelo evento 'click' no main.js
            // que usa a função showTooltip do PSV, que é mais robusta.
            // Se o tooltip for customizado, a lógica deve ser implementada no main.js.
            // Mantendo apenas o evento de clique/seleção.

        // Evento de clique nos marcadores
        // Este evento é capturado pelo main.js, que tem a lógica de navegação
        this.markersPlugin.addEventListener('select-marker', ({ marker }) => {
            this.dispatchEvent(new CustomEvent('marker-click', { // Dispara um evento customizado
                detail: { 
                    marker: marker,
                    data: marker.data 
                }
            }));
        });
    }

        // As funções showTooltip e hideTooltip foram removidas.
        // O Photo Sphere Viewer (PSV) tem sua própria lógica de tooltip que funciona
        // melhor com o plugin de marcadores e é mais compatível com toque.
        // O main.js já está configurando o tooltip do PSV.
        // Se for necessário um tooltip customizado, a lógica deve ser movida para o main.js
        // e usar as funções nativas do PSV para mostrar/esconder.
        // Para este projeto, vamos confiar no comportamento padrão do PSV para tooltips.

    createMarkerElement(markerData) {
        const element = document.createElement('div');
        element.className = `marker-pin ${markerData.type || 'default'}`;
        
        if (markerData.label) {
            element.textContent = markerData.label;
        }

        return element;
    }

    set markers(markersData) {
        if (!markersData || !Array.isArray(markersData)) {
            return;
        }

        // Converte os dados dos marcadores para o formato esperado pelo plugin
        // Filtra marcadores que não possuem uma posição válida
        const formattedMarkers = markersData.map(marker => {
            return this.formatSingleMarker(marker);
        }).filter(marker => marker !== null); // Filtra os marcadores nulos

        // Se o plugin de marcadores já estiver pronto, define os marcadores
        if (this.markersPlugin) {
            this.markersPlugin.setMarkers(formattedMarkers);
        } else {
            // Se não, armazena os marcadores para serem definidos quando o evento 'ready' disparar
            // Armazena apenas os dados brutos, a formatação será feita no 'ready'
            this._pendingMarkers = markersData.filter(marker => marker.position && typeof marker.position.yaw !== 'undefined' && typeof marker.position.pitch !== 'undefined');
        }
    }

    // Métodos públicos para gerenciar marcadores
    addMarker(markerData) {
        if (this.markersPlugin) {
            const formattedMarker = this.formatSingleMarker(markerData);
            if (formattedMarker) { // Adiciona apenas se o marcador for válido
                this.markersPlugin.addMarker(formattedMarker);
            }
        }
    }

    removeMarker(markerId) {
        if (this.markersPlugin) {
            this.markersPlugin.removeMarker(markerId);
        }
    }

    updateMarker(markerData) {
        if (this.markersPlugin) {
            const formattedMarker = this.formatSingleMarker(markerData);
            if (formattedMarker) { // Atualiza apenas se o marcador for válido
                this.markersPlugin.updateMarker(formattedMarker);
            }
        }
    }

    formatSingleMarker(marker) {
        // Valida se o marcador possui ID e posição antes de formatar
        if (!marker || !marker.id || !marker.position || typeof marker.position.yaw === 'undefined' || typeof marker.position.pitch === 'undefined') {
            console.warn(`Aviso: Marcador com ID '${marker ? marker.id : 'desconhecido'}' ou sem posição válida (yaw/pitch) foi ignorado. Verifique os dados do marcador.`);
            return null; // Retorna null para indicar um marcador inválido
        }

        const formattedMarker = {
            id: marker.id,
            position: marker.position,
            data: marker.data // Armazena os dados originais (incluindo isNavigation, panoDestinoId)
        };

        // Prioriza 'element' se estiver presente (como na nossa alteração do main.js)
        if (marker.element) {
            formattedMarker.element = marker.element;
        } else if (marker.html) {
            formattedMarker.html = marker.html;
        } else if (marker.image) {
            formattedMarker.image = marker.image;
            formattedMarker.size = marker.size || { width: 32, height: 32 };
        } else {
            formattedMarker.element = this.createMarkerElement(marker);
            formattedMarker.size = marker.size || { width: 32, height: 32 };
        }

        // Copia as propriedades de tooltip diretamente
        if (marker.tooltip) {
            formattedMarker.tooltip = marker.tooltip;
        }

        if (marker.anchor) formattedMarker.anchor = marker.anchor;
        if (marker.scale) formattedMarker.scale = marker.scale;
        if (marker.opacity) formattedMarker.opacity = marker.opacity;
        if (marker.className) formattedMarker.className = marker.className;
        if (marker.style) formattedMarker.style = marker.style;

        return formattedMarker;
    }

    disconnectedCallback() {
        this.hideTooltip();
        if (this.viewer) {
            this.viewer.destroy();
        }
    }
}

customElements.define('pano-viewer', PanoViewer);
