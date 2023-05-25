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

var parsedFlight;


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
      //color: 'rgb(230, 108, 32)', 
      color: getRandomColor(),
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
//fileInput.setAttribute("multiple", ""); // Add this line to accept multiple files

//add event listener to the button
var importButton = document.getElementById("import-button");
importButton.addEventListener("click", function () {
  fileInput.click();
});



//single file input
fileInput.addEventListener("change", function () {
  time.start = Infinity;
  time.stop = -Infinity;
  time.duration = 0;
  const files = fileInput.files;
  if (files.length === 1) {  // ak tahame iba po jednom subory
    const file = files[0];
    reader.onload = function () {
      const data = reader.result;
      parsedFlight = parseIGC(data);
      calculateSpeed(parsedFlight);
      lastStep = 0;
      lastTimestamp = null;
      speed = 10; 
      console.log(parsedFlight);
      const features = igcFormat.readFeatures(data, {
        featureProjection: 'EPSG:3857',
      });
      vectorSource.addFeatures(features);
      renderAltitudeGraph(parsedFlight);
      features.forEach(function (feature) {
        const pilotName = feature.get('PLT');
        const gliderName = feature.get('GTY');
        const kilometers = calculateTotalDistance(parsedFlight);
        const startTime = feature.getGeometry().getFirstCoordinate()[2];
        const stopTime = feature.getGeometry().getLastCoordinate()[2];
        const durationSeconds = stopTime - startTime;
        const durationHours = Math.floor(durationSeconds / 3600);
        const durationMinutes = Math.floor((durationSeconds % 3600) / 60);
        const durationString = durationHours.toString().padStart(2, '0') + ':' + durationMinutes.toString().padStart(2, '0') + ':' + (durationSeconds % 60).toString().padStart(2, '0');

        var altitudeIndex = 0;
        const pilotNameDisplay = document.getElementById('pilot-name-display');
        pilotNameDisplay.innerHTML = 'Pilot: ' + feature.get('PLT');
        const altitudeDisplay = document.getElementById('altitude-display');
        altitudeDisplay.innerHTML = "Nadmorská výška: " + parsedFlight.gpsAltitude[altitudeIndex] + " m";

        const table = document.getElementById("flight-table");
        const row = table.insertRow();
        const pilotCell = row.insertCell(0);
        const gliderCell = row.insertCell(1);
        const durationCell = row.insertCell(2);
        const kilometerCell = row.insertCell(3);
        pilotCell.innerHTML = pilotName;
        gliderCell.innerHTML = gliderName;
        durationCell.innerHTML = durationString;
        kilometerCell.innerHTML = kilometers.toFixed(2);
      });
    };
    reader.readAsText(file);
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


// info pod mapou
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
    const imgSrc = '/assets/pilot_icon.png'; // Replace with the actual path to the image
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
// Global variables
let isPlaying = false;
let lastStep = 0;
let lastTimestamp = null;
let animationFrameId;

// Event listener for playButton
playButton.addEventListener("click", function () {
  isPlaying = !isPlaying;
  playButton.textContent = isPlaying ? "Pause Animation" : "Play Animation";

  if (isPlaying) {
    lastTimestamp = performance.now();  // Ensure lastTimestamp is current when we start
    animate(lastTimestamp);
  } else {
    // Save lastStep as the total elapsed time when we pause
    lastStep += (performance.now() - lastTimestamp) / 1000 * speed;
    cancelAnimationFrame(animationFrameId);
  }
});
// Global animation speed
let speed = 10;

// Slower and faster buttons
const slowerButton = document.getElementById('slower-button');
const fasterButton = document.getElementById('faster-button');

slowerButton.addEventListener('click', function () {
  // Decrease speed to slow down the animation
  speed /= 2;
});

fasterButton.addEventListener('click', function () {
  // Increase speed to speed up the animation
  speed *= 2;
});

// Updated animate function
function animate(timestamp) {
   // Convert to seconds and multiply by speed
  const altitudeDisplay = document.getElementById('altitude-display');
  const horizontalSpeedDisplay = document.getElementById('horizontal-speed-display');
  const verticalSpeedDisplay = document.getElementById('vertical-speed-display');

  const animateStep = function () {
    const elapsed = lastStep + ((timestamp - lastTimestamp) / 1000) * speed;
    const progress = Math.min(elapsed / time.duration, 1);
    console.log(elapsed,time.duration);
    const speedIndex = Math.floor(parsedFlight.horizontalSpeeds.length * progress);


    control.value = progress * 100;
    const m = time.start + time.duration * progress;

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
      const altitudeIndex = Math.floor(parsedFlight.gpsAltitude.length * progress);
      const altitude = parsedFlight.gpsAltitude[altitudeIndex];
      const horizontalSpeed = parsedFlight.horizontalSpeeds[speedIndex];
      const verticalSpeed = parsedFlight.verticalSpeeds[speedIndex];
      const seconds = new Date(coordinate[2] * 1000);
      const date = extractDate(reader.result);
      const info = document.getElementById("info");
      info.innerHTML = feature.get("PLT") + " (" + date.toDateString() + ") " + seconds.toTimeString();

      // Update the altitude display
      
      altitudeDisplay.innerHTML = "Nadmorská výška: " + altitude + " m";

      if (horizontalSpeed) {
        console.log(speedIndex,progress,lastStep,elapsed)
        horizontalSpeedDisplay.innerHTML = "Horizontal Speed: " + horizontalSpeed.toFixed(2) + " km/h";
      } else {
        console.log(speedIndex,progress,lastStep,elapsed)
        horizontalSpeedDisplay.innerHTML = "Horizontal Speed: -- km/h";
      }

      if (verticalSpeed) {
        verticalSpeedDisplay.innerHTML = "Vertical Speed: " + verticalSpeed.toFixed(2) + " km/h";
      } else {
        verticalSpeedDisplay.innerHTML = "Vertical Speed: 0.00 km/h";
      }


    });

    if (progress < 1) {
      lastStep = elapsed;
      lastTimestamp = timestamp; // Update lastTimestamp only if animation is in progress
      animationFrameId = requestAnimationFrame(animate);
    } else {
      lastStep = 0;
      isPlaying = false;
      playButton.textContent = "Play Animation";
    }
  };

  animateStep();
}

function toTimeString(totalSeconds) { // funkcia na premenu sekund na normalny format casu
  const totalMs = totalSeconds * 1000;
  const result = new Date(totalMs).toISOString().slice(11, 19);

  return result;
}
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




// zly format suboru
function IGCException(message) {
  'use strict';

  this.message = message;
  this.name = "IGCException";
}

function parseIGC(igcFile) {
  'use strict';


  function parseManufacturer(aRecord) {
    var manufacturers = {
      'GCS': 'Garrecht',
      'CAM': 'Cambridge Aero Instruments',
      'DSX': 'Data Swan',
      'EWA': 'EW Avionics',
      'FIL': 'Filser',
      'FLA': 'FLARM',
      'SCH': 'Scheffel',
      'ACT': 'Aircotec',
      'NKL': 'Nielsen Kellerman',
      'LXN': 'LX Navigation',
      'IMI': 'IMI Gliding Equipment',
      'NTE': 'New Technologies s.r.l.',
      'PES': 'Peschges',
      'PRT': 'Print Technik',
      'SDI': 'Streamline Data Instruments',
      'TRI': 'Triadis Engineering GmbH',
      'LXV': 'LXNAV d.o.o.',
      'WES': 'Westerboer',
      'XCS': 'XCSoar',
      'ZAN': 'Zander'
    };

    var manufacturerInfo = {
      manufacturer: 'Unknown',
      serial: aRecord.substring(4, 7)
    };

    var manufacturerCode = aRecord.substring(1, 4);
    if (manufacturers[manufacturerCode]) {
      manufacturerInfo.manufacturer = manufacturers[manufacturerCode];
    }

    return manufacturerInfo;
  }

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

  function parseHeader(headerRecord) {
    var headerSubtypes = {
      'PLT': 'Pilot',
      'CM2': 'Crew member 2',
      'GTY': 'Glider type',
      'GID': 'Glider ID',
      'DTM': 'GPS Datum',
      'RFW': 'Firmware version',
      'RHW': 'Hardware version',
      'FTY': 'Flight recorder type',
      'GPS': 'GPS',
      'PRS': 'Pressure sensor',
      'FRS': 'Security suspect, use validation program',
      'CID': 'Competition ID',
      'CCL': 'Competition class'
    };

    var headerName = headerSubtypes[headerRecord.substring(2, 5)];
    if (headerName !== undefined) {
      var colonIndex = headerRecord.indexOf(':');
      if (colonIndex !== -1) {
        var headerValue = headerRecord.substring(colonIndex + 1);
        if (headerValue.length > 0 && /([^\s]+)/.test(headerValue)) {
          return {
            name: headerName,
            value: headerValue
          };
        }
      }
    }
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

  function parsePosition(positionRecord, model, flightDate) {
    var positionRegex = /^B([\d]{2})([\d]{2})([\d]{2})([\d]{7}[NS][\d]{8}[EW])([AV])([-\d][\d]{4})([-\d][\d]{4})/;
    var positionMatch = positionRecord.match(positionRegex);
    if (positionMatch) {

      var positionTime = new Date(flightDate.getTime());
      positionTime.setUTCHours(parseInt(positionMatch[1], 10), parseInt(positionMatch[2], 10), parseInt(positionMatch[3], 10));

      if (model.recordTime.length > 0 &&
        model.recordTime[0] > positionTime) {
        positionTime.setDate(flightDate.getDate() + 1);
      }
      var curPosition = parseLatLong(positionMatch[4]);
      if ((curPosition[0] !== 0) && (curPosition[1] !== 0)) {
        return {
          recordTime: positionTime,
          latLong: curPosition,
          pressureAltitude: parseInt(positionMatch[6], 10),
          gpsAltitude: parseInt(positionMatch[7], 10)
        };
      }
    }
  }

  var invalidFileMessage = 'This is not IGC file';
  var igcLines = igcFile.split('\n');
  if (igcLines.length < 2) {
    throw new IGCException(invalidFileMessage);
  }


  var model = {
    headers: [],
    recordTime: [],
    latLong: [],
    pressureAltitude: [],
    gpsAltitude: [],
    taskpoints: []
  };

  if (!(/^A[\w]{6}/).test(igcLines[0])) {
    throw new IGCException(invalidFileMessage);
  }

  var manufacturerInfo = parseManufacturer(igcLines[0]);
  model.headers.push({
    name: 'Logger manufacturer',
    value: manufacturerInfo.manufacturer
  });

  model.headers.push({
    name: 'Logger serial number',
    value: manufacturerInfo.serial
  });

  var flightDate = extractDate(igcFile);
  var lineIndex;
  var positionData;
  var recordType;
  var currentLine;
  var headerData;

  for (lineIndex = 0; lineIndex < igcLines.length; lineIndex++) {
    currentLine = igcLines[lineIndex];
    recordType = currentLine.charAt(0);
    switch (recordType) {
      case 'B': // Position fix
        positionData = parsePosition(currentLine, model, flightDate);
        if (positionData) {
          model.recordTime.push(positionData.recordTime);
          model.latLong.push(positionData.latLong);
          model.pressureAltitude.push(positionData.pressureAltitude);
          model.gpsAltitude.push(positionData.gpsAltitude);
        }
        break;

      case 'C':
        var taskRegex = /^C[\d]{7}[NS][\d]{8}[EW].*/;
        if (taskRegex.test(currentLine)) {
          model.taskpoints.push(currentLine.substring(1).trim());
        }
        break;

      case 'H':
        headerData = parseHeader(currentLine);
        if (headerData) {
          model.headers.push(headerData);
        }
        break;
    }
  }
  return model;

}




function calculateTotalDistance(parsedFlight) {
  let totalDistance = 0;  // in km
  let R = 6371;  // Earth's radius in km

  for (let i = 1; i < parsedFlight.latLong.length; i++) {
    let lat1 = parsedFlight.latLong[i - 1][0];
    let lon1 = parsedFlight.latLong[i - 1][1];
    let lat2 = parsedFlight.latLong[i][0];
    let lon2 = parsedFlight.latLong[i][1];

    let dLat = deg2rad(lat2 - lat1);
    let dLon = deg2rad(lon2 - lon1);
    let a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    let distance = R * c;  // distance in km
    totalDistance += distance;
  }

  return totalDistance;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}
// graf
let altitudeChart;

function renderAltitudeGraph(parsedFlight) {
  const altitudeCanvas = document.getElementById('altitudeGraph');
  altitudeCanvas.style.backgroundColor = '#29323c';

  const altitudeData = parsedFlight.gpsAltitude;
  const timeData = parsedFlight.recordTime.map(time => `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}`);

  const newDataSet = {
    label: 'Nadmorská výška',
    data: altitudeData,
    borderColor: 'rgb(230, 108, 32)', // Orange
    backgroundColor: 'rgba(230, 108, 32, 0.1)', // Orange with transparency
    borderWidth: 0.1,
  };

  if (altitudeChart) {
    altitudeChart.data.labels = timeData;
    altitudeChart.data.datasets = [newDataSet]; // Replace the datasets instead of pushing
    altitudeChart.update();
  } else {
    altitudeChart = new Chart(altitudeCanvas, {
      type: 'line',
      data: {
        labels: timeData,
        datasets: [newDataSet],
      },
      options: {
        responsive: true,
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Čas',
            },
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Nadmorská výška (m)',
            },
          },
        },
      },
    });
  }
}


function parseTime(timeString) {
  var hours = parseInt(timeString.substring(0, 2), 10);
  var minutes = parseInt(timeString.substring(2, 4), 10);
  var seconds = parseInt(timeString.substring(4, 6), 10);
  return (hours * 3600) + (minutes * 60) + seconds;
}

function calculateSpeed(model) {
  model.horizontalSpeeds = [];
  model.verticalSpeeds = [];
  var earthRadius = 6371;  // Radius of the Earth in kilometers

  for (var i = 1; i < model.recordTime.length; i++) {
    var prevLatLong = model.latLong[i - 1];
    var currLatLong = model.latLong[i];

    // Use Haversine formula to calculate the distance between two points on the sphere
    var dLat = (currLatLong[0] - prevLatLong[0]) * Math.PI / 180;
    var dLon = (currLatLong[1] - prevLatLong[1]) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(prevLatLong[0] * Math.PI / 180) * Math.cos(currLatLong[0] * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var distance = earthRadius * c;  // Distance in kilometers

    var deltaTime = (model.recordTime[i] - model.recordTime[i - 1]) / 1000;  // Time difference in seconds
    var horizontalSpeed = distance / deltaTime * 3600;  // Speed in km/h

    var prevAltitude = model.pressureAltitude[i - 1];
    var currAltitude = model.pressureAltitude[i];
    var verticalSpeed = (currAltitude - prevAltitude) / deltaTime * 3.6;  // Speed in km/h

    model.horizontalSpeeds.push(horizontalSpeed);
    model.verticalSpeeds.push(verticalSpeed);
  }
}
