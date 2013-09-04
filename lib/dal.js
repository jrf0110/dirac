// WIP Filters
// Started trying to automatically allow filters on all instance methods
// however I ran into a problem because filters need the $query object
// and that query object is constructed DURING the handler
//
// We'll likely need to explicitly say when filters are to be called
// defined in the instance method definition.
//
// An alternative is to only do filters on this.query. This would
// defintiely simplify the implementation, but it would restrict
// filters to only be applied on query types. Which may be good.
// So if you've got 5 different methods that perform a select, the
// filter will get applied to all of them.

/**
 * Base Data Access Class
 */

var utils = require('./utils');
var pg = require('pg');

module.exports = utils.Class.extend({
  initialize: function(connString, definition){
    this.connString = connString;
    this.definition = definition || {};
    this.table      = definition.name;
    this.schema     = definition.schema;

    this.initFilters();
    return this;
  }

, initFilters: function(){
    var this_ = this;

    this.befores    = {};
    this.afters     = {};

    // Layer before/after function
    Object.keys( this ).filter( function( key ){
      return typeof this_[ key ] == 'function';
    }).forEach( function( fn ){
      var old = this_[ fn ];
      this_[ fn ] = function(){
        // Modify the callback arg to accept the onion
        if ( fn in this_.afters ){
          var argI;
          for ( argI in arguments ){
            if ( typeof argI == 'function' ) break;
          }

          // Onionize callback arg setting the callback as the last layer
          // arguments[ argI ] = utils.onion( this_.afters[ fn ].concat( arguments[ argI ] ) )
          arguments[ argI ] = function(){
            var fnI = 0;

          };
        }

        if ( !(fn in this_.befores) ) return old.apply( this_, arguments );
      };
    });
  }

, raw: function(query, values, callback){
    if ( typeof values == 'function' ){
      callback = values;
      values = [];
    }

    callback = callback || utils.noop;

    pg.connect( this.connString, function( error, client, done ){
      if (error) return callback( error );

      client.query( query, values, function( error, result ){
        done();

        callback( error, result );
      });
    });

    return this;
  }

, query: function($query, callback){
    callback = callback || utils.noop;

    var query = utils.sql( $query );

    return this.raw( query.toString(), query.values, function( error, result ){
      if ( error ) return callback( error );

      if ( $query.type == 'select' || $query.returning )
        return callback( null, result.rows, result );

      callback();
    });
  }

, insert: function(values, options, callback){
    if (typeof options == 'function'){
      callback = options;
      options = null;
    }

    var query = {
      type: 'insert'
    , table: this.table
    , values: values
    , returning: ['id']
    };

    if (options){
      for (var key in options) query[key] = options[key];
    }

    return this.query(query, callback);
  }

, find: function(where, options, callback){
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

, findOne: function(id, options, callback){
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

, update: function($query, $update, options, callback){
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

, remove: function(id, options, callback){
    if (typeof options == 'function'){
      callback = options;
      options = null;
    }

    var query = {
      type: 'delete'
    , table: this.table
    , where: typeof id == 'object' ? id : { id: id }
    , returning: ['id']
    };

    if (options){
      for (var key in options) query[key] = options[key];
    }

    return this.query(query, callback);
  }

, createIfNotExists: function(callback){
    var query = {
      type:         'create-table'
    , table:        this.table
    , ifNotExists:  true
    , definition:   this.schema
    };

    return this.query(query, callback);
  }

, dropTable: function(options, callback){
    if (typeof options == 'function'){
      callback = options;
      options = {};
    }

    var query = {
      type:         'drop-table'
    , table:        this.table
    , ifExists:     true
    };

    if (options){
      for (var key in options) query[key] = options[key];
    }

    return this.query(query, callback);
  }

, before: function( fnName, handlers ){
    if ( typeof this[ fnName ] != 'function' )
      throw new Error('Dirac.DAL.before cannot find function `' + fnName + '`');

    var this_ = this;

    handlers = Array.prototype.slice.call( arguments, 1 );

    handlers = handlers.map( function( handler ){
      return function( done ){
        return handler(  )
      }
    });

    if ( !this.befores[ fnName ] ) this.befores[ fnName ] = handlers;
    else this.before[ fnName ] = this.before[ fnName ].concat( handlers );

    return this;
  }

, after: function( fnName, handler ){
    if ( typeof this[ fnName ] != 'function' )
      throw new Error('Dirac.DAL.after cannot find function `' + fnName + '`');
  }
});