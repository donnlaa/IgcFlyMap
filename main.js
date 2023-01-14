import Feature from 'ol/Feature';
import IGC from 'ol/format/IGC';
import Map from 'ol/Map';
import OSM, {ATTRIBUTION} from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import View from 'ol/View';
import {Circle as CircleStyle, Fill, Stroke, Style} from 'ol/style';
import {LineString, Point} from 'ol/geom';
import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer';
import {getVectorContext} from 'ol/render';

const colors = {
  'Marek Kováč': 'rgba(0, 0, 255, 0.7)',
  'Ryland Jordan': 'rgba(254, 0, 0, 0.8)',
};

const styleCache = {};
const styleFunction = function (feature) {
  const color = colors[feature.get('PLT')];
  let style = styleCache[color];
  if (!style) {
    style = new Style({
      stroke: new Stroke({
        color: color,
        width: 3,
      }),
    });
    styleCache[color] = style;
  }
  return style;
};

const vectorSource = new VectorSource();
// cesta k igc súboru
const igcUrls = [
  '/Users/ladislavdono/my-app/igc/igc1',
  // '/Users/ladislavdono/my-app/igc/igc2',
  // '/Users/ladislavdono/my-app/igc/igc3',
  //  '/Users/ladislavdono/my-app/igc/igc4',
];
// citanie dat zo subora, pouzity fetch (blob) aby sa dal spracovat text zo suboru
let reader = new FileReader();
for (let i = 0; i < igcUrls.length; ++i) {
  fetch(igcUrls[i]) 
  .then((response) => response.blob())
  .then((blob) => {
    reader.onload = function () {
      const data = reader.result;
      const features = igcFormat.readFeatures(data, {
        featureProjection: 'EPSG:3857',
      });
      vectorSource.addFeatures(features);
    };
    reader.readAsText(blob);
  });
}
const igcFormat = new IGC();

const time = {
  start: Infinity,
  stop: -Infinity,
  duration: 0,
};
// toto sa zapne pri kazdom subore
vectorSource.on('addfeature', function (event) {
  const geometry = event.feature.getGeometry();
  time.start = Math.min(time.start, geometry.getFirstCoordinate()[2]);
  time.stop = Math.max(time.stop, geometry.getLastCoordinate()[2]);
  time.duration = time.stop - time.start;
  // nizsie sa centruje mapa na dany let kde zacina
    const flightGeometry = event.feature.getGeometry();
    const startingPoint = flightGeometry.getFirstCoordinate();
    map.getView().setCenter(startingPoint);
});

const vectorLayer = new VectorLayer({
  source: vectorSource,
  style: styleFunction,
});
// vytvorenie mapy

const map = new Map({
  layers: [
    new TileLayer({
      source: new OSM({
        attributions: [
          'All maps © <a href="https://www.opencyclemap.org/">OpenCycleMap</a>',
          ATTRIBUTION,
        ],
        url:
          'https://{a-c}.tile.thunderforest.com/cycle/{z}/{x}/{y}.png' +
          '?apikey=2baf9b82946e43edaec9c963e83553a5',
      }),
    }),
    vectorLayer,
  ],
  target: 'map',
  view: new View({
    
    zoom: 10,
  }),
});

let point = null;
let line = null;
const displaySnap = function (coordinate) {
  const closestFeature = vectorSource.getClosestFeatureToCoordinate(coordinate);
  const info = document.getElementById('info');
  if (closestFeature === null) {
    point = null;
    line = null;
    info.innerHTML = '&nbsp;';
  } else {
    const geometry = closestFeature.getGeometry();
    const closestPoint = geometry.getClosestPoint(coordinate);
    if (point === null) {
      point = new Point(closestPoint);
    } else {
      point.setCoordinates(closestPoint);
    }
    const date = new Date(closestPoint[2] * 1000);
    info.innerHTML =
      closestFeature.get('PLT') + ' (' + date.toUTCString() + ')';
    const coordinates = [coordinate, [closestPoint[0], closestPoint[1]]];
    if (line === null) {
      line = new LineString(coordinates);
    } else {
      line.setCoordinates(coordinates);
    }
  }
  map.render();
};


map.on('pointermove', function (evt) {
  if (evt.dragging) {
    return;
  }
  const coordinate = map.getEventCoordinate(evt.originalEvent);
  displaySnap(coordinate);
});

map.on('click', function (evt) {
  displaySnap(evt.coordinate);
});

const stroke = new Stroke({
  color: 'rgba(255,0,0,0.9)',
  width: 1,
});
const style = new Style({
  stroke: stroke,
  image: new CircleStyle({
    radius: 5,
    fill: null,
    stroke: stroke,
  }),
});
vectorLayer.on('postrender', function (evt) {
  const vectorContext = getVectorContext(evt);
  vectorContext.setStyle(style);
  if (point !== null) {
    vectorContext.drawGeometry(point);
  }
  if (line !== null) {
    vectorContext.drawGeometry(line);
  }
});

const featureOverlay = new VectorLayer({
  source: new VectorSource(),
  map: map,
  style: new Style({
    image: new CircleStyle({
      radius: 5,
      fill: new Fill({
        color: 'rgba(255,0,0,0.9)',
      }),
    }),
  }),
});


const control = document.getElementById('time');
control.addEventListener('input', function () {
  const value = parseInt(control.value, 10) / 100;
  const m = time.start + time.duration * value;
  vectorSource.forEachFeature(function (feature) {
    const geometry =
      /** @type {import("../src/ol/geom/LineString.js").default} */ (
        feature.getGeometry()
      );
    const coordinate = geometry.getCoordinateAtM(m, true);
    let highlight = feature.get('highlight');
    if (highlight === undefined) {
      highlight = new Feature(new Point(coordinate));
      feature.set('highlight', highlight);
      featureOverlay.getSource().addFeature(highlight);
    } else {
      highlight.getGeometry().setCoordinates(coordinate);
    }
  });
  map.render();
});
// text pod mapou co pise informacie o lete... 
function toTimeString(totalSeconds) { // funkcia na premenu sekund na normalny format casu
  const totalMs = totalSeconds * 1000;
  const result = new Date(totalMs).toISOString().slice(11, 19);

  return result;
}
// NIZSIE JE ZAS KOD PRE TABULKU VYPIS
let pilotName;
let duration;
let gliderName;
for (let i = 0; i < igcUrls.length; ++i) {
  fetch(igcUrls[i])
    .then((response) => response.text())
    .then((data) => {
      const features = igcFormat.readFeatures(data, {
        featureProjection: 'EPSG:3857',
      });
      vectorSource.addFeatures(features);
      pilotName = features[0].get('PLT');
      gliderName = features[0].get('GTY');
      duration = toTimeString(time.duration);
      const table = document.getElementById("flight-table");
      const row = table.insertRow();
      const pilotCell = row.insertCell(0);
      const gliderCell = row.insertCell(1);
      const durationCell = row.insertCell(2);
      pilotCell.innerHTML = pilotName;
      gliderCell.innerHTML = gliderName;
      durationCell.innerHTML = duration + "h";
    });
}
