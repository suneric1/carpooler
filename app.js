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

var client = new Twit({
    consumer_key: 'lAu7pibfnQwnX7f8Ztu7oVYwk',
    consumer_secret: 'Qt1F6AKzTcsSH5jFdmlYVO8mWfZv7MIBanZaUfgnu1StHe7c2P',
    access_token: '46086006-w3g94WkgESdK1Ga4LyprkPhx39PKpcZXoi9JPsSm4',
    access_token_secret: 'uxlvnxrmEwk2xW1Vzj7kXemDr2ggAPWFOEmnlltDUJHkT'
});

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

var Colors = sequelize.define('colors', {});

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

server.route({
    method: 'GET',
    path: '/createDB',
    handler: function (request, reply) {
        Colors.sync({
            force: true
        });
        reply('Database created.');
    }
});

server.route({
    method: 'GET',
    path: '/clearDB',
    handler: function (request, reply) {
        Colors.drop();
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


var stream = client.stream('statuses/filter', { track: 'mango' });

stream.on('tweet', function (tweet) {
  console.log(tweet + "\n\n");
});

//server.start((err) => {
//
//    if (err) {
//        throw err;
//    }
//    console.log(`Server running at: ${server.info.uri}`);
//});