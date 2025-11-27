import { Viewer } from "../libs/photo-sphere-viewer.module.js";
import { MarkersPlugin } from "../libs/photo-sphere-viewer-markers.module.js";

export class PanoViewer {
    constructor(containerId) {
        this.viewer = new Viewer({
            container: containerId,
            panorama: null,
            plugins: [
                [MarkersPlugin, {
                    css: false,
                    markers: [
                        {
                            id: 'marker1',
                            position: { longitude: 0, latitude: 0 },
                            image: '../panos/IMG_8007.JPG',
                            size: { width: 32, height: 32 },
                            anchor: 'bottom center',
                            tooltip: 'Marker 1',
                        },
                    ],
                }],
            ],
        });
    }

    loadPano(path) {
        this.viewer.setPanorama(path);
    }
}