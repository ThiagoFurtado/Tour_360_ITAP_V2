export class FloorPlan extends HTMLElement {
if (this.pzInstance) {
try { this.pzInstance.dispose(); } catch(e) {}
this.pzInstance = null;
}


this.map.style.display = 'none';


this.map.onload = () => {
console.log('[floor-plan] imagem carregada');


this.map.style.display = 'block';
this.imageNaturalWidth = this.map.naturalWidth;
this.imageNaturalHeight = this.map.naturalHeight;


const rect = this.container.getBoundingClientRect();
const ratio = Math.min(rect.width / this.imageNaturalWidth, rect.height / this.imageNaturalHeight);


this.panzoomWrapper.style.width = `${this.imageNaturalWidth * ratio}px`;
this.panzoomWrapper.style.height = `${this.imageNaturalHeight * ratio}px`;


this.renderMarkers();


try {
if (window.panzoom) {
this.pzInstance = window.panzoom(this.panzoomWrapper, {
maxZoom: 10,
minZoom: 1,
bounds: false,
});
}
} catch (e) {
console.warn('[floor-plan] Panzoom não funcionou:', e);
}


this.container.classList.remove('loading');
};


this.map.onerror = () => {
console.error('[floor-plan] Erro ao carregar', url);
this.container.classList.remove('loading');
};


this.map.src = url;
}


/* ============================================================ */
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


customElements.define('floor-plan', FloorPlan);