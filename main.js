// Note: This example requires that you consent to location sharing when
// prompted by your browser. If you see the error "The Geolocation service
// failed.", it means you probably did not give permission for the browser to
// locate you.
var map, infoWindow, directionsRenderer;
var colors = ["green", "red", "blue", "black"];
const timeoutDuration = 1000;
var sequence = [];
const points = {
	origin: {
		lat: 41.7094968,
		lng: 44.8006397
	},
	destination: {
		lat: 41.72723209999999,
		lng: 44.73565
	},
	center: { lat: 41.71776, lng: 44.773521 }
};
function initMap() {
	map = new google.maps.Map(document.getElementById("map"), {
		center: points.center,
		zoom: 14
	});
	infoWindow = new google.maps.InfoWindow();

	const originMarker = new google.maps.Marker({
		position: points.origin,
		icon: { url: "http://maps.google.com/mapfiles/ms/micons/cabs.png" },
		map
	});
	const destinationMarker = new google.maps.Marker({
		position: points.destination,
		icon: {
			url: "http://maps.google.com/mapfiles/ms/micons/homegardenbusiness.png"
		},
		map
	});

	postInit();
}

function addToSequence(callback) {
	sequence.push(callback);
}

function runSequence() {
	sequence.forEach((callback, i) =>
		setTimeout(callback, timeoutDuration * i + 1)
	);
}

async function postInit() {
	const directions = await getRoutesData();
	const pullers = await getCarPullersData();

	const pullersHandlers = pullers.map(p => handlePuller(p, "gray"));
	addToSequence(() => pullersHandlers.forEach(ph => ph.draw()));

	const routesSteps = directions.routes.map(getStepsPoints);
	routesSteps.forEach((points, i) =>
		addToSequence(() => drawRoute(points, colors[i]))
	);

	const buffers = routesSteps.map((points, i) => {
		const coordinates = points.map(latLngToCoords);
		const b = getBufferPoly(coordinates, 0.5);
		return b;
	});
	buffers.forEach((b, i) =>
		addToSequence(() => drawPoly(b.geometry, colors[i]))
	);

	const convexHull = getConvexHull(buffers);
	addToSequence(() => drawPoly(convexHull.geometry, "gray"));

	const newPullers = await getCarPullersData(convexHull.geometry);
	const newPullersIdSet = new Set(newPullers.map(({ _id }) => _id));

	addToSequence(() =>
		pullersHandlers
			.filter(ph => !newPullersIdSet.has(ph.puller._id))
			.forEach(ph => ph.hide())
	);

	const rightPullers = filterOppositePullers(newPullers);
	const rightPullersIdSet = new Set(rightPullers.map(({ _id }) => _id));

	addToSequence(() =>
		pullersHandlers
			.filter(ph => !rightPullersIdSet.has(ph.puller._id))
			.forEach(ph => ph.hide())
	);

	setTimeout(runSequence, 2000);
}

function filterOppositePullers(pullers) {
	return pullers.filter(checkRightPuller);
}

function checkRightPuller(puller) {
	const { destination, origin } = puller;
	const driversDest = latLngToPoint(points.destination);
	const driversOrig = latLngToPoint(points.origin);
	const destToDestDistance = Math.round(turf.distance(destination, driversDest));
	const origToDestDistance = Math.round(turf.distance(origin, driversDest));

	const origToOriginDistance = Math.round(turf.distance(origin, driversOrig));
	const destToOriginDistance = Math.round(turf.distance(destination, driversOrig));

	return (
		destToDestDistance <= origToDestDistance ||
		origToOriginDistance <= destToOriginDistance
	);
}

function getConvexHull(features) {
	return turf.convex(turf.featureCollection(features));
}

function getRoutesData() {
	return fetch("gmaps-fabrica-to-nutsubidze.json").then(data => data.json());
}

function getStepsPoints(route) {
	const { steps } = route.legs[0];
	const stepsPoints = steps.reduce((result, step, i) => {
		result[i] = step.start_location;
		return result;
	}, Array(steps.length + 1));
	stepsPoints[steps.length] = steps[steps.length - 1].end_location;
	return stepsPoints;
}

function handlePuller(puller, color) {
	console.log(puller);
	const points = [
		pointToLatLng(puller.origin),
		pointToLatLng(puller.destination)
	];

	console.log(points);
	const path = new google.maps.Polyline({
		strokeColor: color,
		strokeWeight: 1
	});
	path.setPath(points);
	const startMarker = new google.maps.Marker({
		position: points[0],
		icon: {
			url: "http://maps.google.com/mapfiles/ms/micons/man.png"
		},
		animation: google.maps.Animation.DROP
	});
	const finishMarker = new google.maps.Marker({
		position: points[1],
		icon: { url: "http://maps.google.com/mapfiles/ms/micons/flag.png" },
		animation: google.maps.Animation.DROP
	});

	return {
		puller,
		draw: () => {
			path.setMap(map);
			startMarker.setMap(map);
			finishMarker.setMap(map);
		},
		hide: () => {
			path.setMap(null);
			startMarker.setMap(null);
			finishMarker.setMap(null);
		}
	};
}

function drawRoute(points, color) {
	const path = new google.maps.Polyline({
		strokeColor: color
	});
	path.setPath(points);
	path.setMap(map);
}

function drawPoly(poly, color) {
	const coords = poly.coordinates[0].map(coordsToLatLng);
	const p = new google.maps.Polygon({
		paths: coords,
		strokeColor: color,
		strokeOpacity: 0.8,
		strokeWeight: 2,
		fillColor: color,
		fillOpacity: 0.35
	});
	p.setMap(map);
}

function latLngToCoords({ lat, lng }) {
	return [lat, lng];
}
function coordsToLatLng([lat, lng]) {
	return { lat, lng };
}

function pointToLatLng({ coordinates }) {
	return coordsToLatLng(coordinates);
}

function latLngToPoint(latLng) {
	return {
		type: "Point",
		coordinates: latLngToCoords(latLng)
	};
}

function getBufferPoly(coordinates, radius) {
	const line = { type: "LineString", coordinates };
	return turf.buffer(line, radius);
}

function getCarPullersData(polygon) {
	return getCarPullersReq(polygon).then(res => res.json());
}

function getCarPullersReq(polygon) {
	if (polygon) {
		return fetch("http://localhost/public/test/geo", {
			method: "POST",
			body: JSON.stringify({ polygon: polygon }),
			headers: { "Content-Type": "application/json" }
		});
	} else {
		return fetch("http://localhost/public/test/geo", {
			method: "POST",
			headers: { "Content-Type": "application/json" }
		});
	}
}
