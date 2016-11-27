var _ = require('lodash');
var PGPool = require('pg-pool');

var Table = require('./table');
var Query = require('./query');
var Transaction = require('./transaction');
var ClientOptions = require('./client-options');
var QueryGenerator = require('./query-generator');
var RawQueryExecutor = require('./raw-query-executor');
var createTableGraph = require('./table-graph');

class Database extends QueryGenerator {
  static create( options ){
    return new Database( options );
  }

  constructor( options = {} ){
    if ( typeof options === 'string' ){
      options = { connectionString: options };
    }

    var clientOptions = options.clientOptions || new ClientOptions( options );

    options.pool = options.pool || new PGPool( clientOptions );

    super( options );

    this.Table = options.Table || Table;
    this.Query = options.Query || Query;
    this.tables = {};
    this.clientOptions = clientOptions;
  }

  clone(){
    var options = Object.assign( {}, this.options );

    options.queryTransforms = this.queryTransforms.slice(0);
    options.resultsTransforms = this.resultsTransforms.slice(0);
    options.Table = this.Table;
    options.Query = this.Query;
    options.pool = this.pool;

    // Always share the initial pool passed in
    options.pool = this.pool;

    var tables = Object
      .keys( this.tables )
      .reduce( ( newTables, key ) => {
        // For now, don't worry about cloning
        // newTables[ key ] = this.tables[ key ].clone();
        newTables[ key ] = this.tables[ key ];
        return newTables;
      }, {} );

    var database = this.constructor.create( options );

    database.tables = tables;
    database.graph = _.cloneDeep( this.graph );
    database.clientOptions = new ClientOptions( database.clientOptions );

    for ( var key in tables ){
      database.defineGetterAndSettersForTable( tables[ key ] );
    }

    return database;
  }

  transaction(){
    return Transaction.create({ pool: this.pool, debug: this.options.debug });
  }

  table( table, TableClass ){
    TableClass = TableClass || this.Table;

    var options = this.getCreateQueryOptions();

    if ( typeof table === 'string' ){
      options.name = table;
      return TableClass.create( options );
    }

    return TableClass.create( Object.assign( options, table ) );
  }

  /**
   * Given an instanceof Table, create a new version of the table
   * with all of `this` instance's properties
   * @param  {Table} table 
   * @return {Table}
   */
  adaptTable( table ){
    return table.clone().mutate( table => {
      const options = this.getCreateQueryOptions()

      options.queryTransforms = options.queryTransforms.concat(
        table.queryTransforms
      )

      options.resultsTransforms = options.resultsTransforms.concat(
        table.resultsTransforms
      )

      table.options.debug = this.options.debug

      Object.assign( table, options )
    });
  }

  register( table ){
    var database = this.instance();

    if ( !(table instanceof Table ) ){
      table = database.table( table );
    } else {
      table = database.adaptTable( table );
    }

    database.tables[ table.name ] = table;
    database.defineGetterAndSettersForTable( table );

    database.graph = createTableGraph( database.tables );

    return database;
  }

  defineGetterAndSettersForTable( table ){
    Object.defineProperty( this, table.name, {
      get: ()=> this.tables[ table.name ]
    , set: table => this.tables[ table.name ] = table
    , enumerable: true
    });
  }

  createOrReplaceTables(){
    return this.transaction()
      .begin()
      .then( tx => {
        var createTablesQuery = this.getCreateTableAndViewList()
          .map( table => this.tables[ table ] )
          .map( table => table.create() )
          .map( query => tx.query( query ) );

        return Promise
          .all( createTablesQuery )
          .then( values => tx.commit() );
      })
  }

  // Adapted from legacy and realllly should be refactored
  getCreateTableAndViewList(){
    // Determine order that tables need to be created
    var ordered = [], column;

    // Represent the references as a directed acyclic graph
    var graph = Object
      .keys( this.graph )
      .reduce( ( g, table )=>{
        g[ table ] = {
          dependencies: Object.keys( this.graph[ table ].dependencies )
        , incoming: Object.keys( this.graph[ table ].dependents )
        };

        return g;
      }, {} );

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

    var treeIsCyclic = Object
      .keys( graph )
      .filter( table => {
        return graph[ table ].incoming.length > 0 || graph[ table ].dependencies.length > 0;
      }).length > 0;

    if ( treeIsCyclic ){
      throw new CyclicDependencyError();
    }

    return ordered;
  }
}

Object.assign( Database.prototype, RawQueryExecutor );

// Setup getters/setters for ClientOptions
ClientOptions.props.forEach( prop => {
  Database.prototype[ prop ] = function( val ){
    if ( val === undefined ){
      return this.clientOptions[ prop ];
    }

    var this_ = this.instance();
    this_.clientOptions[ prop ] = val;
    this_.pool.options[ prop ] = val;
    return this_;
  }
});

module.exports = Database;

class CyclicDependencyError extends Error {
  constructor(){
    super('Dependency tree is cyclic');
  }
}