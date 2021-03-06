var async   = require('async');
var lodash  = require('lodash');
var Class   = require('./class');

var utils = module.exports = {};

utils.noop = function(){};

utils.Class = Class;

utils.async = async;

lodash.extend( utils, lodash, async );
