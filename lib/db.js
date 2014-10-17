/**
 * Database access
 */

var mosql = require('mongo-sql');
var pg = require('pg.js');

var Db = function( opts ){
  opts = opts || {};
  this.mosql = opts.mosql || mosql;
  this.pg = opts.pg || pg;
}

Db.prototype.setMosql = function( instance ){
  this.mosql = instance;
}

Db.prototype.setPg = function( instance ){
  this.pg = instance;
}

/**
 * Expose a db object
 */

module.exports = new Db();
