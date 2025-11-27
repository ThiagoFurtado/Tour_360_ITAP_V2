export class FloorPlan extends HTMLElement {
    constructor() {
        super(); // Sempre chame super() primeiro
        this.pzInstance = null;
        this._markersData = [];
    }

    // Método do ciclo de vida do Web Component: chamado quando o elemento é adicionado ao DOM.
    connectedCallback() {
        // Encontra os elementos internos que foram definidos no HTML
        this.container = this.querySelector('.container');
        this.panzoomWrapper = this.querySelector('.panzoom-wrapper');
        this.map = this.querySelector('.map-image');
        this.markersOverlay = this.querySelector('.markers-overlay');

        if (!this.container || !this.panzoomWrapper || !this.map || !this.markersOverlay) {
            console.error('[floor-plan] A estrutura interna do componente (container, panzoom-wrapper, map-image, markers-overlay) não foi encontrada.');
        }
    }

    /**
     * Carrega uma nova planta baixa e seus marcadores.
     * @param {string} url - A URL da imagem da planta.
     * @param {Array} markers - Um array de objetos de marcadores.
     */
    loadMap(url, markers = []) {
        if (!url) {
            console.error('[floor-plan] URL da imagem não fornecida.');
            return;
        }
        
        // Armazena os dados dos marcadores
        this._markersData = markers;
        this.container.classList.add('loading');

        // Limpa a instância anterior do panzoom, se existir
        if (this.pzInstance) {
            try {
                this.pzInstance.dispose();
            } catch (e) {
                // Ignora erros na limpeza
            }
            this.pzInstance = null;
        }

        // Esconde o mapa enquanto carrega para evitar "pulos" na tela
        this.map.style.display = 'none';

        // Define o que acontece quando a imagem carregar com sucesso
        this.map.onload = () => {
            console.log('[floor-plan] Imagem carregada:', url);

            this.map.style.display = 'block';
            this.imageNaturalWidth = this.map.naturalWidth;
            this.imageNaturalHeight = this.map.naturalHeight;

            // Calcula a proporção para ajustar a imagem ao contêiner
            const rect = this.container.getBoundingClientRect();
            const ratio = Math.min(rect.width / this.imageNaturalWidth, rect.height / this.imageNaturalHeight);

            this.panzoomWrapper.style.width = `${this.imageNaturalWidth * ratio}px`;
            this.panzoomWrapper.style.height = `${this.imageNaturalHeight * ratio}px`;

            this.renderMarkers();

            // Tenta inicializar a biblioteca panzoom
            try {
                if (window.panzoom) {
                    this.pzInstance = window.panzoom(this.panzoomWrapper, {
                        maxZoom: 10,
                        minZoom: 1,
                        bounds: false,
                    });
                } else {
                    console.warn('[floor-plan] Biblioteca panzoom não encontrada no window.');
                }
            } catch (e) {
                console.warn('[floor-plan] Panzoom não funcionou:', e);
            }

            this.container.classList.remove('loading');
        };

        // Define o que acontece se houver um erro ao carregar a imagem
        this.map.onerror = () => {
            console.error('[floor-plan] Erro ao carregar a imagem:', url);
            this.container.classList.remove('loading');
        };

        // Inicia o carregamento da imagem definindo o 'src'
        this.map.src = url;
    }

    /**
     * Renderiza os marcadores na planta baixa.
     */
    renderMarkers() {
        if (!this._markersData) return;
        this.markersOverlay.innerHTML = '';

        this._markersData.forEach(marker => {
            const el = document.createElement('div');
            el.className = 'marker-point';
            el.style.left = marker.x + 'px';
            el.style.top = marker.y + 'px';
            el.style.pointerEvents = 'auto';

            el.addEventListener('click', (ev) => {
                ev.stopPropagation();
                this.dispatchEvent(new CustomEvent('marker-click', {
                    detail: {
                        pano: marker.panoId,
                        marker: marker
                    },
                    bubbles: true,
                    composed: true
                }));
            });

            this.markersOverlay.appendChild(el);
        });
    }
}

// Registra o custom element para que o navegador o reconheça
customElements.define('floor-plan', FloorPlan);
