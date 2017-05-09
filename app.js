'use strict';

const Hapi = require('hapi');
const Blipp = require('blipp');
const Path = require('path');
const Inert = require('inert');
const Vision = require('vision');
const Handlebars = require('handlebars');
const pg = require('pg');
const Sequelize = require('sequelize');
const Twit = require('twit');
const request = require('request');
const qs = require('querystring');


var DISTANCE_API_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json?';
var API_KEY = 'AIzaSyBN5J7kC4rHwCTkgBJKAjjHecp6cIl-MP0';

function getDistance(origin, destination, func) {

    var options = {
        origins: origin,
        destinations: destination,
        departure_time: new Date().getTime(),
        key: API_KEY
    };

    request(DISTANCE_API_URL + qs.stringify(options), function (err, res, data) {
        if (!err && res.statusCode == 200) {
            func(data);
        } else {
            callback(new Error('Request error: Could not fetch data from Google\'s servers: ' + body));
        }
    });
}

const server = new Hapi.Server({
    connections: {
        routes: {
            files: {
                relativeTo: Path.join(__dirname, 'public')
            }
        }
    }
});

server.connection({
    port: (process.env.PORT || 3000)
});

var sequelize;

if (process.env.DATABASE_URL) {
    // the application is executed on Heroku ... use the postgres database
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        protocol: 'postgres',
        logging: true //false
    })
} else {
    sequelize = new Sequelize('db', 'username', 'password', {
        host: 'localhost',
        dialect: 'sqlite',
        pool: {
            max: 5,
            min: 0,
            idle: 10000
        },
        storage: 'db.sqlite'
    });
}

var table = {
    tripname: Sequelize.STRING,
    destination: Sequelize.STRING
};

for (var i = 0; i < 20; i++) {
    table['people_' + i] = Sequelize.STRING;
}

var Trip = sequelize.define('trip', table);
var People = sequelize.define('people', {
    name: Sequelize.STRING,
    location: Sequelize.STRING
});

server.register([Blipp, Inert, Vision], () => {});

server.views({
    engines: {
        html: Handlebars
    },
    path: 'views',
    relativeTo: __dirname,
    layoutPath: 'views/layout',
    layout: 'layout',
    helpersPath: 'views/helpers'
});

server.route({
    method: 'GET',
    path: '/',
    handler: function (request, reply) {
        reply.view('index');
    }
});

function swap(arr, i, j) {
    if (i != j) {
        var temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
    }
}

function perm(arr) {
    var arrs = [];
    (function fn(n) {
        for (var i = n; i < arr.length; i++) {
            swap(arr, i, n);
            if (n + 1 < arr.length - 1)
                fn(n + 1);
            else if (arr[0] == 0 && arr[arr.length - 1] == arr.length - 1) {
                var array = arr.slice(0);
                console.log(array);
                arrs.push(array);
            }
            swap(arr, i, n);
        }
    })(0);
    return arrs;
}

server.route({
    method: 'GET',
    path: '/trip/{id}/pool',
    handler: function (request, reply) {

        Trip.findOne({
            where: {
                id: request.params.id
            }
        }).then(function (trip) {
            var trip = JSON.parse(JSON.stringify(trip));
            var pids = [];
            for (var i = 0; i < 20; i++) {
                if (trip['people_' + i] != null) {
                    pids.push(trip['people_' + i]);
                }
            }
            People.findAll({
                where: {
                    id: pids
                }
            }).then(function (people) {
                people = JSON.parse(JSON.stringify(people));
                var locs = [];
                for (var i = 0; i < people.length; i++) {
                    locs.push(people[i].location);
                }
                locs.push(trip.destination);
                var locations = locs.join('|');
                getDistance(locations, locations, function (data) {
                    var dm = JSON.parse(data).rows;
                    console.log(JSON.stringify(dm));

                    var arr = [];
                    for (var i = 0; i < locs.length; i++) {
                        arr.push(i);
                    }
                    var arrs = perm(arr);

                    var totalTimes = [];
                    for (var i = 0; i < arrs.length; i++) {
                        //                        console.log(arrs[i]);
                        var time = 0;
                        for (var j = 0; j < arrs[i].length - 1; j++) {
                            time += dm[arrs[i][j]].elements[arrs[i][j + 1]].duration_in_traffic.value;
                        }
                        console.log(time);
                        totalTimes[i] = time;
                    }

                    var minTimeIndex = 0;
                    for (var i = 1; i < totalTimes.length; i++) {
                        if (totalTimes[i] < totalTimes[minTimeIndex])
                            minTimeIndex = i;
                    }

                    var minTimeLocList = [];
                    for (var i = 0; i < locs.length; i++) {
                        minTimeLocList.push(locs[arrs[minTimeIndex][i]]);
                        console.log(i);
                    }

                    console.log(minTimeLocList);

                    reply().redirect('https://www.google.com/maps/dir/' + minTimeLocList.join('/'));


                });


                //                reply.view('trip_page', {
                //                    tripname: parsing.tripname,
                //                    id: request.params.id,
                //                    destination: parsing.destination,
                //                    people: people
                //                }, {
                //                    layout: 'none'
                //                });
            });
        });
    }
});

server.route({
    method: 'GET',
    path: '/new',
    handler: function (request, reply) {
        reply.view('new_trip');
    }
});

server.route({
    method: 'POST',
    path: '/create',
    handler: function (request, reply) {
        var p = {
            name: request.payload.name,
            location: request.payload.location
        };
        People.create(p).then(function () {
            People.sync().then(function () {
                People.count().then(function (pid) {
                    var tr = {
                        tripname: request.payload.tripname,
                        destination: request.payload.destination,
                        people_0: pid
                    }
                    Trip.create(tr).then(function () {
                        Trip.sync().then(function () {
                            Trip.count().then(function (tid) {

                                reply.view('trip_created', {
                                    tripname: tr.tripname,
                                    id: tid,
                                    destination: tr.destination,
                                    people: [p]
                                });

                            });
                        });
                    });
                });
            });
        });
    }
});

server.route({
    method: 'GET',
    path: '/trip/{id}/add',
    handler: function (request, reply) {
        reply.view('add_people', {
            id: request.params.id
        });
    }
});

server.route({
    method: 'POST',
    path: '/trip/{id}/add',
    handler: function (request, reply) {
        var p = {
            name: request.payload.name,
            location: request.payload.location
        };

        People.create(p).then(function () {
            People.sync().then(function () {
                People.count().then(function (pid) {

                    Trip.findOne({
                        where: {
                            id: request.params.id
                        }
                    }).then(function (trip) {
                        var parsing = JSON.parse(JSON.stringify(trip));

                        for (var i = 0; i < 20; i++) {
                            if (parsing['people_' + i] == null) {
                                parsing['people_' + i] = pid;
                                break;
                            }
                        }
                        Trip.update(parsing, {
                            where: {
                                id: parsing.id
                            }
                        }).then(function () {
                            reply().redirect('/trip/' + request.params.id);
                        });
                    });
                });
            });
        });
    }
});

server.route({
    method: 'GET',
    path: '/trip/{tid}/remove/{pid}',
    handler: function (request, reply) {
        Trip.findOne({
            where: {
                id: request.params.tid
            }
        }).then(function (t) {
            var parsing = JSON.parse(JSON.stringify(t));

            for (var i = 0; i < 20; i++) {
                if (parsing['people_' + i] == request.params.pid) {
                    parsing['people_' + i] = null;
                    Trip.update(parsing, {
                        where: {
                            id: request.params.tid
                        }
                    }).then(function () {
                        Trip.sync();
                        reply().redirect('/trip/' + request.params.tid);
                    });
                }
            }
        });
    }
});

server.route({
    method: 'GET',
    path: '/trip/{id}',
    handler: function (request, reply) {
        Trip.findOne({
            where: {
                id: request.params.id
            }
        }).then(function (t) {
            var parsing = JSON.parse(JSON.stringify(t));
            var pids = [];
            for (var i = 0; i < 20; i++) {
                if (parsing['people_' + i] != null) {
                    pids.push(parsing['people_' + i]);
                }
            }
            //            reply(JSON.stringify(pids));
            People.findAll({
                where: {
                    id: pids
                }
            }).then(function (people) {
                people = JSON.parse(JSON.stringify(people));
                for (var i = 0; i < people.length; i++) {
                    people[i]["tid"] = request.params.id;
                }
                reply.view('trip_page', {
                    tripname: parsing.tripname,
                    id: request.params.id,
                    destination: parsing.destination,
                    people: people
                });
            });
        });
    }
});

server.route({
    method: 'POST',
    path: '/update/{id}',
    handler: function (request, reply) {
        Trip.update(request.payload, {
            where: {
                id: request.params.id
            }
        }).then(function () {
            Trip.sync();
        });
    }
});


server.route({
    method: 'GET',
    path: '/createDB',
    handler: function (request, reply) {
        Trip.sync({
            force: true
        });
        People.sync({
            force: true
        });
        reply('Database created.');
    }
});

server.route({
    method: 'GET',
    path: '/clearDB',
    handler: function (request, reply) {
        Trip.drop();
        People.drop();
        reply('Database cleared.');
    }
});

server.route({
    method: 'GET',
    path: '/{param*}',
    handler: {
        directory: {
            path: './',
            listing: true,
            index: false,
            redirectToSlash: true
        }
    }
});

server.start((err) => {

    if (err) {
        throw err;
    }
    console.log(`Server running at: ${server.info.uri}`);
});