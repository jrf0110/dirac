/**
 * Base Data Access Class
 */

var utils = require('./utils');
var pg = require('pg');

module.exports = utils.Class.extend({
  initialize: function(connString, schema){
    this.connString = connString;
    this.schema = schema || {};
    return this;
  }

, raw: function(query, values, callback){
    callback = callback || utils.noop;

    pg.connect( config.copper.connStr, function( error, client, done ){
      if (error) return callback( error );

      client.query( query, values, function( error, result ){
        done();

        callback( error, result );
      });
    });

    return this;
  }

, query: function(query, callback){
    callback = callback || utils.noop;

    var sql = utils.sql( query );

    return this.raw( sql.toString(), sql.values, function( error, result ){
      if ( error ) return callback( error );

      if ( query.type == 'select' || query.returning )
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
});