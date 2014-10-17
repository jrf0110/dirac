var mosql   = require('mongo-sql');
var pg      = require('pg.js');
var async   = require('async');
var lodash  = require('lodash');
var Class   = require('./class');

var utils = module.exports = {};

utils.noop = function(){};

utils.Class = Class;

utils.mosql = mosql;

utils.pg    = pg;

utils.async = async;

lodash.extend( utils, lodash, async );
