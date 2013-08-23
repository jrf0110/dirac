var
  dirac       = module.exports = {}
, pg          = require('pg')
, utils       = require('./utils')
, DAL         = require('./dal')
, diracSchema = require('./dirac-table')
;

dirac.DAL = DAL;

dirac.dals = {};

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

  dirac.register( diracSchema );
};

dirac.destroy = function(){
  Object.keys( dirac.dals ).forEach( dirac.unregister );
  delete dirac.options;
};

/**
 * The premise here is to query the dirac_schemas table for previous schemas
 * compare those schemas against what's loaded in memory and determine the
 * required SQL to get the database in the correct state.
 * with test as (select max(val) as max from vals) select vals.* from vals, test where val = test.max;
 */

dirac.sync = function(options, callback){
  if ( typeof options == 'function' ){
    callback = options;
    options = {};
  }

  // dirac.dals.dirac_schemas.createIfNotExists(function(error){
  //   if (error && callback) return callback(error);
  //   if (error) throw error;

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
                if (error && callback) callback(error);
                if (error) throw error;
              });
              continue;
            }

            $alter.action = { alterColumn: {} };

            oldColumn = currentDb[table][columnName];

            // Inspect column attributes
            for (var attr in newColumn){
              // Attribute has not existed before
              if (!(attr in oldColumn)){
                $alter.action.alterColumn[attr] = newColumn[attr];

              } else {
                // The attribe did exist before
                //   so check for known attributes we can change

                // Primary Key
                // if (
                //   attr == 'primaryKey' &&
                //   newColumn.primaryKey != oldColumn.primaryKey
                // ) $alter.action.alterColumn.primaryKey = newColumn.primaryKey;
              }
            }

            // No change made, do not query
            if (Object.keys($alter.action.alterColumn).length == 0)
              continue;

            $alter.action.alterColumn.name = columnName;

            dirac.dals.dirac_schemas.query($alter, function(error){
              if (error) return console.log("ERROR ALTERING COLUMN", error);
            });
          }
        }

        dirac.saveCurrentDbState(++version, callback);
      });
    });
  // });
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
    if (table == 'dirac') continue;

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
  var table;
  while (table = notDependedOn.pop()){
    ordered.unshift( table );

    // Table has no dependencies, so it doesn't matter
    // where it is
    if (graph[table].dependencies.length == 0) continue;

    // Remove edges from table to dependencies
    var node;
    while ( graph[table].dependencies.length > 0 ){
      node = graph[table].dependencies.pop();
      graph[node].incoming = graph[node].incoming.filter(function(t){
        return t != table;
      });

      if ( graph[node].incoming.length == 0 )
        ordered.unshift( node );
    }
  }

  utils.series(
    ordered.map( function( table ){
      return function( done ){
        dirac.dals[table].createIfNotExists( done );
      }
    })
  , callback
  );
};

dirac.dropAllTables = function(callback){
  utils.series(
    Object.keys( dirac.dals ).map( function( table ){
      return function( done ){
        if ( table == 'dirac' ) return done();
        db[table].dropTable({ cascade: true }, done);
      }
    })
  , callback
  );
};

dirac.register = function(definition){
  if ( !('name' in definition) )
    throw new Error('Dirac.register `name` required in definition');

  if ( !('schema' in definition) )
    throw new Error('Dirac.register `schema` required in definition');

  var DAL = dirac.DAL.extend( definition );

  return dirac.dals[
    definition.alias || definition.name
  ] = new DAL( dirac.options.connString, definition );
};

dirac.unregister = function(name){
  delete dirac.dals[ name ];
};

dirac.query = function( query, values, callback ){
  if ( typeof values == 'function' ){
    callback = values;
    values = [];
  }

  callback = callback || utils.noop;

console.log("A", query, values)
  pg.connect( dirac.options.connString, function( error, client, done ){
    console.log("B")
    if (error) return callback( error );

    client.query( query, values, function( error, result ){
      console.log("C")
      done();

      callback( error, result );
    });
  });
};