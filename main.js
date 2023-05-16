import Feature from 'ol/Feature';
import IGC from 'ol/format/IGC';
import Map from 'ol/Map';
import OSM, { ATTRIBUTION } from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import View from 'ol/View';
import { Circle as CircleStyle, Fill, Stroke, Style, Icon } from 'ol/style';
import { LineString, Point } from 'ol/geom';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { getVectorContext } from 'ol/render';
import { fromLonLat } from 'ol/proj';


const colors = {
  'Marek Kováč': 'rgba(0, 0, 255, 0.7)',
  'Ryland Jordan': 'rgba(254, 0, 0, 0.8)',
};

const styleCache = {};

const styleFunction = function (feature) {
  const pilotName = feature.get('PLT');
  let styles = styleCache[pilotName];

  if (!styles) {
    const color = 'black';
    // Or a random color function
    const stroke1 = new Stroke({
      color: color,
      width: 4,
    });

    const stroke2 = new Stroke({
      color: 'rgb(230, 108, 32)', // White with 50% transparency
      width: 2,
    });

    styles = [
      new Style({
        stroke: stroke1,
      }),
      new Style({
        stroke: stroke2,
      }),
    ];

    styleCache[pilotName] = styles;
  }

  return styles;
};
// funkcia trás random color
function getRandomColor() {
  const min = 64;
  const max = 255;
  const r = Math.floor(Math.random() * (max - min + 1) + min);
  const g = Math.floor(Math.random() * (max - min + 1) + min);
  const b = Math.floor(Math.random() * (max - min + 1) + min);
  return `rgb(${r},${g},${b})`;
}

const vectorSource = new VectorSource();

let reader = new FileReader();

//tlacidlo na vlozenie
const fileInput = document.createElement("input");
fileInput.setAttribute("type", "file");
fileInput.setAttribute("multiple", ""); // Add this line to accept multiple files


//add event listener to the button
var importButton = document.getElementById("import-button");
importButton.addEventListener("click", function () {
  fileInput.click();
});

// Define the processFiles function
function processFiles(files) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileReader = new FileReader();

    fileReader.onload = function () {
      const data = fileReader.result;
      const features = igcFormat.readFeatures(data, {
        featureProjection: 'EPSG:3857',
      });
      vectorSource.addFeatures(features);

      features.forEach(function (feature) {
        const pilotName = feature.get('PLT');
        const gliderName = feature.get('GTY');
        const startTime = feature.getGeometry().getFirstCoordinate()[2];
        const stopTime = feature.getGeometry().getLastCoordinate()[2];
        const durationSeconds = stopTime - startTime;
        const durationHours = Math.floor(durationSeconds / 3600);
        const durationMinutes = Math.floor((durationSeconds % 3600) / 60);
        const durationString = durationHours.toString().padStart(2, '0') + ':' + durationMinutes.toString().padStart(2, '0') + ':' + (durationSeconds % 60).toString().padStart(2, '0');

        const table = document.getElementById("flight-table");
        const row = table.insertRow();
        const pilotCell = row.insertCell(0);
        const gliderCell = row.insertCell(1);
        const durationCell = row.insertCell(2);
        pilotCell.innerHTML = pilotName;
        gliderCell.innerHTML = gliderName;
        durationCell.innerHTML = durationString;
      });
    };

    fileReader.readAsText(file);
  }
}

// Add event listener for file input
fileInput.addEventListener("change", function () {
  const files = fileInput.files;

  if (files.length === 1) {
    const file = files[0];
    reader.onload = function () {
      const data = reader.result;
      const features = igcFormat.readFeatures(data, {
        featureProjection: 'EPSG:3857',
      });
      vectorSource.addFeatures(features);

      features.forEach(function (feature) {
        const pilotName = feature.get('PLT');
        const gliderName = feature.get('GTY');
        const startTime = feature.getGeometry().getFirstCoordinate()[2];
        const stopTime = feature.getGeometry().getLastCoordinate()[2];
        const durationSeconds = stopTime - startTime;
        const durationHours = Math.floor(durationSeconds / 3600);
        const durationMinutes = Math.floor((durationSeconds % 3600) / 60);
        const durationString = durationHours.toString().padStart(2, '0') + ':' + durationMinutes.toString().padStart(2, '0') + ':' + (durationSeconds % 60).toString().padStart(2, '0');

        const table = document.getElementById("flight-table");
        const row = table.insertRow();
        const pilotCell = row.insertCell(0);
        const gliderCell = row.insertCell(1);
        const durationCell = row.insertCell(2);
        pilotCell.innerHTML = pilotName;
        gliderCell.innerHTML = gliderName;
        durationCell.innerHTML = durationString;
      });
    };
    reader.readAsText(file);
  } else {
    processFiles(files);
  }
});



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
          'https://tile.thunderforest.com/outdoors/{z}/{x}/{y}.png' +
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
// zobrazenie mapy na začiatku otvorenia webu na použivatelovu lokalitu
navigator.geolocation.getCurrentPosition(function (position) {
  // Convert the user's location to EPSG:3857
  const center = fromLonLat([position.coords.longitude, position.coords.latitude]);
  // Center the map on the user's location
  map.getView().setCenter(center);
}, function () {
  // If location could not be determined, center the map on default location
  map.getView().setCenter(fromLonLat([21.245309835613693, 48.73050802516627]));
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
    const seconds = new Date(closestPoint[2] * 1000);
    const date = extractDate(reader.result); // Call extractDate function with file content
    const imgSrc = './img/pilot_icon.png'; // Replace with the actual path to the image
    info.innerHTML =
      '<img src="' + imgSrc + '" alt="Image1" style="vertical-align: middle; width: 30px; height: 30px;"> ' +
      closestFeature.get('PLT') + ' (' + date.toDateString() + ')' + ' ' + seconds.toTimeString();

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
      color: 'red'
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
    image: new Icon({
      anchor: [0.5, 0.5],
      anchorXUnits: 'fraction',
      anchorYUnits: 'fraction',
      opacity: 1,
      src: '/assets/glider.png' // replace this with the path to your icon image
    }),
  }),
});


// animácia letu
const control = document.getElementById('time');
control.addEventListener('input', function () {
  const value = parseInt(control.value, 10) / 100;
  const m = time.start + time.duration * value;
  vectorSource.forEachFeature(function (feature) {
    const geometry = feature.getGeometry();
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
//tlačidlo na automatickú animáciu letu
const playButton = document.getElementById("play-button");
let isPlaying = false;
let start;
let lastStep = 0;
let animationFrameId;

playButton.addEventListener("click", function () {
  if (!isPlaying) {
    playButton.textContent = "Pause Animation";
    isPlaying = true;
    start = performance.now() - lastStep;
    animate();
  } else {
    playButton.textContent = "Play Animation";
    isPlaying = false;
    lastStep = performance.now() - start;
    cancelAnimationFrame(animationFrameId);
  }
});

function animate() {
  const numSteps = 100;
  const step = time.duration / numSteps;
  let i = 0;
  const animateStep = function (timestamp) {
    const progress = Math.min((timestamp - start) / (step * 1000), 1);
    control.value = progress * 100;
    const m = time.start + time.duration * progress;
    vectorSource.forEachFeature(function (feature) {
      const geometry = feature.getGeometry();
      const coordinate = geometry.getCoordinateAtM(m, true);
      let highlight = feature.get("highlight");
      if (highlight === undefined) {
        highlight = new Feature(new Point(coordinate));
        feature.set("highlight", highlight);
        featureOverlay.getSource().addFeature(highlight);
      } else {
        highlight.getGeometry().setCoordinates(coordinate);
      }
      const seconds = new Date(coordinate[2] * 1000);
      const date = extractDate(reader.result);
      const info = document.getElementById("info");
      info.innerHTML = feature.get("PLT") + " (" + date.toDateString() + ") " + seconds.toTimeString();
    });
    if (i % Math.floor(numSteps / 100) === 0 || progress === 1) {
      map.render();
    }
    i++;
    if (progress < 1 && isPlaying) {
      animationFrameId = requestAnimationFrame(animateStep);
    } else {
      lastStep = performance.now() - start;
      isPlaying = false;
    }
  };
  animationFrameId = requestAnimationFrame(animateStep);
}
// text pod mapou co pise informacie o lete... 
function toTimeString(totalSeconds) { // funkcia na premenu sekund na normalny format casu
  const totalMs = totalSeconds * 1000;
  const result = new Date(totalMs).toISOString().slice(11, 19);

  return result;
}
// NIZSIE JE ZAS KOD PRE TABULKU VYPIS
//add event listener for file input
//add event listener for file input
function extractDate(igcFile) {

  var dateRecord = igcFile.match(/H[FO]DTE(?:DATE:)?(\d{2})(\d{2})(\d{2}),?(\d{2})?/);
  if (dateRecord === null) {
    throw new IGCException('The file does not contain a date header.');
  }

  var day = parseInt(dateRecord[1], 10);
  var month = parseInt(dateRecord[2], 10) - 1;

  var year = parseInt(dateRecord[3], 10);

  if (year < 80) {
    year += 2000;
  } else {
    year += 1900;
  }
  return new Date(Date.UTC(year, month, day));
}
function parseLatLong(latLongString) {
  var latitude = parseFloat(latLongString.substring(0, 2)) +
    parseFloat(latLongString.substring(2, 7)) / 60000.0;
  if (latLongString.charAt(7) === 'S') {
    latitude = -latitude;
  }

  var longitude = parseFloat(latLongString.substring(8, 11)) +
    parseFloat(latLongString.substring(11, 16)) / 60000.0;
  if (latLongString.charAt(16) === 'W') {
    longitude = -longitude;
  }

  return [latitude, longitude];
}

//NAVBAR
const hamburger = document.querySelector('.header .nav-bar .nav-list .hamburger');
const mobile_menu = document.querySelector('.header .nav-bar .nav-list ul');
const menu_item = document.querySelectorAll('.header .nav-bar .nav-list ul li a');


hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('active');
  mobile_menu.classList.toggle('active');
});



menu_item.forEach((item) => {
  item.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    mobile_menu.classList.toggle('active');
  });
});

function findCanvas(element) {
  if (element.tagName === 'CANVAS') {
    return element;
  }

  for (let i = 0; i < element.children.length; i++) {
    const canvas = findCanvas(element.children[i]);
    if (canvas) {
      return canvas;
    }
  }

  return null;
}

function saveMapAsImage() {
  map.once('rendercomplete', function (event) {
    const canvas = findCanvas(map.getViewport());

    if (canvas && canvas.toDataURL) {
      const dataURL = canvas.toDataURL();
      if (navigator.msSaveBlob) {
        // For IE and Edge
        navigator.msSaveBlob(canvas.msToBlob(), 'map.png');
      } else {
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = 'map.png';
        link.click();
      }
    }
  });

  // Trigger rendercomplete event by calling renderSync
  map.renderSync();
}

// event listener na savemap
document.getElementById('savemap').addEventListener('click', saveMapAsImage);


// jazyk
let currentLang = 'sk'; // Default language

switchLanguage(currentLang);
document.getElementById('language-switcher_en').addEventListener('click', function () {
  switchLanguage('en');
});

document.getElementById('language-switcher_sk').addEventListener('click', function () {
  switchLanguage('sk');
});

function switchLanguage(lang) {
  let elements = document.querySelectorAll('[data-lang]');
  elements.forEach(function (element) {
    if (element.getAttribute('data-lang') == lang) {
      element.style.display = 'inline';
    } else {
      element.style.display = 'none';
    }
  });

  // Switch the href for the about link
  let aboutLink = document.getElementById('about-link');
  aboutLink.href = aboutLink.getAttribute('data-lang-href-' + lang);

  currentLang = lang; // Update the current language
}










