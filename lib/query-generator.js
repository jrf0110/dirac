const _ = require('lodash');
const mosql = require('mongo-sql');
const QueryBase = require('./query-base');
const Query = require('./query');

class QueryGenerator extends QueryBase {
  constructor( options = {} ){
    super( options );
    this.Query = options.Query || Query;
  }

  query( query, customOptions ){
    var options = this.getCreateQueryOptions();

    if ( typeof customOptions === 'object' ){
      Object.assign( options, customOptions );
    }

    return this.Query.create( query, options );
  }

  stream( query, customOptions ){
    var options = this.getCreateQueryOptions();

    if ( typeof customOptions === 'object' ){
      Object.assign( options, customOptions );
    }

    return new QueryStream( query, options );
  }

  clone(){
    var options = Object.assign( {}, this.options );
    options.queryTransforms = this.queryTransforms.slice(0);
    options.resultsTransforms = this.resultsTransforms.slice(0);

    return QueryGenerator.create( options );
  }

  getCreateQueryOptions(){
    return {
      pool:               this.pool
    , mosql:              this.mosql
    , queryTransforms:    this.queryTransforms.slice(0)
    , resultsTransforms:  this.resultsTransforms.slice(0)
    , Query:              this.Query
    , debug:              this.options.debug
    };
  }
}

module.exports = QueryGenerator;