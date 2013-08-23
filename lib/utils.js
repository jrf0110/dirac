var mosql = require('mongo-sql');
var async = require('async');
var Class = require('./class');

var utils = module.exports = {};

utils.noop = function(){};

utils.Class = Class;

utils.sql = mosql.sql;

utils.async = async;

for ( var key in async ) utils[ key ] = async[ key ];