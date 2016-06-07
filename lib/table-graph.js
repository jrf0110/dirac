/**
 * Returns an object keyed by table name with links to
 * dependents and dependencies with the following structure:
 * Graph {
 *   [Table.name]: {
 *     dependents: {
 *       [Table.name]: {
 *         [FromColumn]: 'ToColumn'
 *       }
 *     }
 *     dependencies: {
 *       [Table.name]: {
 *         [FromColumn]: 'ToColumn'
 *       }
 *     }
 *   }
 *   ...
 * }
 *
 * NOTE:
 * This is some old somewhat janky code. Could probably use a re-write.
 * It should be used for calculated the sorting for creating tables and
 * for use in the relationships middleware (should also be re-written);.
 * 
 * @param  {Object} tables An object of table instances keyed by table name
 * @return {TableGraph}    The graph of tables
 */
module.exports = tables => {
  var graph = {};

  for ( var key in tables ){
    graph[ key ] = {
      dependents: {}
    , dependencies: {}
    };
  }

  Object
    .keys( tables )
    // Filter down to dals whose schema contains a `references` key
    .filter( table_name => {
      var table = tables[ table_name ];

      return Object
        .keys( table.schema )
        .some( col_name => {
          return table.schema[ col_name ].references;
        });
    })
    .forEach( table_name => {
      var table = tables[ table_name ];
      var source = graph[ table_name ];

      Object
        .keys( table.schema )
        .filter( function( col_name ){
          return table.schema[ col_name ].references;
        })
        .forEach( col_name => {
          var col = table.schema[ col_name ];
          var target = graph[ col.references.table ];

          if ( !target.dependents[ table_name ] ){
            target.dependents[ table_name ] = {};
          }

          if ( !source.dependencies[ col.references.table ] ){
            source.dependencies[ col.references.table ] = {};
          }

          target.dependents[ table_name ][ col.references.column ] = col_name;
          source.dependencies[ col.references.table ][ col_name ] = col.references.column;
        });
    });

  return graph;
};