/**
 * DB Middleware: Cast to JSON
 * Automatically stringifies fields
 *
 * By default, the options are:
 *
 *  {
 *    operations: ['insert', 'update']
 *  , types: ['json']
 *  }
 *
 *  var dirac = require('dirac');
 *
 *  dirac.use( dirac.castToJSON({
 *    operations: ['insert', 'update', 'myCustomUpdateFunction']
 *  , types: ['json', 'my-special-json-type']
 *  }));
 */

var castToJSON = function( field ){
  var applyField = function( obj ){
    if ( typeof (obj || {})[ field ] == 'object' ){
      obj[ field ] = JSON.stringify( obj[ field ] );
    }
  };

  return function( $query, schema, next ){
    if ( $query.updates ) applyField( $query.updates );

    if ( Array.isArray( $query.values ) ){
      $query.values.forEach( applyField );
    } else if ( $query.values ){
      applyField( $query.values );
    }

    next();
  };
};

module.exports = function( options ){
  options = options || {};

  var defaults = {
    types: ['json']
  , operations: ['insert', 'update']
  };

  for ( var key in defaults ){
    if ( !(key in options) ) options[ key ] = defaults[ key ];
  }

  var passesTypeCheck = function( dal, col ){
    col = dal.schema[ col ];
    return options.types.indexOf( col.type ) > -1;
  };

  return function( dirac ){
    // Filter down to dals that pass `options.type`
    Object.keys( dirac.dals ).filter( function( dal ){
      dal = dirac.dals[ dal ];

      return Object.keys( dal.schema ).some( function( col ){
        return passesTypeCheck( dal, col );
      });

    // Convert to structure with columns to cast
    }).map( function( dal ){
      dal = dirac.dals[ dal ];

      return {
        dal: dal
      , columns: Object.keys( dal.schema ).filter( function( col ){
          return passesTypeCheck( dal, col );
        })
      };

    // Each object, each operation, each field, apply middleware
    }).forEach( function( obj ){
      options.operations.forEach( function( op ){
        obj.columns.forEach( function( col ){
          obj.dal.before( op, castToJSON( col ) );
        });
      });
    });
  };
};