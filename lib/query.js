var pg = require('pg');
var _ = require('lodash');
var pg = require('pg');
var QueryTransform = require('./query-transform');
var RawQueryExecutor = require('./raw-query-executor');
var QueryBase = require('./query-base');

class Query extends QueryBase {
  static create( query, options ){
    return new this( query, options );
  }

  constructor( query = {}, options = {} ){
    super( options );

    this.mosqlQuery = query;

    this.options = _.defaults( options, {
      immutable: true
    });

    this.connectionString = this.options.connectionString;
    this.mosql = this.options.mosql;
    this.queryTransforms = this.options.queryTransforms || [];
    this.resultsTransforms = this.options.resultsTransforms || [];
  }

  getClient(){
    return new Promise( ( resolve, reject )=>{
      if ( typeof this.connectionString !== 'string' ){
        throw new MissingConnectionStringError('.getClient()');
      }

      pg.connect( this.connectionString, ( error, client, done )=>{
        if ( error ){
          return reject( error );
        }

        client.release = done;

        resolve( client );
      });
    });
  }

  execute(){
    var query;

    try {
      query = this.toStringAndValues()
    } catch ( e ){
      return Promise.reject( e );
    }

    return this
      .raw( query.toString(), query.values )
      .then( results => this.getTransformedResult( results ) );
  }

  clone(){
    var options = Object.assign( {}, this.options );
    options.queryTransforms = this.queryTransforms.slice(0);

    return this.constructor.create( _.cloneDeep( this.mosqlQuery ), options );
  }

  where( key, val ){
    if ( key === undefined ){
      return this.mosqlQuery.where;
    }

    if ( typeof key === 'string' && val === undefined ){
      return _.get( this.mosqlQuery.where, key );
    }

    var query = this.instance();

    // If the underlying query did not already have a `where` clause
    if ( !query.mosqlQuery.where ){
      query.mosqlQuery.where = {};
    }

    if ( typeof key === 'string' ){
      _.set( query.mosqlQuery.where, key, val );
    } else {
      Object.assign( query.mosqlQuery.where, key );
    }

    return query;
  }

  columns( column ){
    if ( !column ){
      return this.mosqlQuery.columns;
    }

    var query = this.instance();

    if ( !Array.isArray( query.mosqlQuery.columns ) ){
      query.mosqlQuery.columns = [];
    }

    query.mosqlQuery.columns.push( column );

    return query;
  }

  with( withQuery ){
    if ( !withQuery ){
      return this.mosqlQuery.with;
    }

    if ( withQuery instanceof Query ){
      withQuery = withQuery.mosqlQuery;
    }

    var query = this.instance();

    if ( !Array.isArray( query.mosqlQuery.with ) ){
      query.mosqlQuery.with = [];
    }

    query.mosqlQuery.with.push( withQuery );

    return query;
  }

  getTransformedResult( rows ){
    return this.resultsTransforms.reduce( ( result, transform )=>{
      return transform.execute( result );
    }, rows );
  }

  getTransformedQuery(){
    if ( this.queryTransforms.length === 0 ){
      return this;
    }

    return this.clone().mutate( query => {
      query.queryTransforms = [];
      this.queryTransforms.forEach( transform => transform.handler( query ) );
    });
  }

  toStringAndValues(){
    if ( !this.mosql ){
      throw new Error('Cannot serialize a query without a MongoSQL instance');
    }

    return this.mosql.sql( this.getTransformedQuery().mosqlQuery );
  }
}

Query.standardGettersAndSetters = [
  'type', 'table', 'action', 'alias', 'cascade'
, 'definition', 'distinct', 'expression', 'for'
, 'from', 'groupBy', 'having', 'limit', 'offset'
, 'only', 'order', 'over', 'partition', 'queries'
, 'updates', 'values', 'view'
];

Query.standardGettersAndSetters.forEach( key => {
  Query.prototype[ key ] = function( value ){
    if ( value === undefined ){
      return this.mosqlQuery[ key ];
    }

    var query = this.instance();
    query.mosqlQuery[ key ] = value;

    return query;
  };
});


['raw', 'getClient'].forEach( k => {
  Query.prototype[ k ] = RawQueryExecutor.prototype[ k ];
});

module.exports = Query;