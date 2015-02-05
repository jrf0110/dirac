/**
 * Base Data Access Class
 */

var utils = require('./utils');
var pg    = require('./db').pg;
var mosql = require('./db').mosql;
var async = require('async');

var validReturningQueryTypes = [
  'select', 'union', 'intersect', 'except'
];

module.exports = utils.Class.extend({
  initialize: function(connString){

    if ( typeof connString === 'string') {
      this.connString = connString;
    }

    if ( connString instanceof pg.Client ) {
      this.client = connString;
    }

    this.table      = this.name;

    // Holds queries while sync completes
    this.syncQueue  = [];

    this.befores    = {};
    this.afters     = {};
    return this;
  }

, raw: function raw(query, values, callback){
    if ( typeof values == 'function' ){
      callback = values;
      values = [];
    }

    callback = callback || utils.noop;

    // Use provided client or use a pool client
    if ( !this.client && !this.connString ) throw new Error ('No client provided');

    if ( this.client ) {
      this.client.query( query, values, callback );
      return this;
    }

    if ( this.connString ) {
      pg.connect( this.connString, function( error, client, done ){
        if (error) return callback( error );

        client.query( query, values, function( error, result ){
          done();

          callback( error, result );
        });
      });
    }

    return this;
  }

, query: function query($query, callback){
    var this_ = this, caller = arguments.callee.caller.name;

    callback = callback || utils.noop;

    if ( this.isSyncing && !$query.ignoreSync ){
      return this.syncQueue.push( function(){
        this_.query( $query, callback );
      });
    }

    this.runBeforeFilters( caller, $query, function( error ){
      if ( error ) return callback( error );

      var query = mosql.sql( $query );

      return this_.raw( query.toString(), query.values, function( error, result ){
        if ( error ) return callback( error );

        if ( validReturningQueryTypes.indexOf( $query.type ) > -1 || $query.returning ){
          return this_.runAfterFilters( caller, result.rows, $query, callback );
        }

        callback();
      });
    });
  }

, insert: function insert(values, options, callback){
    if (typeof options == 'function'){
      callback = options;
      options = null;
    }

    var query = {
      type: 'insert'
    , table: this.table
    , values: values
    , returning: ['*']
    };

    if (options){
      for (var key in options) query[key] = options[key];
    }

    return this.query(query, callback);
  }

, find: function find(where, options, callback){
    if (typeof options == 'function'){
      callback = options;
      options = {};
    }

    var query = {
      type: 'select'
    , table: this.table
    , where: where
    };

    for (var key in options) query[key] = options[key];

    return this.query(query, callback);
  }

, findOne: function findOne(id, options, callback){
    if (typeof options == 'function'){
      callback = options;
      options = {};
    }

    var where;

    if (typeof id != 'object') where = { id: id };
    else where = id;

    var query = {
      type: 'select'
    , table: this.table
    , where: where
    , limit: 1
    };

    for (var key in options) query[key] = options[key];

    return this.query(query, function(error, results){
      callback(error, results && results.length > 0 ? results[0] : null);
    });
  }

, update: function update($query, $update, options, callback){
    if (typeof options == 'function'){
      callback = options;
      options = {};
    }

    if (typeof $query != 'object') $query = { id: $query };

    var query = {
      type:     'update'
    , table:    this.table
    , where:    $query
    , updates:  $update
    };

    for (var key in options) query[key] = options[key];

    return this.query(query, callback);
  }

, remove: function remove(id, options, callback){
    if (typeof options == 'function'){
      callback = options;
      options = null;
    }

    var query = {
      type: 'delete'
    , table: this.table
    , where: typeof id == 'object' ? id : { id: id }
    , returning: ['*']
    };

    if (options){
      for (var key in options) query[key] = options[key];
    }

    return this.query(query, callback);
  }

, createIfNotExists: function createIfNotExists(callback){
    var query = {
      type:         'create-table'
    , table:        this.table
    , ifNotExists:  true
    , definition:   this.schema
    , ignoreSync:   true
    };

    return this.query(query, callback);
  }

, dropTable: function dropTable(options, callback){
    if (typeof options == 'function'){
      callback = options;
      options = {};
    }

    var query = {
      type:         'drop-table'
    , table:        this.table
    , ifExists:     true
    , ignoreSync:   true
    };

    if (options){
      for (var key in options) query[key] = options[key];
    }

    return this.query(query, callback);
  }

, lock: function lock(mode, callback) {
    if (typeof mode == 'function'){
      callback = mode;
      mode = null;
    }

    var query = 'LOCK TABLE ' + this.table + (mode ? ' IN ' + mode + ' MODE' : '');
    return this.raw(query, callback);
  }

, before: function( fnName, handlers ){
    if ( typeof this[ fnName ] != 'function' )
      throw new Error('Dirac.DAL.before cannot find function `' + fnName + '`');

    handlers = Array.prototype.slice.call( arguments, 1 );

    if ( !this.befores[ fnName ] ) this.befores[ fnName ] = handlers;
    else this.befores[ fnName ] = this.befores[ fnName ].concat( handlers );

    return this;
  }

, after: function( fnName, handler ){
    if ( typeof this[ fnName ] != 'function' )
      throw new Error('Dirac.DAL.after cannot find function `' + fnName + '`');

    handlers = Array.prototype.slice.call( arguments, 1 );

    if ( !this.afters[ fnName ] ) this.afters[ fnName ] = handlers;
    else this.afters[ fnName ] = this.afters[ fnName ].concat( handlers );
  }

, runBeforeFilters: function( type, $query, callback ){
    if ( !(type in this.befores) ) return callback ? callback() : null, this;

    var this_ = this;

    async.series(
      // Prepare befores to be async-series ready
      this.befores[ type ].map( function( handler ){
        return function( done ){
          handler( $query, this_.schema, done );
        }
      })
      // On series completion
    , callback
    );
  }

, runAfterFilters: function( type, results, $query, callback ){
    if ( !(type in this.afters) ) return callback ? callback( null, results ) : null, this;

    var this_ = this;

    async.series(
      // Prepare afters to be async-series ready
      this.afters[ type ].map( function( handler ){
        return function( done ){
          handler( results, $query, this_.schema, done );
        }
      })
      // On series completion
    , function( error ){
        callback( error, results );
      }
    );
  }
});
