var mosql = require('mongo-sql');
var Class = require('./class');

var utils = module.exports = {};

utils.noop = function(){};

utils.Class = Class;

utils.sql = mosql.sql;