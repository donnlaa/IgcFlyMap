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
import {fromLonLat} from 'ol/proj';

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

let reader = new FileReader();

//tlacidlo
const fileInput = document.createElement("input");
fileInput.setAttribute("type", "file");


//vytvorenie tlacidla
// const importButton = document.createElement("button");
// importButton.innerHTML = "Vložiť .IGC";

//add event listener to the button
var importButton = document.getElementById("import-button");
importButton.addEventListener("click", function(){
  fileInput.click();
});

//add event listener for file input
fileInput.addEventListener("change", function(){
  const file = fileInput.files[0];
  reader.onload = function () {
    const data = reader.result;
    const features = igcFormat.readFeatures(data, {
      featureProjection: 'EPSG:3857',
    });
    vectorSource.addFeatures(features);
  };
  reader.readAsText(file);
});

const igcFormat = new IGC();
importButton.setAttribute("id", "import-button");
document.body.appendChild(importButton);
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
    
    zoom: 9,
  }),
});
// zobrazenie mapy na začiatku otvorenia webu na použivatelovu lokalitu
navigator.geolocation.getCurrentPosition(function(position) {
  // Convert the user's location to EPSG:3857
  const center = fromLonLat([position.coords.longitude, position.coords.latitude]);
  // Center the map on the user's location
  map.getView().setCenter(center);
}, function() {
  // If location could not be determined, center the map on default location
  map.getView().setCenter(fromLonLat([48.73050802516627, 21.245309835613693]));
});


let point = null;
let line = null;
// const displaySnap = function (coordinate) {
//   const closestFeature = vectorSource.getClosestFeatureToCoordinate(coordinate);
//   const info = document.getElementById('info');
//   if (closestFeature === null) {
//     point = null;
//     line = null;
//     info.innerHTML = '&nbsp;';
//   } else {
//     const geometry = closestFeature.getGeometry();
//     const closestPoint = geometry.getClosestPoint(coordinate);
//     if (point === null) {
//       point = new Point(closestPoint);
//     } else {
//       point.setCoordinates(closestPoint);
//     }
//     const date = new Date(closestPoint[2] * 1000);
//     info.innerHTML =
//       closestFeature.get('PLT') + ' (' + date.toUTCString() + ')';
//     const coordinates = [coordinate, [closestPoint[0], closestPoint[1]]];
//     if (line === null) {
//       line = new LineString(coordinates);
//     } else {
//       line.setCoordinates(coordinates);
//     }
//   }
//   map.render();
// };


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
    const seconds = new Date(closestPoint[2] * 1000);
    const date = extractDate(reader.result); // Call extractDate function with file content
    info.innerHTML =
      closestFeature.get('PLT') + ' (' + date.toDateString()+ ')' + ' ' + seconds.toTimeString() ;
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

// Zmena štýlu kurzora pri hovering na flight tracku
const stroke = new Stroke({
  color: 'white',
  width: 1.5,
});
const style = new Style({
  stroke: stroke,
  image: new CircleStyle({
    radius: 6,
    fill: new Fill({
      color:'red'
    }),
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
// nizsie je tiež štýl kurzora ale toho ktory beha po trajektórii
const featureOverlay = new VectorLayer({
  source: new VectorSource(),
  map: map,
  style: new Style({
    image: new CircleStyle({
      radius: 6,
      fill: new Fill({
        color: 'red',
      }),
      stroke: stroke,
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

//add event listener for file input
fileInput.addEventListener("change", function(){
  const file = fileInput.files[0];
  reader.onload = function () {
    const data = reader.result;
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
  };
  
});

// NEW
function extractDate(igcFile) {
  // Date is recorded as: HFDTEddmmyy (where HFDTE is a literal and dddmmyy are digits).
  // var dateRecord = igcFile.match(/H[FO]DTE([\d]{2})([\d]{2})([\d]{2})/);
  var dateRecord = igcFile.match(/H[FO]DTE(?:DATE:)?(\d{2})(\d{2})(\d{2}),?(\d{2})?/);
  if (dateRecord === null) {
      throw new IGCException('The file does not contain a date header.');
  }

  var day = parseInt(dateRecord[1], 10);
  // Javascript numbers months from zero, not 1!
  var month = parseInt(dateRecord[2], 10) - 1;
  // The IGC specification has a built-in Millennium Bug (2-digit year).
  // I will arbitrarily assume that any year before "80" is in the 21st century.
  var year = parseInt(dateRecord[3], 10);

  if (year < 80) {
      year += 2000;
  } else {
      year += 1900;
  }
  return new Date(Date.UTC(year, month, day));
}