// components/floor-plan.js (Versão Final Estabilizada)

export class FloorPlan extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        const style = document.createElement('style');
        style.textContent = `
            :host { display: block; width: 100%; height: 100%; }
            .floor-plan-container { 
                width: 100%; height: 100%; 
                overflow: hidden; 
                background-color: #f9f9f9; 
                border-radius: 8px; 
                display: flex; align-items: center; justify-content: center; 
                position: relative; 
            }
            .loader { position: absolute; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid var(--accent-color, #007bff); border-radius: 50%; animation: spin 1s linear infinite; z-index: 20; display: none; }
            .floor-plan-container.loading .loader { display: block; }
            .floor-plan-container.loading .panzoom-wrapper { opacity: 0.5; transition: opacity 0.3s; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            .panzoom-wrapper { position: relative; }
            .floor-plan-map { display: block; width: 100%; height: 100%; }
            .markers-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
            .zoom-controls { position: absolute; bottom: 15px; right: 15px; z-index: 10; display: flex; flex-direction: row; gap: 5px; pointer-events: auto; }
            .zoom-button { width: 36px; height: 36px; background-color: rgba(0, 0, 0, 0.6); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 20px; line-height: 1; transition: background-color 0.2s, transform 0.1s; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
            .zoom-button:hover { background-color: rgba(0, 0, 0, 0.8); }
            .zoom-button:active { transform: scale(0.95); }
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
        
        this.zoomControls = document.createElement("div");
        this.zoomControls.className = "zoom-controls";
        this.zoomInButton = document.createElement("button");
        this.zoomInButton.className = "zoom-button";
        this.zoomInButton.innerHTML = "+";
        this.zoomOutButton = document.createElement("button");
        this.zoomOutButton.className = "zoom-button";
        this.zoomOutButton.innerHTML = "−"; 
        
        this.zoomControls.append(this.zoomInButton, this.zoomOutButton);
        
        this.panzoomWrapper.append(this.map, this.markersOverlay);
        this.container.append(this.panzoomWrapper, this.loader, this.zoomControls);
        this.shadowRoot.append(style, this.container);

        this.pzInstance = null;
        this.imageNaturalWidth = 0;
        this.imageNaturalHeight = 0;
        this._markerRadius = 7;
        this._activePanoId = null;
        this._wheelHandler = null; 
        this._initialZoom = 1; 
        this._initialCenterX = null; 
        this._initialCenterY = null; 
        this.ZOOM_STEP = 0.5;

        // NOVO: Variável de controle para estabilidade do zoom manual
        this._targetZoom = null; 
    }
    
    connectedCallback() {
        // Bloqueia o zoom por wheel (roda do mouse)
        this._wheelHandler = (e) => {
            e.preventDefault(); 
            e.stopPropagation(); 
        };
        this.container.addEventListener('wheel', this._wheelHandler, { passive: false });
    }
    
    static get observedAttributes() { return ["map-url", "marker-radius", "active-pano-id", "initial-zoom", "initial-center-x", "initial-center-y"]; }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === "map-url" && oldValue !== newValue) this.loadImage(newValue);
        else if (name === "initial-zoom") {
            const newZoom = parseFloat(newValue);
            if (!isNaN(newZoom) && newZoom >= 1 && newZoom <= 10) {
                this._initialZoom = newZoom;
                if (this.pzInstance) {
                    this.pzInstance.zoomTo(this._initialZoom);
                    // Sincroniza o alvo com o novo zoom inicial
                    this._targetZoom = this._initialZoom;
                    const finalScale = this.pzInstance.getTransform().scale;
                    this.container.style.setProperty('--inverse-scale', 1 / finalScale);
                }
            }
        } else if (name === "initial-center-x") {
            this._initialCenterX = newValue ? parseFloat(newValue) : null;
        } else if (name === "initial-center-y") {
            this._initialCenterY = newValue ? parseFloat(newValue) : null;
        }
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
            
            const relativeX = (markerData.x / this.imageNaturalWidth) * 100;
            const relativeY = (markerData.y / this.imageNaturalHeight) * 100;
            markerDiv.style.left = `${relativeX}%`;
            markerDiv.style.top = `${relativeY}%`;
            
            const size = this._markerRadius * 2;
            markerDiv.style.width = `${size}px`;
            markerDiv.style.height = `${size}px`;
            markerDiv.style.backgroundColor = markerData.color || "red";
            
            if (markerData.panoId === this._activePanoId) {
                markerDiv.classList.add('active-marker');
            }

            if (markerData.label) {
                const tooltipSpan = document.createElement('span');
                tooltipSpan.className = 'tooltip';
                tooltipSpan.textContent = markerData.label;
                markerDiv.appendChild(tooltipSpan);
            }

            const stopPropagation = (e) => { e.stopPropagation(); };
            markerDiv.addEventListener('mousedown', stopPropagation);
            markerDiv.addEventListener('touchstart', stopPropagation, { passive: true });
            markerDiv.addEventListener('pointerdown', stopPropagation);

            markerDiv.addEventListener("click", (e) => {
                e.stopPropagation(); 
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
        
        if (this._wheelHandler) {
            this.container.removeEventListener('wheel', this._wheelHandler, { passive: false });
            this._wheelHandler = null;
        }

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
            
            // === CORREÇÃO 1: ISOLAMENTO TOTAL DOS BOTÕES ===
            // Impede que o Panzoom detecte o clique nos botões como início de arraste
            const stopEvent = (e) => { e.stopPropagation(); };

            // Bloqueia eventos físicos (Drag/Touch)
            this.zoomInButton.addEventListener('mousedown', stopEvent);
            this.zoomInButton.addEventListener('touchstart', stopEvent, { passive: true });
            this.zoomInButton.addEventListener('pointerdown', stopEvent);

            this.zoomOutButton.addEventListener('mousedown', stopEvent);
            this.zoomOutButton.addEventListener('touchstart', stopEvent, { passive: true });
            this.zoomOutButton.addEventListener('pointerdown', stopEvent);

            // Define a lógica do clique
            this.zoomInButton.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.manualZoom(this.ZOOM_STEP);
            };
            this.zoomOutButton.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.manualZoom(-this.ZOOM_STEP);
            };
            // ===============================================

            const containerRect = this.container.getBoundingClientRect();
            const ratio = Math.min(containerRect.width / this.imageNaturalWidth, containerRect.height / this.imageNaturalHeight);
            this.panzoomWrapper.style.width = `${this.imageNaturalWidth * ratio}px`;
            this.panzoomWrapper.style.height = `${this.imageNaturalHeight * ratio}px`;
            this.renderMarkers();
            
this.pzInstance = window.panzoom(this.panzoomWrapper, { 
    maxZoom: 10, 
    minZoom: 1, 
    bounds: false, 
    zoomOnMouseWheel: false, 
    zoomOnPinch: false,      
    zoomOnDoubleClick: false, // Desativa o comportamento que causa o "pulo"
    smoothScroll: false      
});

// Impede que o clique duplo no container dispare qualquer lógica residual da biblioteca
this.container.addEventListener('dblclick', (e) => {
    e.preventDefault();
    e.stopPropagation();
}, { capture: true });
            
            this.pzInstance.on('zoom', (instance) => {
                const scale = instance.getTransform().scale;
                this.container.style.setProperty('--inverse-scale', 1 / scale);
            });
            
            // === Inicialização do Zoom ===
            const initialScale = this._initialZoom;
            
            // Define o estado inicial da variável de controle
            this._targetZoom = initialScale;

            const wrapperWidth = this.panzoomWrapper.clientWidth;
            const wrapperHeight = this.panzoomWrapper.clientHeight;
            
            let refX = wrapperWidth / 2;
            let refY = wrapperHeight / 2;
            
            if (this._initialCenterX !== null && this._initialCenterY !== null && this.imageNaturalWidth > 0) {
                const ratio = Math.min(wrapperWidth / this.imageNaturalWidth, wrapperHeight / this.imageNaturalHeight);
                refX = this._initialCenterX * ratio;
                refY = this._initialCenterY * ratio;
            }

            this.pzInstance.zoomTo(refX, refY, initialScale);

            const tx = (wrapperWidth / 2) - refX * initialScale;
            const ty = (wrapperHeight / 2) - refY * initialScale;

            this.pzInstance.moveTo(tx, ty);

            const finalScale = this.pzInstance.getTransform().scale;
            this.container.style.setProperty('--inverse-scale', 1 / finalScale);

            this.container.classList.remove('loading');
            this.zoomControls.style.display = 'flex';
            this.map.onload = null;
            this.map.onerror = null;
        };
        this.map.src = url;
    }
    
    disconnectedCallback() {
        if (this.pzInstance) this.pzInstance.dispose();
        
        // Limpeza dos eventos
        this.zoomInButton.onclick = null;
        this.zoomOutButton.onclick = null;
        // Se desejar limpar listeners específicos (mousedown), seria necessário guardá-los em variáveis,
        // mas como o elemento é destruído, o Garbage Collector lida com isso.
        
        if (this._wheelHandler) {
            this.container.removeEventListener('wheel', this._wheelHandler, { passive: false });
        }
    }
    
    // === CORREÇÃO 2: ZOOM MANUAL ROBUSTO ===
// === CORREÇÃO 2: ZOOM MANUAL ROBUSTO COM DEBUG ===
manualZoom(delta) {
    if (!this.pzInstance) return;

    // 1. Força a parada de qualquer animação em curso (como um zoom de clique duplo)
    this.pzInstance.pause(); 

    const currentTransform = this.pzInstance.getTransform();
    const realScale = currentTransform.scale;

    if (this._targetZoom === null || Math.abs(this._targetZoom - realScale) > 0.1) {
        this._targetZoom = realScale;
    }
    
    let newScale = this._targetZoom + delta;
    newScale = Math.round(newScale / this.ZOOM_STEP) * this.ZOOM_STEP;
    newScale = Math.max(1, Math.min(10, newScale));

    this._targetZoom = newScale;

    const rect = this.container.getBoundingClientRect();
    const cx = rect.left + (rect.width / 2);
    const cy = rect.top + (rect.height / 2);

    // 2. Aplica o zoom e retoma o funcionamento normal
    this.pzInstance.zoomAbs(cx, cy, newScale);
    this.pzInstance.resume(); 
}
}

customElements.define("floor-plan", FloorPlan);