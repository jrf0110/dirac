/**
 * Maybe rename to this to Transformable since it mainly handles 
 * query transforms
 */

const _ = require('lodash');
const mosql = require('mongo-sql');
const Immutable = require('./immutable');
const QueryTransform = require('./query-transform');
const ResultTransform = require('./result-transform');

class QueryBase extends Immutable {
  static create( options ){
    return new this( options );
  }

  constructor( options = {} ){
    super( options );
    this.options = options;
    this.connectionString = options.connectionString;
    this.mosql = options.mosql || mosql;
    this.queryTransforms = options.queryTransforms || [];
    this.resultsTransforms = options.resultsTransforms || [];
  }

  clone(){
    var options = Object.assign( {}, this.options );
    options.queryTransforms = this.queryTransforms.slice(0);
    options.resultsTransforms = this.resultsTransforms.slice(0);

    return QueryBase.create( options );
  }

  use( middleware ){
    if ( middleware instanceof QueryTransform ){
      return this.before( middleware );
    } else if ( middleware instanceof ResultTransform ){
      return this.after( middleware );
    } else if ( typeof middleware === 'function' ){
      return middleware( this );
    }

    throw new InvalidTransformError();
  }

  before( transform ){
    // If providing an array of transforms, do not clone query for each
    if ( Array.isArray( transform ) ){
      return this.instance().mutate( query => {
        transform.forEach( t => query.before( t ) );
      });
    }

    if ( typeof transform === 'function' ){
      transform = QueryTransform.create( transform );
    }

    if ( !(transform instanceof QueryTransform) ){
      throw new InvalidTransformError('QueryTransform');
    }

    var this_ = this.instance();
    this_.queryTransforms.push( transform );

    return this_;
  }

  after( transform ){
    // If providing an array of transforms, do not clone query for each
    if ( Array.isArray( transform ) ){
      return this.instance().mutate( query => {
        transform.forEach( t => query.after( t ) );
      });
    }

    if ( typeof transform === 'function' ){
      transform = ResultTransform.create( transform );
    }

    if ( !(transform instanceof ResultTransform) ){
      throw new InvalidTransformError('ResultTransform');
    }

    var this_ = this.instance();
    this_.resultsTransforms.push( transform );

    return this_;
  }
}

class InvalidTransformError extends Error {
  constructor( type ){
    if ( !type ){
      super('Invalid Transform type');
    } else {
      super(`Transform must be either a "Function" or "${type}"`);
    }
  }
}

QueryBase.InvalidTransformError = InvalidTransformError;

module.exports = QueryBase;