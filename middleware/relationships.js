var utils       = require('lodash');
var mosqlUtils  = require('mongo-sql/lib/utils');

module.exports = function( options ){
  var relationships = function( dirac ){
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

    // Push to bottom of stack
    dirac.use( function( dirac ){
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

      // Cache incoming/outgoing dependencies
      dirac.use( function( dirac ){
        var applyOne = function( table_name, $query ){
          var tmpl = function( data ){
            var where = utils.extend( {}, data.where );

            data.pivots.forEach( function( p ){
              where[ p.target_col ] = '$' + mosqlUtils.quoteObject( p.source_col, data.source ) + '$';
            });

            var main = utils.extend({
              type:     'select'
            , table:    data.target
            , alias:    data.qAlias
            , where:    where
            , limit:    1
            }, utils.omit( data, ['table', 'alias', 'pivots', 'target', 'source', 'where'] ));

            if ( Array.isArray( main.one ) ){
              main.one.forEach( function( t ){ t.qAlias = t.qAlias || (data.qAlias + 'r'); });
              applyOne( main.table, main );
            }

            if ( Array.isArray( main.many ) ){
              main.many.forEach( function( t ){ t.qAlias = t.qAlias || (data.qAlias + 'r'); });
              applyMany( main.table, main );
            }

            if ( Array.isArray( main.pluck ) ){
              main.pluck.forEach( function( t ){ t.qAlias = t.qAlias || (data.qAlias + 'r'); });
              applyPluck( main.table, main );
            }

            if ( Array.isArray( main.mixin ) ){
              main.mixin.forEach( function( t ){ t.qAlias = t.qAlias || (data.qAlias + 'r'); });
              applyMixin( main.table, main );
            }

            return {
              type: 'expression'
            , alias: data.alias
            , expression: {
                parenthesis: true
              , expression: {
                  type: 'select'
                , columns: [{ type: 'row_to_json', expression: data.qAlias }]
                , table: main
                }
              }
            };
          };

          $query.one.forEach( function( target ){
            var targetDal = dirac.dals[ target.table ];

            // Immediate dependency not met and not specifying how to get there
            if ( !targetDal && !target.where ){
              throw new Error( 'Must specify how to relate table `' + table_name + '` to target `' + target.table + '`' );
            }

            var pivots = [];

            if ( targetDal )
            if ( targetDal.dependents[ table_name ] ){
               pivots = Object.keys( targetDal.dependents[ table_name ] ).map( function( p ){
                return {
                  source_col: targetDal.dependents[ table_name ][ p ]
                , target_col: p
                };
              });
            }

            var context = utils.extend({
              source:     target.source || table_name
            , target:     target.table
            , alias:      target.alias || target.table
            , pivots:     pivots
            , qAlias:     'r'
            }, target );

            context.alias = context.alias || target.table;

            if ( !$query.columns ){
              $query.columns = ['*'];
            }

            $query.columns.push( tmpl( context ) );
          });
        };

        var applyMixin = function( table_name, $query ){
          console.log('applyMixin', table_name);
          var cid = 1;
          var tmpl = function( data ){
            var where = utils.extend( {}, data.where );
            var on = utils.extend( {}, data.on );

            data.pivots.forEach( function( p ){
              where[ p.target_col ] = on[ p.target_col ] = '$' + mosqlUtils.quoteObject( p.source_col, data.source ) + '$';
            });

            var main = utils.extend({
              type:     'select'
            , table:    data.target
            , alias:    data.qAlias
            , where:    where
            , limit:    1
            }, utils.omit( data, ['table', 'alias', 'pivots', 'target', 'source', 'where', 'on'] ));

            if ( Array.isArray( main.one ) ){
              main.one.forEach( function( t ){ t.qAlias = t.qAlias || (data.qAlias + 'r'); });
              applyOne( main.table, main );
            }

            if ( Array.isArray( main.many ) ){
              main.many.forEach( function( t ){ t.qAlias = t.qAlias || (data.qAlias + 'r'); });
              applyMany( main.table, main );
            }

            if ( Array.isArray( main.pluck ) ){
              main.pluck.forEach( function( t ){ t.qAlias = t.qAlias || (data.qAlias + 'r'); });
              applyPluck( main.table, main );
            }

            if ( Array.isArray( main.mixin ) ){
              main.mixin.forEach( function( t ){ t.qAlias = t.qAlias || (data.qAlias + 'r'); });
              applyMixin( main.table, main );
            }

            return {
              type:   'left'
            , alias:  data.alias + '_' + cid++
            , target: main
            , on:     on
            };
          };

          $query.mixin.forEach( function( target ){
            var targetDal = dirac.dals[ target.table ];

            // Immediate dependency not met and not specifying how to get there
            if ( !targetDal && !target.where ){
              throw new Error( 'Must specify how to relate table `' + table_name + '` to target `' + target.table + '`' );
            }

            var pivots = [];

            if ( targetDal )
            if ( targetDal.dependents[ table_name ] ){
               pivots = Object.keys( targetDal.dependents[ table_name ] ).map( function( p ){
                return {
                  source_col: targetDal.dependents[ table_name ][ p ]
                , target_col: p
                };
              });
            }

            var context = utils.extend({
              source:     target.source || table_name
            , target:     target.table
            , alias:      target.alias || target.table
            , pivots:     pivots
            , qAlias:     'r'
            }, target );

            context.alias = context.alias || target.table;

            if ( !$query.joins ){
              $query.joins = [];
            }

            $query.joins.push( tmpl( context ) );
          });
        };

        var applyMany = function( table_name, $query ){
          var tmpl = function( data ){
            var where = utils.extend( {}, data.where );

            data.pivots.forEach( function( p ){
              where[ p.target_col ] = '$' + mosqlUtils.quoteObject( p.source_col, data.source ) + '$';
            });

            var main = utils.extend({
              type:     'select'
            , table:    data.target
            , where:    where
            , alias:    data.qAlias
            }, utils.omit( data, ['table', 'alias', 'pivots', 'target', 'source', 'where'] ));

            if ( Array.isArray( main.one ) ){
              main.one.forEach( function( t ){ t.qAlias = t.qAlias || (data.qAlias + 'r'); });
              applyOne( main.table, main );
            }

            if ( Array.isArray( main.many ) ){
              main.many.forEach( function( t ){ t.qAlias = t.qAlias || (data.qAlias + 'r'); });
              applyMany( main.table, main );
            }

            if ( Array.isArray( main.pluck ) ){
              main.pluck.forEach( function( t ){ t.qAlias = t.qAlias || (data.qAlias + 'r'); });
              applyPluck( main.table, main );
            }

            if ( Array.isArray( main.mixin ) ){
              main.mixin.forEach( function( t ){ t.qAlias = t.qAlias || (data.qAlias + 'r'); });
              applyMixin( main.table, main );
            }

            return {
              type: 'expression'
            , alias: data.alias
            , expression: {
                parenthesis: true
              , expression: {
                  type: 'array_to_json'
                , expression: {
                    type: 'array'
                  , expression: {
                      type: 'select'
                    , columns: [{ type: 'row_to_json', expression: data.qAlias }]
                    , table: main
                    }
                  }
                }
              }
            };
          };

          $query.many.forEach( function( target ){
            var targetDal = dirac.dals[ target.table ];

            // Immediate dependency not met and not specifying how to get there
            if ( !targetDal && !target.where ){
              throw new Error( 'Must specify how to relate table `' + table_name + '` to target `' + target.table + '`' );
            }

            var pivots = [];

            if ( targetDal )
            if ( targetDal.dependencies[ table_name ] ){
               pivots = Object.keys( targetDal.dependencies[ table_name ] ).map( function( p ){
                return {
                  source_col: targetDal.dependencies[ table_name ][ p ]
                , target_col: p
                };
              });
            }

            var context = utils.extend({
              source:     target.source || table_name
            , target:     target.table
            , alias:      target.alias || target.table
            , pivots:     pivots
            , qAlias:     'r'
            }, target );

            context.alias = context.alias || target.table;

            if ( !$query.columns ){
              $query.columns = ['*'];
            }

            $query.columns.push( tmpl( context ) );
          });
        };

        var applyPluck = function( table_name, $query ){
          var tmpl = function( data ){
            var where = utils.extend( {}, data.where );

            data.pivots.forEach( function( p ){
              where[ p.target_col ] = '$' + mosqlUtils.quoteObject( p.source_col, data.source ) + '$';
            });

            var main = utils.extend({
              type:     'select'
            , table:    data.target
            , where:    where
            , alias:    data.qAlias
            }, utils.omit( data, ['table', 'alias', 'pivots', 'target', 'source', 'where', 'column'] ));

            if ( Array.isArray( main.one ) ){
              main.one.forEach( function( t ){ t.qAlias = t.qAlias || (data.qAlias + 'r'); });
              applyOne( main.table, main );
            }

            if ( Array.isArray( main.many ) ){
              main.many.forEach( function( t ){ t.qAlias = t.qAlias || (data.qAlias + 'r'); });
              applyMany( main.table, main );
            }

            if ( Array.isArray( main.pluck ) ){
              main.pluck.forEach( function( t ){ t.qAlias = t.qAlias || (data.qAlias + 'r'); });
              applyPluck( main.table, main );
            }

            if ( Array.isArray( main.mixin ) ){
              main.mixin.forEach( function( t ){ t.qAlias = t.qAlias || (data.qAlias + 'r'); });
              applyMixin( main.table, main );
            }

            return {
              type: 'expression'
            , alias: data.alias
            , expression: {
                parenthesis: true
              , expression: {
                  type: 'array'
                , expression: {
                    type: 'select'
                  , columns: [ data.column ]
                  , table: main
                  }
                }
              }
            };
          };

          $query.pluck.forEach( function( target ){
            var targetDal = dirac.dals[ target.table ];

            // Immediate dependency not met and not specifying how to get there
            if ( !targetDal && !target.where ){
              throw new Error( 'Must specify how to relate table `' + table_name + '` to target `' + target.table + '`' );
            }

            var pivots = [];

            if ( targetDal )
            if ( targetDal.dependencies[ table_name ] ){
               pivots = Object.keys( targetDal.dependencies[ table_name ] ).map( function( p ){
                return {
                  source_col: targetDal.dependencies[ table_name ][ p ]
                , target_col: p
                };
              });
            }

            var context = utils.extend({
              source:     target.source || table_name
            , target:     target.table
            , alias:      target.alias || target.table
            , pivots:     pivots
            , qAlias:     'r'
            }, target );

            context.alias = context.alias || target.table;

            if ( !$query.columns ){
              $query.columns = ['*'];
            }

            $query.columns.push( tmpl( context ) );
          });
        };

        var options = {
          operations: ['find', 'findOne']
        };

        Object.keys( dirac.dals ).forEach( function( table_name ){
          var dal = dirac.dals[ table_name ];

          options.operations.forEach( function( op ){
            dal.before( op, function( $query, schema, next ){
              if ( Array.isArray( $query.many ) )   applyMany( table_name, $query );
              if ( Array.isArray( $query.one ) )    applyOne( table_name, $query );
              if ( Array.isArray( $query.pluck ) )  applyPluck( table_name, $query );
              if ( Array.isArray( $query.mixin ) )  applyMixin( table_name, $query );
              return next();
            });
          });
        });
      });
    });
  };

  relationships.__immediate = true;

  return relationships;
};