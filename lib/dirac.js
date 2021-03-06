var
  dirac         = module.exports = {}
, EventEmitter  = require('events').EventEmitter
, pg            = require('./db').pg
, mosql         = require('./db').mosql
, utils         = require('./utils')
, DAL           = require('./dal')
, atsStrats     = require('./alter-table-sync-strategies')
;

for ( var key in EventEmitter.prototype ){
  dirac[ key ] = EventEmitter.prototype[ key ];
}

dirac.DAL = DAL;

dirac.Dals  = {};
dirac.dals  = {};
dirac.views = {};

dirac.afterInits = [];

var defaults = {
  host: 'localhost'
, port: 5432
};

dirac.init = function(options){
  if ( typeof options === 'string' ){
    options = { connString: options };
  }

  options = options || {};

  if ( !('connString' in options) && !('database' in options) ){
    throw new Error('Dirac.init options requires property `connString` or `database`');
  }

  dirac.options = options;

  for ( var key in defaults ){
    if ( !(key in dirac.options) ) dirac.options[ key ] = defaults[ key ];
  }

  if ( !dirac.options.connString ){
    dirac.options.connString = 'postgres://' + options.host + ':' + options.port + '/' + options.database;
  }

  // Set node-pg options
  for ( var key in options ){
    if ( key in pg.defaults ) pg.defaults[ key ] = options[ key ];
  }

  Object.keys( dirac.Dals ).forEach( dirac.instantiateDal );

  // Run `use` functions
  for ( var i = 0; i < dirac.afterInits.length; ++i ){
    dirac.afterInits[i]( dirac );
  }

  dirac.hasInitialized = true;
};

dirac.use = function( fn, options ){
  if ( typeof fn !== 'function' ){
    throw new Error('dirac.use - invalid argument type `' + typeof fn + '`');
  }

  options = options || {};

  if ( options.immediate || fn.__immediate ) return fn( dirac );

  if ( dirac.hasInitialized ) return fn( dirac );

  dirac.afterInits.push( fn );
};

dirac.instantiateDal = function( dal ){
  dirac.dals[ dal ] = new dirac.Dals[ dal ]( dirac.options.connString );
};

dirac.destroy = function(){
  Object.keys( dirac.dals ).forEach( dirac.unregister );
  dirac.register( require('./dirac-table') );

  dirac.afterInits = [];
  delete dirac.options;
  dirac.hasInitialized = false;
};

/**
 * The premise here is to query the dirac_schemas table for previous schemas
 * compare those schemas against what's loaded in memory and determine the
 * required SQL to get the database in the correct state.
 * with test as (select max(val) as max from vals) select vals.* from vals, test where val = test.max;
 */

dirac.sync = function(options, callback){
  dirac.setSyncing(true);

  if ( typeof options == 'function' ){
    callback = options;
    options = {};
  }

  options = options || {};

  var oldCallback = callback || utils.noop;
  callback = function(){
    dirac.setSyncing(false);
    oldCallback.apply( null, arguments );
  };


  if ( options.force ) return (function(){
    dirac.dropAllTables( function( error ){
      if ( error && callback ) return callback( error)
      if (error) console.log("ERROR: ", error);
      dirac.createTables( callback );
    });
  })();

  dirac.createTables(function(error){

    if (error && callback) return callback(error);
    if (error) console.log("ERROR: ", error);

    dirac.dals.dirac_schemas.findLatest( function(error, results){
      if (error && callback) callback(error);
      if (error) console.log("ERROR: ", error);
      if (results.length == 0) return dirac.saveCurrentDbState(1, callback);

      var currentDb = {};
      var newDb = {};
      var newColumn, oldColumn;
      var version;
      var actionResult;
      var $alter = {
        type: 'alter-table'
      };

      // Build current db representation
      results.forEach(function(table){
        version = table.version;
        currentDb[table.tableName] = table.schema;
      });

      // Build new db representation
      for (var key in dirac.dals){
        if (key == 'dirac') continue;
        newDb[key] = dirac.dals[key].schema;
      }

      // Perform non-destructive table changes
      for (var table in newDb){
        // Skip if new table since it was already taken care of
        if (!(table in currentDb))
          continue;

        $alter = {
          type: 'alter-table'
        , table: table
        };

        // Inspect table - see if we've added new columns or attributes
        for (var columnName in newDb[table]){
          newColumn = newDb[table][columnName];

          if (!(columnName in currentDb[table])){
            $alter.action = {
              addColumn: newColumn
            };
            $alter.action.addColumn.name = columnName;
            dirac.dals.dirac_schemas.query($alter, function(error){
              if (error) console.log("ERROR ADDING COLUMN:", error);
              if (error && callback) return callback(error);
              if (error) throw error;
            });
            continue;
          }

          $alter.action = [];

          oldColumn = currentDb[table][columnName];

          // Inspect column attributes
          utils.union(
            Object.keys( newColumn )
          , Object.keys( oldColumn )
          ).forEach( function( attr ){
            if ( !atsStrats.has( attr ) ) return;

            actionResult = atsStrats.get( attr ).fn(
              columnName, newColumn, oldColumn, newDb[table], currentDb[table], table
            );

            if ( Array.isArray( actionResult ) ){
              $alter.action = $alter.action.concat( actionResult );
            } else if ( typeof actionResult === 'object' && !!actionResult ) {
              $alter.action.push( actionResult );
            }
          });

          // No change made, do not query
          if ($alter.action.length == 0){
            continue;
          }

          dirac.dals.dirac_schemas.query($alter, function(error){
            if (error) return console.log("ERROR ALTERING COLUMN", error);
          });
        }
      }

      dirac.saveCurrentDbState(++version, callback);
    });
  });
};

dirac.saveCurrentDbState = function(version, callback){
  utils.series(
    Object.keys( dirac.dals ).map( function( key ){
      return function( done ){
        dirac.dals.dirac_schemas.insert({
          tableName:  key
        , version:    version
        , schema:     JSON.stringify( dirac.dals[key].schema )
        }, done );
      }
    })
  , callback
  );
};

dirac.createTables = function(callback){
  // Determine order that tables need to be created
  var ordered = [], column;

  // Represent the references as a directed acyclic graph
  var graph = {};

  for (var table in dirac.dals){
    if (table in dirac.views) continue;
    graph[table] = {
      dependencies: []
    , incoming:     []
    };
  }

  for (var table in graph){
    for (var col in dirac.dals[table].schema){
      column = dirac.dals[table].schema[col];

      // Table does not depend on anything
      if (!column.references) continue;

      graph[table].dependencies.push(column.references.table);
      graph[column.references.table].incoming.push(table);
    }
  }

  // Get set of nodes with no edges
  var notDependedOn = [];
  for (var table in graph){
    if (graph[table].incoming.length == 0) notDependedOn.push(table);
  }
  // Perform topological sort on DAG
  var table, node;
  while (table = notDependedOn.pop()){
    ordered.unshift( table );

    // Table has no dependencies, so it doesn't matter where it is
    if (graph[table].dependencies.length == 0) continue;

    // Remove edges from table to dependencies
    while ( graph[table].dependencies.length > 0 ){
      node = graph[table].dependencies.pop();
      graph[node].incoming = graph[node].incoming.filter(function(t){
        return t != table;
      });

      if ( graph[node].incoming.length == 0 ){
        notDependedOn.push( node );
      }
    }
  }

  // Ensure solution was found
  if ( Object.keys( graph ).filter( function( table ){
    return graph[ table ].incoming.length > 0 || graph[ table ].dependencies.length > 0;
  }).length > 0 ) return callback( new Error( 'Dependency tree is cyclic' ));

  utils.series(
    ordered.map( function( table ){
      return function( done ){
        dirac.dals[table].createIfNotExists( done );
      }
    })
  , function( error ){
      if ( error ) return callback( error );

      dirac.createViews( callback );
    }
  );
};

dirac.createViews = function( callback ){
  utils.series(
    Object.keys( dirac.views ).map( function( viewName ){
      return function( done ){
        var result = mosql.sql({
          type: 'create-view'
        , view: viewName
        , orReplace: true
        , expression: dirac.views[ viewName ]._query
        });

        var query = result.toString();

        // Node-PG is doing funky stuff with paramaterized
        // create view queries. So de-paramaterize
        result.values.forEach( function( r, i ){
          query = query.replace( new RegExp( '\\$' + (i + 1), 'g' ), '$$$' + r + '$$$' );
        });
        dirac.raw( query, done );
      };
    })
  , function( error ){
      return callback( error );
    }
  );
};

dirac.dropAllTables = function(options, callback){
  if ( typeof options == 'function' ){
    callback = options;
    options = {};
  }

  options = options || {};

  utils.series(
    Object.keys( dirac.dals ).map( function( table ){
      return function( done ){
        if ( table == 'dirac_schemas' && !options.forceDirac ) return done();
        dirac.dals[table].dropTable({ cascade: true }, done);
      }
    })
  , callback
  );
};

dirac.register = function(definition){
  if ( !('name' in definition) )
    throw new Error('Dirac.register `name` required in definition');

  if ( !('schema' in definition) && definition.type != 'view' )
    throw new Error('Dirac.register `schema` required in definition');

  if ( definition.type == 'view' && typeof definition.query != 'object' )
    throw new Error('Dirac.register `query` required when `type` is `view`');

  var name = definition.alias || definition.name;
  var view;

  if ( definition.type == 'view' ){
    view = dirac.views[ name ] = utils.clone( definition );

    // Do not override DAL.query
    view._query = view.query;
    delete view.query;
  }

  var DAL = dirac.DAL.extend( definition.type == 'view' ? view : definition );

  dirac.Dals[ name ] = DAL;

  if ( dirac.hasInitialized ) dirac.instantiateDal( name );

  return DAL;
};

dirac.unregister = function(name){
  delete dirac.dals[ name ];
  delete dirac.Dals[ name ];
  delete dirac.views[ name ];
};

dirac.query = function( $query, callback ){
  var query = mosql.sql( $query );
  dirac.raw( query.toString(), query.values, callback );
};

dirac.raw = function( query, values, callback ){
  if ( typeof values == 'function' ){
    callback = values;
    values = [];
  }

  callback = callback || utils.noop;

  pg.connect( dirac.options.connString, function( error, client, done ){
    if (error) return callback( error );
    client.query( query, values, function( error, result ){
      done();

      callback( error, result );
    });
  });
};

dirac.setSyncing = function( val ){
  dirac.isSyncing = !!val;

  for ( var key in dirac.dals ){
    if ( key === 'dirac_schemas' ) continue;
    dirac.dals[ key ].isSyncing = dirac.isSyncing;
  }

  if ( dirac.isSyncing ) return;

  // Sync complete, let's drain queues
  for ( var key in dirac.dals ){
    if ( key === 'dirac_schemas' ) continue;
    if ( dirac.dals[ key ].syncQueue.length === 0 ) continue;
    dirac.dals[ key ].syncQueue.forEach( function( fn ){
      fn();
    });
  }
};

dirac.tx = {
  create: function() {
    var client = new pg.Client( dirac.options.connString );
    client.connect();

    var throwError = function() {
      throw new Error('Transaction already committed');
    };

    var releaseClient = function() {
      client.end();
      client = null;
      Object.keys( dirac.Dals ).forEach(function(tbl) {
        tx[tbl].client = null;
      });
    };

    var tx = {
      begin: function( callback ){
        if ( !client ) throwError();
        client.query( 'BEGIN', callback );
      }
    , rollback: function( callback ){
        if ( !client ) throwError();
        client.query( 'ROLLBACK', function( err ){
          if (!err) releaseClient();
          callback(err);
        });
      }
    , commit: function( callback ){
        if ( !client ) throwError();
        client.query( 'COMMIT', function( err ){
          if (!err) releaseClient();
          callback(err);
        });
      }
    };

    // Attach DALs to the tx client
    Object.keys( dirac.Dals ).forEach( function( tbl ){
      var Dal = dirac.Dals[ tbl ];
      tx[ tbl ] = new Dal( client );
      tx[ tbl ].befores = dirac.dals[ tbl ].befores;
      tx[ tbl ].afters  = dirac.dals[ tbl ].afters;
    });

    for ( var key in tx ){
      client[ key ] = tx[ key ];
    }

    return client;
  }
};

module.exports = dirac = Object.create( dirac );
EventEmitter.call( dirac );

dirac.register( require('./dirac-table') );
