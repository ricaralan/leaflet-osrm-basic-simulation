(function() {
	var defaultAutoIcon = L.icon({
		iconUrl:	'img/truck3.png',
		iconSize:     [40, 45], // size of the icon
		shadowSize:   [50, 64], // size of the shadow
		iconAnchor:   [20, 45], // point of the icon which will correspond to marker's location
		shadowAnchor: [4, 62],  // the same for the shadow
		popupAnchor:  [-3, -76]
	});

	Math.randomBetween = function(n1, n2) {
		return Math.floor(Math.random() * n2) + n1;
	};

	var RouteUtils = (function() {

		var _earthRadiusKM 	= 6371;
		var __map__ 		= null;
		var __config__		= {
			hostnameAPI:		'http://router.project-osrm.org/',
			version: 			'v1',
			services: {
				ROUTE:			'route',
				NEAREST:		'nearest',
				TABLE:			'table',
				MATCH:			'match',
				TRIP:			'trip',
				TILE:			'tile',
			},
			profile: {
				CAR:			'driving',
				BIKE:			'bike',
				FOOT:			'foot',
			},
			coordinates: {
				ORIGIN:		 {
					lat: 19.43529175459673,
					lng: -99.14139211177827
				},
				DESTINATION: {
					lat: 19.389331643006127,
					lng: -99.03840065002443
				}
			},
			steps:				true,
			geometries:			'geojson',
			overview:			false
		};

		return {
			getRandomInRange:					_getRandomInRange,
			generateRandomBetweenCoordinates:	_generateRandomBetweenCoordinates,
			getTripUrl:							_getTripUrl,
			getRandomClients:					_getRandomClients,
			getRandomDeliveryCars:				_getRandomDeliveryCars,
			getDistanceBetweenLatLng:			_getDistanceBetweenLatLng,
			sortClientsByLatLng:				_sortClientsByLatLng,
			callRouteService:					_callRouteService,
			callTripService:					_callTripService
		};

		function _getRandomInRange(from, to, fixed) {
			return (Math.random() * (to - from) + from).toFixed(fixed) * 1;
		}

		function _generateRandomBetweenCoordinates(lat1, lat2, lng1, lng2) {
			return {
				lat:	RouteUtils.getRandomInRange(lat1, lat2, 15),
				lng:	RouteUtils.getRandomInRange(lng1, lng2, 15)
			};
		}

		/**
		*	@param coordinates Array[Array]
		*	[[lat, lng], [lat, lng], ...]
		*/
		function _getTripUrl(coordinates, serviceType) {
			if(coordinates instanceof Array && coordinates.length) {
				return __config__.hostnameAPI
						.concat(serviceType, '/',
						__config__.version, '/',
						__config__.profile.CAR, '/',
						coordinates.join(';'),
						'?steps=', __config__.steps,
						'&geometries=', __config__.geometries,
						'&overview=', __config__.overview);
			} else {
				throw new Error('Invalid coordinates');
			}
		}

		function _getRandomClients(numberClients, map) {
			return new Promise(function(resolve, reject) {
				var clients = [];
				for(var i = 0; i < numberClients; i++) {
					clients.push(
						new Client(map, i).setCoordinates(_generateRandomBetweenCoordinates(
							// Default values CDMX
							19.268044846623148,
							19.536495698592987,
							-99.00192260742189,
							-99.26696777343751
						))
					);
				}

				resolve(clients);
			});
		}

		function _getRandomDeliveryCars(numberCars, map) {
			return new Promise(function(resolve, reject) {
				var cars = [];
				for(var i = 0; i < numberCars; i++) {
					cars.push(
						new DeliveryCar(_generateRandomBetweenCoordinates(
							// Default values CDMX
							19.268044846623148,
							19.536495698592987,
							-99.00192260742189,
							-99.26696777343751
						), map, i)
					);
				}

				resolve(cars);
			});
		}

		function _getDistanceBetweenLatLng(latLng1, latLng2) {
			var dLat = _deg2rad(latLng2.lat - latLng1.lat);
			var dLon = _deg2rad(latLng2.lng - latLng1.lng);
			var a = 
				Math.sin(dLat/2) * Math.sin(dLat/2) +
				Math.cos(_deg2rad(latLng1.lat)) * Math.cos(_deg2rad(latLng2.lat)) * 
				Math.sin(dLon/2) * Math.sin(dLon/2); 

			var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
			var d = _earthRadiusKM * c; // Distance in km

			return d;
		}

		function _deg2rad(deg) { return deg * (Math.PI/180); }

		function _sortClientsByLatLng(latlng, clients, firstIndex, lastIndex) {
			var i		= firstIndex;
			var j		= lastIndex;
			var pivot	= clients[Math.round(lastIndex / 2)];

			while(i <= j) {
				while(
					_getDistanceBetweenLatLng(latlng, clients[i].getCoordinates()) <
					_getDistanceBetweenLatLng(latlng, pivot.getCoordinates())
					) { i++; }

				while(
					_getDistanceBetweenLatLng(latlng, clients[j].getCoordinates()) >
					_getDistanceBetweenLatLng(latlng, pivot.getCoordinates())
					) { j--; }

				if(i < j) {
					var aux = clients[i];
					clients[i] = clients[j];
					clients[j] = aux;
				}
				i++;
				j--;
			}

			if(firstIndex < j) {
				_sortClientsByLatLng(latlng, clients, firstIndex, j);
			}

			if(i < lastIndex) {
				_sortClientsByLatLng(latlng, clients, i, lastIndex);
			}
		}

		function _callTripService(coordinates) {
			return new Promise(function(resolve, reject) {
				$.ajax({
					url:		_getTripUrl(coordinates, __config__.services.TRIP),
					success:	resolve,
					error:		reject
				});
			});
		}

		function _callRouteService(coordinates) {
			return new Promise(function(resolve, reject) {
				$.ajax({
					url:		_getTripUrl(coordinates, __config__.services.ROUTE),
					success:	resolve,
					error:		reject
				});
			});
		}
	})();

	var Client = (function() {

		function Client(map, id) {
			var self = this;
			var __id__ = id;
			var __coordinates__ = null;
			var __marker__ = null;
			self.packageDelivered = false;

			self.setCoordinates = function(coordinates) {
				__coordinates__ = coordinates;

				return self;
			};

			self.getCoordinates = function() {
				return Object.freeze(__coordinates__);
			};

			self.getArrayCoordinates = function() {
				return [__coordinates__.lng, __coordinates__.lat];
			};

			self.generateRandomBetweenCoordinates = function(lat1, lat2, lng1, lng2) {
				__coordinates__ = {
					lat:	RouteUtils.getRandomInRange(lat1, lat2, 15),
					lng:	RouteUtils.getRandomInRange(lng1, lng2, 15)
				};

				self.coordinates = __coordinates__;

				return self;
			};

			self.getMarker = function() {
				return __marker__;
			};

			self.getId = function() {
				return __id__;
			};

			self.printLocation = function() {
				if(__coordinates__) {
					__marker__ = L.marker(__coordinates__)
						.bindPopup(__coordinates__.lat + ',' + __coordinates__.lng)
						.addTo(map);
				} else {
					throw new Error('Client without coordinates');
				}

				return self;
			};

		}

		return Client;
	})();

	var DeliveryCar = (function(){
		
		function DeliveryCar(latlng, map, clientId) {

			if(!latlng || !(latlng instanceof Object)) {
				throw new Error('DeliveryCar can\'t working without a valid latlng ');
			}

			var self				= this;
			var __clients__			= [];
			var __currentLeg__		= null;
			var __waypoints__		= null;
			var __trips__			= null;
			var __marker__			= null;
			var __polyline__		= null;
			var __options__			= {
				latlng:					latlng,
				coordinates:			[],
				coordinatesRouteCar:	[],
				map:					map,
				indexCurrentTrip:		0,
				clientId: 				clientId,
				distanceRecorred: 		0
			};

			function getRandomRGB() {
				return String('rgb(').concat(Math.randomBetween(0,100),',',Math.randomBetween(0,255),',',Math.randomBetween(0,255),')');
			};

			function _getObjectCoordinates(coordinates) {
					for(var i = 0; i < coordinates.length; i++) {
					coordinates[i] = {
						lat: coordinates[i][1],
						lng: coordinates[i][0]
					};
				}

				return coordinates;
			}

			function _getClientsArrayCoordinates(start, end) {
				return __clients__.slice(start || 0, end || __clients__.length).reduce(function(a, b) {
					coordinatesB = b.getArrayCoordinates();
					if(!(a instanceof Array)) {
						return [a.getArrayCoordinates(), coordinatesB];
					}

					return a.concat([coordinatesB]);
				});
			};

			function updateRecorredDistance() {
				if(__currentLeg__ && __currentLeg__.distance) {
					__options__.distanceRecorred += __currentLeg__.distance;
				}
			}

			function _prepareCordinates(infoCoordinates) {
				__options__.coordinates = [];
				__options__.coordinatesRouteCar = [];
				var temp = null;
				infoCoordinates.forEach(function(infoCoordinate) {
					temp = _getObjectCoordinates(infoCoordinate.geometry.coordinates)
					__options__.coordinates.push(temp);
					__options__.coordinatesRouteCar = __options__.coordinatesRouteCar.concat(temp)
				});

				return __options__.coordinates;
			}

			self.getLanlng = function() {
				return __options__.latlng;
			};

			self.setRandomClients = function(numberClients, map) {
				RouteUtils.getRandomClients(numberClients, map)
				.then(function(clients) {
					__clients__ = clients;
				});

				return self;
			};

			self.setClients = function(clients) {
				__clients__ = clients;

				return self;
			};

			self.getClients = function() {
				return __clients__;
			};

			self.printClientsLocation = function() {
				for(var i = 0; i < __clients__.length; i++) {
					__clients__[i].printLocation();
				}

				return self;
			};

			self.initRouteCar = function() {
				RouteUtils.callRouteService(_getClientsArrayCoordinates())
				.then(function(response) {
					if(response.code == 'Ok') {
						__trips__ = response.routes[0];
						RouteUtils.callRouteService(
							[[__options__.latlng.lng, __options__.latlng.lat]]
							.concat([__trips__.legs[0].steps[0].geometry.coordinates[0]])
						).then(function(response) {
							if(response.code == 'Ok') {
								__currentLeg__ = response.routes[0].legs[0];
								__waypoints__ = response.waypoints;
								self.setDestinationCoordinates(__currentLeg__.steps)
								.printRoute(__options__.map)
								.moveRoute();
							}
						});
					}
				});

				return self;
			};

			self.setDestinationCoordinates = function(infoCoordinates) {
				_prepareCordinates(infoCoordinates);

				return self;
			};

			self.printSelf = function() {
				__marker__ = L.marker(__options__.latlng, {icon: defaultAutoIcon})
						.addTo(map);

				return self;
			};

			self.printRoute = function(map) {
				__polyline__ = L.polyline(__options__.coordinates, {color: getRandomRGB(), weight: 7}).addTo(map);

				return self;
			};

			self.moveRoute = function() {
				self.fire('updateNextRoute');
				map.removeLayer(__marker__);
				__marker__ = L.Marker.movingMarker(
										__options__.coordinatesRouteCar,
										Array(__options__.coordinatesRouteCar.length)
											.fill(20),
										{icon: defaultAutoIcon})
										.bindPopup('Conductor ' + __options__.clientId).openPopup()
									.addTo(map);
				__marker__.start();
				__marker__.on('end', self.updateNextRoute);
				return self;
			};

			self.pauseRoute = function() {
				__marker__.pause();
			};

			self.rePlayRoute = function() {
				__marker__.resume();
			};

			self.getTRInfo = function() {
				if(!__currentLeg__ && __options__.distanceRecorred == 0) {
					return '';
				}
				client = __clients__[__options__.indexCurrentTrip];
				return String('<tr class="text-center">')
						.concat('<td>Conductor ',__options__.clientId,'</td>',
							'<td>',client && __currentLeg__ ? 'Cliente ' + client.getId() +
							' - ' + (__currentLeg__.distance / 1000).toFixed(2) + ' KM' : '-','</td>',
							'<td>',(__currentLeg__ ? (__currentLeg__.duration / 60).toFixed(2)+' MIN': '-'),'</td>',
							'<td>',__options__.indexCurrentTrip + ' de ' + __clients__.length,'</td>',
							'<td>',(__options__.distanceRecorred / 1000).toFixed(2),' KM</td>',
						'</tr>');
			};

			self.updateNextRoute = function(data) {
				self.fire('updateNextRoute');
				map.removeLayer(__polyline__);
				map.removeLayer(__clients__[__options__.indexCurrentTrip].getMarker());
				updateRecorredDistance();
				__currentLeg__ = __trips__.legs[__options__.indexCurrentTrip ++];
				if(__currentLeg__) {
					self.setDestinationCoordinates(__currentLeg__.steps)
					.printRoute(__options__.map)
					.moveRoute();
				}
				if(__options__.indexCurrentTrip > 1 && __currentLeg__) {
					__currentLeg__.steps = null;
				}
				if(__options__.indexCurrentTrip == __clients__.length) {
					self.fire('updateNextRoute', {end: true});
				}

				return self;
			};

			self.fire = function(name, data) {
				document.dispatchEvent(new CustomEvent(name, data));
			};

			self.clearAll = function() {
				for(var i = __options__.indexCurrentTrip; i < __clients__.length; i++) {
					map.removeLayer(__clients__[i].getMarker());
				}
				map.removeLayer(__marker__);
				map.removeLayer(__polyline__);
				__clients__			= [];
				__currentLeg__		= null;
				__waypoints__		= null;
				__trips__			= null;
				__marker__			= null;
				__polyline__		= null;
			};
		};

		return DeliveryCar;
	})();

	var numCliente		= null;
	var numRepartidor	= null;
	var form			= null;
	var contentForm		= null;

	function app() {
		var numCliente		= $('#numCliente');
		var numRepartidor	= $('#numRepartidor');
		var form			= $('#firstForm');
		var contentForm		= $('#content-form');
		var playPause 		= $('#playPause');
		var tbodyInfo		= $('#tbodyInfo');
		var reInit			= $('#reInit');
		var errorContainer	= $('#errorContainer');
		var clients			= [];
		var cars			= [];
		var map = L.map('map', {center: [19.414792438099568,-99.09479141235353], zoom: 11});
		L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {}).addTo(map);

		form.on('submit', function(e) {
			e.preventDefault();
			numClienteInt		= parseInt(numCliente.val());
			numRepartidorInt	= parseInt(numRepartidor.val());
			if(numClienteInt < numRepartidorInt) {
				errorContainer.removeClass('hidden');
			} else {
				errorContainer.addClass('hidden');
				RouteUtils.getRandomDeliveryCars(numRepartidorInt, map)
				.then(function(_cars) {
					numCliente.val('');
					numRepartidor.val('');
					cars = _cars;
					RouteUtils.getRandomClients(numClienteInt, map)
					.then(function(_clients) {
						clients = _clients;
						initSimulation(cars, clients);
						contentForm.hide(700);
					});
				});
			}
		});

		reInit.on('click', function(e) {
			for (var i = 0; i < cars.length; i++) {
				cars[i].clearAll();
			}

			contentForm.show(700);
			playPause.removeClass('glyphicon-play').addClass('glyphicon-pause');
		});

		playPause.on('click', function(e) {
			e.preventDefault();
			var play = playPause.hasClass('glyphicon-pause');
			if(play) {
				playPause.removeClass('glyphicon-pause').addClass('glyphicon-play');
			} else {
				playPause.removeClass('glyphicon-play').addClass('glyphicon-pause');
			}

			if(cars.length) {
				for(var i = 0; i < cars.length; i++) {
					if(!play) {
						cars[i].rePlayRoute();
					} else {
						cars[i].pauseRoute();
					}
				}
			} 
		});

		function initSimulation(cars, clients) {
			var sliceStart = 0, sliceEnd = Math.round(clients.length / cars.length);
			for(var i = 0; i < cars.length; i++) {
				RouteUtils.sortClientsByLatLng(cars[i].getLanlng(), clients, 0, clients.length - 1);
				cars[i]
				.setClients(clients.slice(sliceStart, sliceEnd))
				.printSelf()
				.printClientsLocation()
				.initRouteCar();
				document.addEventListener('updateNextRoute', updateTable);
				clients = clients.slice(sliceEnd, clients.length);
				if(i == cars.length - 2) {
					sliceEnd = clients.length;
				}
			}
		}

		function updateTable() {
			var trs = '';
			for(var i = 0; i < cars.length; i++) {
				trs += cars[i].getTRInfo();
			}

			tbodyInfo.html(trs);
		}

	}

	$(document).ready(app);
})();
