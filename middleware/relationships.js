module.exports = function( dirac ){
  // Extend the DAL to add necessary dependents/dependencies cache
  // Setup cached dependency graph for use by relationship helpers
  var init = dirac.DAL.prototype.initialize;
  dirac.DAL = dirac.DAL.extend({
    initialize: function(){
      this.dependents   = {};
      this.dependencies = {};
      return init.apply( this, arguments );
    }
  });

  // Cache incoming/outgoing dependencies
  dirac.use( function( dirac ){
    // Filter down to dals whose schema contains a `references` key
    Object.keys( dirac.dals ).filter( function( table_name ){
      var dal = dirac.dals[ table_name ];

      return Object.keys( dal.schema ).some( function( col_name ){
        return dal.schema[ col_name ].references;
      });
    }).forEach( function( table_name ){
      var dal = dirac.dals[ table_name ];

      Object.keys( dal.schema ).filter( function( col_name ){
        return dal.schema[ col_name ].references;
      }).forEach( function( col_name ){
        var col = dal.schema[ col_name ];
        var target = dirac.dals[ col.references.table ];

        if ( !target.dependents[ table_name ] ){
          target.dependents[ table_name ] = {};
        }

        if ( !dal.dependencies[ col.references.table ] ){
          dal.dependencies[ col.references.table ] = {};
        }

        target.dependents[ table_name ][ col.references.column ] = col_name;
        dal.dependencies[ col.references.table ][ col_name ] = col.references.column;
      });
    });
  });

  dirac.use( function( dirac ){
    var options = {
      operations: ['find', 'findOne']
    , pluginName: 'many'
    , tmpl: function( data ){
        return [
          '(select array_to_json( array('
        , '  select row_to_json( r ) '
        , '  from ' + data.target + ' r'
        , ' where ' + data.pivots.map( function( p ){
                        return 'r."' + p.target_col + '" = "' + data.source + '"."' + p.source_col + '"';
                      }).join(' and ')
        , ')) as ' + data.alias + ')'
        ].join('\n')
      }
    };

    Object.keys( dirac.dals ).forEach( function( table_name ){
      var dal = dirac.dals[ table_name ];

      options.operations.forEach( function( op ){
        dal.before( op, function( $query, schema, next ){
          if ( !Array.isArray( $query[ options.pluginName ] ) ) return next();

          $query[ options.pluginName ].forEach( function( target ){
            var targetDal = dirac.dals[ target.table ];

            if ( !targetDal.dependencies[ table_name ] ){
              throw new Error( 'Table: `' + target.table + '` does not depend on `' + table_name + '`' );
            }

            var pivots = Object.keys( targetDal.dependencies[ table_name ] ).map( function( p ){
              return {
                source_col: targetDal.dependencies[ table_name ][ p ]
              , target_col: p
              };
            });

            var col = options.tmpl({
              source:     table_name
            , target:     target.table
            , alias:      target.alias || target.table
            , pivots:     pivots
            });

            if ( !$query.columns ){
              $query.columns = ['*'];
            }

            $query.columns.push( col );
          });

          next();
        });
      });
    });
  });

  dirac.use( function( dirac ){
    var options = {
      operations: ['find', 'findOne']
    , pluginName: 'one'
    , tmpl: function( data ){
        return [
          '(select row_to_json( r ) '
        , '  from ' + data.target + ' r'
        , 'where ' + data.pivots.map( function( p ){
                        return 'r."' + p.target_col + '" = "' + data.source + '"."' + p.source_col + '"';
                      }).join(' and ')
        , 'limit 1'
        , ') as ' + data.alias
        ].join('\n')
      }
    };

    Object.keys( dirac.dals ).forEach( function( table_name ){
      var dal = dirac.dals[ table_name ];

      options.operations.forEach( function( op ){
        dal.before( op, function( $query, schema, next ){
          if ( !Array.isArray( $query[ options.pluginName ] ) ) return next();

          $query[ options.pluginName ].forEach( function( target ){
            var targetDal = dirac.dals[ target.table ];

            if ( !targetDal.dependents[ table_name ] ){
              throw new Error( 'Table: `' + target.name + '` does not depend on `' + table_name + '`' );
            }

            var pivots = Object.keys( targetDal.dependents[ table_name ] ).map( function( p ){
              return {
                source_col: targetDal.dependents[ table_name ][ p ]
              , target_col: p
              };
            });

            var col = options.tmpl({
              source:     table_name
            , target:     target.table
            , alias:      target.alias || target.table
            , pivots:     pivots
            });

            if ( !$query.columns ){
              $query.columns = ['*'];
            }

            $query.columns.push( col );
          });

          next();
        });
      });
    });
  });
};

module.exports.__immediate = true;