// Initialize the Cesium Viewer
const viewer = new Cesium.Viewer("cesiumContainer");

// Create a function to handle the file input change event
function handleFileInputChange(event) {
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = function() {
    const igcData = reader.result;
    const parsedData = parseIgcData(igcData);
    const track = createCesiumTrack(parsedData);
    viewer.entities.add(track);
    viewer.zoomTo(track);
  };
  reader.readAsText(file);
}

// Add an event listener to the file input
const fileInput = document.getElementById("fileInput");
fileInput.addEventListener("change", handleFileInputChange);

// Parse the IGC file data
function parseIgcData(igcData) {
  const lines = igcData.split("\n");
  const parsedData = {
    fixes: []
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("B")) {
      const fix = parseIgcFix(line);
      parsedData.fixes.push(fix);
    }
  }
  return parsedData;
}

// Parse a single IGC fix
function parseIgcFix(line) {
  const parts = line.split(",");
  const time = new Date(Date.UTC(
    parseInt("20" + parts[0].substring(4, 6)),
    parseInt(parts[0].substring(2, 4)) - 1,
    parseInt(parts[0].substring(0, 2)),
    parseInt(parts[1].substring(0, 2)),
    parseInt(parts[1].substring(2, 4)),
    parseInt(parts[1].substring(4, 6))
  ));
  const lat = parseIgcLat(parts[7], parts[8]);
  const lon = parseIgcLon(parts[5], parts[6]);
  const gpsAltitude = parseInt(parts[8]);
  const fix = {
    time: time,
    latitude: lat,
    longitude: lon,
    gpsAltitude: gpsAltitude
  };
  return fix;
}

// Parse the latitude from an IGC fix
function parseIgcLat(latStr, nsIndicator) {
  const lat = parseFloat(latStr.substring(0, 2)) +
    parseFloat(latStr.substring(2)) / 60000.0;
  if (nsIndicator === "S") {
    return -lat;
  } else {
    return lat;
  }
}

// Parse the longitude from an IGC fix
function parseIgcLon(lonStr, ewIndicator) {
  const lon = parseFloat(lonStr.substring(0, 3)) +
    parseFloat(lonStr.substring(3)) / 60000.0;
  if (ewIndicator === "W") {
    return -lon;
  } else {
    return lon;
  }
}

// Create a Cesium Entity to represent the track
function createCesiumTrack(parsedData) {
  const positions = Cesium.Cartesian3.fromDegreesArrayHeights(parsedData.fixes.map(fix => [
    fix.longitude,
    fix.latitude,
    fix.gpsAltitude
  ]).flat());
  const track = new Cesium.Entity({
    polyline: {
      positions: positions,
      width: 5,
      material: Cesium.Color.RED
    }
  });
  return track;
}
