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
var options = {
    origins: 'Dadeland Mall',
    destinations: 'University of Miami',
    departure_time: new Date().getTime(),
    key: API_KEY
};

request(DISTANCE_API_URL + qs.stringify(options), function (err, res, data) {
    if (!err && res.statusCode == 200) {
        var d = JSON.parse(data);
        console.log(data);
    } else {
        callback(new Error('Request error: Could not fetch data from Google\'s servers: ' + body));
    }
});

//function getDistance(origin, destination){
//    request(DISTANCE_API_URL + )
//}

//var client = new Twit({
//    consumer_key: 'lAu7pibfnQwnX7f8Ztu7oVYwk',
//    consumer_secret: 'Qt1F6AKzTcsSH5jFdmlYVO8mWfZv7MIBanZaUfgnu1StHe7c2P',
//    access_token: '46086006-w3g94WkgESdK1Ga4LyprkPhx39PKpcZXoi9JPsSm4',
//    access_token_secret: 'uxlvnxrmEwk2xW1Vzj7kXemDr2ggAPWFOEmnlltDUJHkT'
//});

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
    location: Sequelize.STRING,
    haveCar: Sequelize.BOOLEAN,
    seats: Sequelize.STRING
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
        reply.view('index', {}, {
            layout: 'none'
        });
    }
});

server.route({
    method: 'GET',
    path: '/new',
    handler: function (request, reply) {
        reply.view('new_trip', {}, {
            layout: 'none'
        });
    }
});

server.route({
    method: 'POST',
    path: '/create',
    handler: function (request, reply) {
        var p = {
            name: request.payload.name,
            location: request.payload.location,
            haveCar: request.payload.haveCar,
            seats: request.payload.seats
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
                            Trip.count().then(function (tip) {

                                reply.view('trip_created', {
                                    tripname: tr.tripname,
                                    id: tip,
                                    destination: tr.destination,
                                    people: [p]
                                }, {
                                    layout: 'none'
                                });

                            });
                        });
                    });
                });
            });
        });

        //        reply(JSON.stringify(request.payload));
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
                if (t['people_' + i] != null) {
                    pids.push(t['people_' + i]);
                }
            }
            //            reply(JSON.stringify(pids));
            People.findAll({
                where: {
                    id: pids
                }
            }).then(function (people) {
                people = JSON.parse(JSON.stringify(people));
                reply.view('trip_page', {
                    tripname: parsing.tripname,
                    id: request.params.id,
                    destination: parsing.destination,
                    people: people
                }, {
                    layout: 'none'
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