var
  db    = module.exports = {}
, async = require('async')
, DAL   = require('./dal')
;

db.DAL = DAL;

db.dals = {};

db.init = function(options, callback){
  if (typeof options == 'function'){
    callback = options;
    options = {};
  }

  options = options || {};
  callback = callback || function(){};

  db.client = new pg.Client(options.connStr);

  return db.client.connect(function(error){
    if (error) return callback ? callback(error) : null;

    db.dirac.createIfNotExists(function(error){
      if (error && callback) return callback(error);
      if (error) throw error;

      if (callback) callback();
    })
  });
};

db.query = pg.query;

/**
 * The premise here is to query the dirac_schemas table for previous schemas
 * compare those schemas against what's loaded in memory and determine the
 * required SQL to get the database in the correct state.
 * with test as (select max(val) as max from vals) select vals.* from vals, test where val = test.max;
 */

db.sync = function(callback){
  db.dals.dirac.createIfNotExists(function(error){
    if (error && callback) return callback(error);
    if (error) throw error;

    db.createTables(function(error){

      if (error && callback) return callback(error);
      if (error) throw error;

      var $latestVersionQuery = {
        type: 'select'
      , table: 'dirac_schemas'
      , columns: [ 'max(version) as latest' ]
      };

      var $query = {
        type:     'select'
      , table:    ['dirac_schemas', 'versions']
      , columns:  ['dirac_schemas.*']
      , with:     { versions: $latestVersionQuery }
      , where:    { version: '$versions.latest$' }
      };

      db.dirac.query($query, function(error, results){
        if (error && callback) callback(error);
        if (error) throw error;
        if (results.length == 0) return db.saveCurrentDbState(1, callback);

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
        for (var key in db.dals){
          if (key == 'dirac') continue;
          newDb[key] = db.dals[key].schema;
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
              db.dirac.query($alter, function(error){
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

            db.dirac.query($alter, function(error){
              if (error) return console.log("ERROR ALTERING COLUMN", error);
            });
          }
        }

        db.saveCurrentDbState(++version, callback);
      });
    });
  });
};

db.saveCurrentDbState = function(version, callback){
  var fns = [];
  for (var key in db.dals){
    (function(table){
      fns.push(function(done){
        db.dirac.insert({
          tableName: table
        , version: version
        , schema: JSON.stringify(db.dals[table].schema)
        }, done);
      });
    })(key);
  }
  async.parallel(fns, callback);
};

db.createTables = function(callback){
  // Determine order that tables need to be created
  var fns = [], ordered = [], column;

  // Represent the references as a directed acyclic graph
  var graph = {};

  for (var table in db.dals){
    if (table == 'dirac') continue;

    graph[table] = {
      dependencies: []
    , incoming:     []
    };
  }

  for (var table in graph){
    for (var col in db.dals[table].schema){
      column = db.dals[table].schema[col];

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

  var fns = [];
  for (var i = 0; i < ordered.length; i++){
    (function(table){
      fns.push( function(done){
        db.dals[table].createIfNotExists(function(error, results){ done(error, results) });
      });
    })(ordered[i]);
  }
  async.parallel(fns, callback);
};

db.dropAllTables = function(callback){
  var fns = [];
  for (var key in db.dals){
    if (key == 'dirac') continue;
    (function(table){
      fns.push( function(done){
        db[table].dropTable({ cascade: true }, done);
      });
    })(key);
  }
  async.parallel(fns, callback);
};

db.register = function(definition){
  if ( !('name' in definition) )
    throw new Error('Dirac.register `name` required in definition');

  if ( !('schema' in definition) )
    throw new Error('Dirac.register `schema` required in definition');

  return db.dals[ definion.name ] = new db.DAL( definition );
};

db.register( require('./dirac-table') );