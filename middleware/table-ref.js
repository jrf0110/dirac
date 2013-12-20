/**
 * Dirac Table Referencing -
 * Automatically use a column for table references in schemas.
 *
 * {
 *   name: 'groups'
 * , definition: {
 *     id:    { type: 'serial', primaryKey: true }
 *   , name:  { type: 'text' }
 *   , uid:   { type: 'integer', references: { table: 'users' } }
 *   }
 * }
 */

var defaults = {
  column: 'id'
};

module.exports = function( options ){
  options = options || {};

  for ( var key in defaults ){
    if ( key in options ) continue;
    options[ key ] = defaults[ key ];
  }

  return function( dirac ){
    // Adds default column ref to col
    var addColumnRef = function( dal, col ){
      var column = dirac.dals[ dal ].schema[ col ];
      if ( !('references' in column) ) return;
      if ( typeof column.references !== 'object' || 'column' in column.references ) return;

      column.references.column = options.column;
    };

    // Adds default column refs to dal
    var addRefs = function( dal ){
      Object.keys( dirac.dals[ dal ].schema ).forEach( function( col ){
        addColumnRef( dal, col );
      });
    };

    Object.keys( dirac.dals ).forEach( addRefs );
  };
};