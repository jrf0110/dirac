var _ = require('lodash');
var mosql = require('mongo-sql');
var PGPool = require('pg-pool');
var PGQueryStream = require('pg-query-stream');
var QueryTransform = require('./query-transform');
var RawQueryExecutor = require('./raw-query-executor');
var QueryBase = require('./query-base');
var QueryDebugger = require('./query-debugger');
var Errors = require('./errors');

class Query extends QueryBase {
  static create( query, options ){
    return new this( query, options );
  }

  static getUpsertUpdateFromObject( values ){
    return Object
      .keys( Array.isArray( values ) ? values[0] : values )
      .reduce( (result, k) => {
        if ( typeof values[ k ] === 'string' ){
          result[ k ] = `$excluded.${this.mosql.quoteObject(k)}`;
        } else {
          result[ k ] = values[ k ];
        }

        return result;
      }, {});
  }

  static getDedupedQueryObj(mobj) {
    var dedupedValues = mobj.values
      .filter((v, i, values) => {
        return values.indexOf(v, i + 1) === -1
      }, [])

    var sourceMap = mobj.values
      .reduce((obj, v, i) => {
        obj[i] = dedupedValues.indexOf(v)
        return obj
      }, {})

    var queryStr = mobj.query
      .replace(QueryDebugger.regex.value, match => {
        const targetIdx = +match.substring(1) - 1
        const resultIdx = sourceMap[targetIdx]
        const wasChanged = resultIdx !== undefined && resultIdx !== -1
        return `$${(wasChanged ? resultIdx : targetIdx) + 1}`
      })

    return {
      query: queryStr,
      values: dedupedValues,
      original: mobj,
      toString: () => queryStr,
      toQuery: () => {
        return { text: queryStr, values: dedupedValues }
      },
    }
  }

  constructor( query = {}, options = {} ){
    super( options );
    this.mosqlQuery = query;
  }

  execute(){
    if ( !this.pool ){
      throw new Errors.MissingPool();
    }

    var query;

    try {
      query = this.toStringAndValues()
    } catch ( e ){
      return Promise.reject( e );
    }

    var qdebugger;

    // Instantiate qdebugger here so we get the beginning time
    if ( this.options.debug ){
      qdebugger = new QueryDebugger( query.toString(), query.values );
    }

    return this.pool
      .query( query.toString(), query.values )
      .catch( e => {
        // If there was an error, we still want to log
        if ( this.options.debug ){
          qdebugger.log();
          qdebugger.end(e);
        }

        // But we need to re-throw to force the consumer to handle
        throw e;
      })
      .then( result => {
        if ( this.options.debug ){
          qdebugger.log();
          qdebugger.end();
        }

        return result;
      })
      .then( result => this.getTransformedResult( result.rows ) )
  }

  stream(){
    var query;
    var qdebugger;

    try {
      query = this.toStringAndValues()

      // Instantiate qdebugger here so we get the beginning time
      if ( this.options.debug ){
        qdebugger = new QueryDebugger( query.toString(), query.values );
      }

      query = new PGQueryStream( query.toString(), query.values );
    } catch ( e ){
      return Promise.reject( e );
    }

    return this.pool.connect()
      .then( client => {
        var stream = client.query( query );
        if ( this.options.debug ){
          stream.once( 'data', ()=> {
            qdebugger.log();
            qdebugger.end();
          });
        }
        stream.once( 'end', ()=> client.release );
        return stream;
      });
  }

  clone(){
    var options = Object.assign( {}, this.options );

    options.queryTransforms = this.queryTransforms.slice(0);
    options.resultsTransforms = this.resultsTransforms.slice(0);

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

    if (Array.isArray(column)) {
      query.mosqlQuery.columns = column;
    } else {
      query.mosqlQuery.columns.push( column );
    }

    return query;
  }

  groupBy( value ){
    if ( !value ){
      return this.mosqlQuery.groupBy;
    }

    var query = this.instance();

    if ( !Array.isArray( query.mosqlQuery.groupBy ) ){
      query.mosqlQuery.groupBy = [];
    }

    if (Array.isArray(value)) {
      query.mosqlQuery.groupBy = value;
    } else {
      query.mosqlQuery.groupBy.push( value );
    }

    return query;
  }

  returning( column ){
    if ( !column ){
      return this.mosqlQuery.returning;
    }

    var query = this.instance();

    if ( !Array.isArray( query.mosqlQuery.returning ) ){
      query.mosqlQuery.returning = [];
    }

    query.mosqlQuery.returning.push( column );

    return query;
  }

  joins( join ){
    if ( !join ){
      return this.mosqlQuery.joins;
    }

    var query = this.instance();

    if ( !Array.isArray( query.mosqlQuery.joins ) ){
      query.mosqlQuery.joins = [];
    }

    if ( !join.type ){
      join.type = 'left';
    }

    query.mosqlQuery.joins.push( join );

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

  values( values ){
    if ( values === undefined ){
      return this.mosqlQuery.values;
    }

    var query = this.instance();
    query.mosqlQuery.values = values;

    // If conflict specified the same values as the insert
    // then go ahead and update the conflict resolution
    // if ( typeof query.conflict === 'object' && [null, undefined].indexOf( query.conflict ) === -1 )
    // if ( _.get( this.mosqlQuery, 'conflict.action.update') === this.mosqlQuery.values ){
    //   query.mosqlQuery.conflict.action.update = values;
    // }

    return query;
  }

  getTransformedResult( rows ){
    return this.resultsTransforms.reduce( ( result, transform )=>{
      return transform.execute( result, this );
    }, rows );
  }

  getTransformedQuery(){
    if ( this.queryTransforms.length === 0 ){
      return this;
    }

    return this.queryTransforms
      .reduce(
        ( query, transform ) => transform.handler( query )
      , this.clone().mutate(query => query.queryTransforms = [])
      )

    return this.clone().mutate( query => {
      this.queryTransforms.forEach( transform => transform.handler( query ) );
    });
  }

  toStringAndValues(){
    if ( !this.mosql ){
      throw new Error('Cannot serialize a query without a MongoSQL instance');
    }

    return Query.getDedupedQueryObj(
      this.mosql.sql( this.getTransformedQuery().mosqlQuery )
    );
  }
}

Query.standardGettersAndSetters = [
  'type', 'table', 'action', 'alias', 'cascade'
, 'definition', 'distinct', 'expression', 'for'
, 'from', 'having', 'limit', 'offset'
, 'only', 'order', 'over', 'partition', 'queries'
, 'updates', 'view', 'conflict'
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