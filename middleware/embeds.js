/**
 * Dirac Embeds
 * Helps facilitate embedding foreign objects
 *
 * options: {
 *   // The methods to apply `after` filters to for embeds
 *   operations: ['findOne']
 * }
 *
 * How to use:
 * dirac.register({
 *   name: 'user'
 * , schema: {
 *     id:    { type: 'serial', primaryKey: true }
 *   , name:  { type: 'text' }
 *   }
 *
 * , defaultEmbeds: {
 *     groups: true
 *   }
 *
 *   // Describes how to embed foreign tables
 * , embeds: {
 *     // Naive example, but shows how to use it
 *     groups: function( results, $query, callback ){
 *       if ( results.length === 0 ) return callback();
 *
 *       dirac.dals.groups.find({ user_id: results[0].id }, callback );
 *     }
 *   }
 * });
 */

var async = require('async');
var _     = require('lodash');

module.exports = function( options ){
  options = options || {};

  var defaults = {
    operations: ['findOne']
  };

  for ( var key in defaults ){
    if ( !(key in options) ) options[ key ] = defaults[ key ];
  }

  return function( dirac ){
    var embedFn = function( table ){
      var dal = dirac.dals[ table ];

      return function( results, $query, schema, next ){
        if ( !dal ) return next();
        if ( !('embeds' in dal ) ) return next();

        var key;

        if ( typeof !$query.embeds && !dal.defaultEmbeds ){
          return next();
        }

        $query.embeds = $query.embeds || {};

        _.defaults( $query.embeds, dal.defaultEmbeds );

        // Filter down to embeds that we can run
        var keys = Object.keys( $query.embeds ).filter( function( key ){
          return key in dal.embeds;
        });

        var fns = keys.map( function( key ){
          return function( done ){
            dal.embeds[ key ]( results, $query, done );
          };
        });

        fns = _.object( keys, fns );

        async.parallel( fns, function( error, result ){
          if ( error ) return next( error );

          // Copy embed results to each original result item
          for ( var i = 0, l = results.length; i < l; ++i ){
            for ( var key in result ){
              results[ i ][ key ] = result[ key ];
            }
          }

          next();
        });
      };
    };

    // Filter down to dals that have embeds
    Object.keys( dirac.dals ).filter( function( dal ){
      return 'embeds' in dirac.dals[ dal ];
    // Register embedFn
    }).forEach( function( table ){
      options.operations.forEach( function( op ){
        dirac.dals[ table ].after( op, embedFn( table ) );
      });
    });
  };
};