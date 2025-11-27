// components/floor-plan.js (Versão funcional restaurada)

export class FloorPlan extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        const style = document.createElement('style');
        style.textContent = `
            :host { display: block; width: 100%; height: 100%; }
            .floor-plan-container { width: 100%; height: 100%; overflow: hidden; background-color: #f9f9f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; position: relative; }
            .loader { position: absolute; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid var(--accent-color, #007bff); border-radius: 50%; animation: spin 1s linear infinite; z-index: 20; display: none; }
            .floor-plan-container.loading .loader { display: block; }
            .floor-plan-container.loading .panzoom-wrapper { opacity: 0.5; transition: opacity 0.3s; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            .panzoom-wrapper { position: relative; }
            .floor-plan-map { display: block; width: 100%; height: 100%; }
            .markers-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
            .floor-plan-marker { cursor: pointer; position: absolute; border-radius: 50%; pointer-events: auto; transform-origin: center center; transform: translate(-50%, -50%) scale(var(--inverse-scale, 1)); transition: transform 0.2s ease, background-color 0.2s ease; border: 2px solid rgba(255, 255, 255, 0.8); box-shadow: 0 0 5px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
            .floor-plan-marker .tooltip { position: absolute; bottom: 120%; background-color: rgba(0, 0, 0, 0.8); color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; white-space: nowrap; z-index: 10; opacity: 0; transition: opacity 0.2s ease-in-out; pointer-events: none; }
            .floor-plan-marker:hover .tooltip { opacity: 1; }
            .floor-plan-marker:hover { transform: translate(-50%, -50%) scale(calc(var(--inverse-scale, 1) * 1.1)); }
            .floor-plan-marker.active-marker { background-color: #007bff !important; border-color: #00e0ff !important; box-shadow: 0 0 15px rgba(0, 123, 255, 0.8), 0 0 5px rgba(255, 255, 255, 0.5) !important; transform: translate(-50%, -50%) scale(calc(var(--inverse-scale, 1) * 1.2)); animation: pulse 1.5s infinite alternate; z-index: 1; }
            @keyframes pulse { from { transform: translate(-50%, -50%) scale(calc(var(--inverse-scale, 1) * 1.2)); } to { transform: translate(-50%, -50%) scale(calc(var(--inverse-scale, 1) * 1.3)); } }
        `;

        this.container = document.createElement("div");
        this.container.className = "floor-plan-container";
        this.panzoomWrapper = document.createElement("div");
        this.panzoomWrapper.className = "panzoom-wrapper";
        this.map = document.createElement("img");
        this.map.className = "floor-plan-map";
        this.map.alt = "Planta Baixa";
        this.markersOverlay = document.createElement("div");
        this.markersOverlay.className = "markers-overlay";
        this.loader = document.createElement("div");
        this.loader.className = "loader";
        this.panzoomWrapper.append(this.map, this.markersOverlay);
        this.container.append(this.panzoomWrapper, this.loader);
        this.shadowRoot.append(style, this.container);

        this.pzInstance = null;
        this.imageNaturalWidth = 0;
        this.imageNaturalHeight = 0;
        this._markerRadius = 7;
        this._activePanoId = null;
    }

    static get observedAttributes() { return ["map-url", "marker-radius", "active-pano-id"]; }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === "map-url" && oldValue !== newValue) this.loadImage(newValue);
        else if (name === "marker-radius") {
            const newRadius = parseInt(newValue);
            if (!isNaN(newRadius) && newRadius > 0) { this._markerRadius = newRadius; this.renderMarkers(); }
        } else if (name === "active-pano-id" && oldValue !== newValue) {
            this._activePanoId = newValue; this.renderMarkers();
        }
    }

    set markers(markersData) { this._markersData = markersData; if (this.map.src) this.renderMarkers(); }
    get markers() { return this._markersData; }
    set markerRadius(value) { const radius = parseInt(value); if (!isNaN(radius) && radius > 0) { this._markerRadius = radius; this.setAttribute('marker-radius', radius.toString()); } }
    get markerRadius() { return this._markerRadius; }
    set activePanoId(value) { this._activePanoId = value; this.setAttribute('active-pano-id', value || ''); }
    get activePanoId() { return this._activePanoId; }

renderMarkers() {
    this.markersOverlay.innerHTML = '';
    if (!this.markers || !this.imageNaturalWidth) return;

    this.markers.forEach(markerData => {
        const markerDiv = document.createElement("div");
        markerDiv.className = "floor-plan-marker";
        
        // Posicionamento
        const relativeX = (markerData.x / this.imageNaturalWidth) * 100;
        const relativeY = (markerData.y / this.imageNaturalHeight) * 100;
        markerDiv.style.left = `${relativeX}%`;
        markerDiv.style.top = `${relativeY}%`;
        
        // Estilo e Tamanho
        const size = this._markerRadius * 2;
        markerDiv.style.width = `${size}px`;
        markerDiv.style.height = `${size}px`;
        markerDiv.style.backgroundColor = markerData.color || "red";
        
        // Estado Ativo
        if (markerData.panoId === this._activePanoId) {
            markerDiv.classList.add('active-marker');
        }

        // Tooltip
        if (markerData.label) {
            const tooltipSpan = document.createElement('span');
            tooltipSpan.className = 'tooltip';
            tooltipSpan.textContent = markerData.label;
            markerDiv.appendChild(tooltipSpan);
        }

        /* --- CORREÇÃO DO CLIQUE MOBILE --- */
        // Impede que o Panzoom inicie o arrasto quando tocamos no marcador
        // Isso garante que o evento de 'click' seja disparado logo em seguida.
        const stopPropagation = (e) => {
             e.stopPropagation(); 
             // Opcional: e.preventDefault() aqui pode bloquear o click em alguns navegadores,
             // então use apenas stopPropagation para isolar o evento do Panzoom.
        };

        markerDiv.addEventListener('mousedown', stopPropagation);
        markerDiv.addEventListener('touchstart', stopPropagation, { passive: true });
        markerDiv.addEventListener('pointerdown', stopPropagation);
        /* ---------------------------------- */

        // Evento de Clique Final
        markerDiv.addEventListener("click", (e) => {
            e.stopPropagation(); // Garante segurança extra
            this.dispatchEvent(new CustomEvent("marker-click", { 
                detail: { pano: markerData.panoId, marker: markerData } 
            }));
        });

        this.markersOverlay.appendChild(markerDiv);
    });
}

    async loadImage(url) {
        this.container.classList.add('loading');
        this.markersOverlay.innerHTML = '';
        if (this.pzInstance) { this.pzInstance.dispose(); this.pzInstance = null; }
        this.panzoomWrapper.style.transform = '';
        this.map.onerror = () => {
            console.error("Erro: A imagem não pôde ser carregada a partir da URL:", url);
            this.container.innerHTML = `<div style="color: red; padding: 20px;">Erro ao carregar a imagem.</div>`;
            this.container.classList.remove('loading');
        };
        this.map.onload = () => {
            this.imageNaturalWidth = this.map.naturalWidth;
            this.imageNaturalHeight = this.map.naturalHeight;
            const containerRect = this.container.getBoundingClientRect();
            const ratio = Math.min(containerRect.width / this.imageNaturalWidth, containerRect.height / this.imageNaturalHeight);
            this.panzoomWrapper.style.width = `${this.imageNaturalWidth * ratio}px`;
            this.panzoomWrapper.style.height = `${this.imageNaturalHeight * ratio}px`;
            this.renderMarkers();
            this.pzInstance = window.panzoom(this.panzoomWrapper, { maxZoom: 10, minZoom: 1, bounds: true });
            this.pzInstance.on('zoom', (instance) => {
                const scale = instance.getTransform().scale;
                this.container.style.setProperty('--inverse-scale', 1 / scale);
            });
            this.container.style.setProperty('--inverse-scale', 1);
            this.container.classList.remove('loading');
            this.map.onload = null;
            this.map.onerror = null;
        };
        this.map.src = url;
    }
    
    disconnectedCallback() {
        if (this.pzInstance) this.pzInstance.dispose();
    }
}

customElements.define("floor-plan", FloorPlan);
