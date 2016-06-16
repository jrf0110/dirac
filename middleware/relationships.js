const _ = require('lodash');
const mosqlUtils = require('mongo-sql/lib/utils');
const Query = require('../lib/query');
const QueryTransform = require('../lib/query-transform');
const Database = require('../lib/database');

class RelationshipsDatabase extends Database {
  clone(){
    var originalClone = Database.prototype.clone.call( this );
    var clone = new RelationshipsDatabase( originalClone );

    for ( var key in originalClone ){
      clone[ key ] = originalClone[ key ];
    }

    return clone;
  }

  register( table ){
    return Database.prototype.register.call( this, table ).mutate( database => {
      var transform = Relationships.Transform( database.graph );

      replaceTransform( database, transform );

      // Update all tables to use the new transform
      for ( var key in database.tables ){
        database.tables[ key ].mutate( table => {
          replaceTransform( table, transform );
        });
      }
    });
  }
}

class QueryWithRelationships extends Query {
  one( subQuery ){
    var query = this.instance();

    if ( typeof subQuery == 'string' ){
      subQuery = { table: subQuery };
    }

    if ( !Array.isArray( query.mosqlQuery.one ) ){
      query.mosqlQuery.one = [];
    }

    query.mosqlQuery.one.push( subQuery );

    return query;
  }

  many( subQuery ){
    var query = this.instance();

    if ( typeof subQuery == 'string' ){
      subQuery = { table: subQuery };
    }

    if ( !Array.isArray( query.mosqlQuery.many ) ){
      query.mosqlQuery.many = [];
    }

    query.mosqlQuery.many.push( subQuery );

    return query;
  }

  mixin( subQuery ){
    var query = this.instance();

    if ( typeof subQuery == 'string' ){
      subQuery = { table: subQuery };
    }

    if ( !Array.isArray( query.mosqlQuery.mixin ) ){
      query.mosqlQuery.mixin = [];
    }

    query.mosqlQuery.mixin.push( subQuery );

    return query;
  }

  pluck( subQuery ){
    var query = this.instance();

    if ( typeof subQuery == 'string' ){
      subQuery = { table: subQuery };
    }

    if ( !Array.isArray( query.mosqlQuery.pluck ) ){
      query.mosqlQuery.pluck = [];
    }

    query.mosqlQuery.pluck.push( subQuery );

    return query;
  }
}

class RelationshipsQueryTransform extends QueryTransform {}

var Relationships = module.exports = options => {
  return database => {
    var db = new RelationshipsDatabase( Object.assign( {}, database, database.options ) );
    db.Query = QueryWithRelationships;
    return db;
  };
};

module.exports.Transform = graph => {
  return RelationshipsQueryTransform.create( query => {
    query = query.instance();

    let tableName = query.table();
    let $query = query.mosqlQuery;

    if ( Array.isArray( $query.many ) ){
      return applyMany( graph, tableName, $query );
    }

    if ( Array.isArray( $query.one ) ){
      return applyOne( graph, tableName, $query );
    }

    if ( Array.isArray( $query.pluck ) ){
      return applyPluck( graph, tableName, $query );
    }

    if ( Array.isArray( $query.mixin ) ){
      return applyMixin( graph, tableName, $query );
    }

    return query;
  });
};

module.exports.Query = QueryWithRelationships;
module.exports.QueryTransform = RelationshipsQueryTransform;

var replaceTransform = ( generator, transform )=>{
  // Replace the old relationships transform
  var didReplace = false;
  for ( let i = 0; i < generator.queryTransforms.length; i++ ){
    if ( generator.queryTransforms[ i ] instanceof Relationships.QueryTransform ){
      didReplace = true;
      generator.queryTransforms[ i ] = transform;
      break;
    }
  }

  if ( !didReplace ){
    generator.use( transform );
  }
};

var applyOne = function( graph, table_name, $query ){
  var tmpl = function( data ){
    var where = _.extend( {}, data.where );

    data.pivots.forEach( function( p ){
      where[ p.target_col ] = '$' + mosqlUtils.quoteObject( p.source_col, data.source ) + '$';
    });

    var main = _.extend({
      type:     'select'
    , table:    data.target
    , alias:    data.qAlias
    , where:    where
    , limit:    1
    }, _.omit( data, ['table', 'alias', 'pivots', 'target', 'source', 'where'] ));

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
    var targetDal = graph[ target.table ];

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

    if ( targetDal )
    if ( targetDal.dependencies[ table_name ] ){
       pivots = pivots.concat( Object.keys( targetDal.dependencies[ table_name ] ).map( function( p ){
        return {
          source_col: targetDal.dependencies[ table_name ][ p ]
        , target_col: p
        };
      }));
    }

    var context = _.extend({
      source:     target.source || table_name
    , target:     target.table
    , alias:      target.alias || target.table
    , pivots:     pivots
    , qAlias:     'r'
    }, target );

    context.alias = context.alias || target.table;

    var columnsTarget = $query.type === 'select' ? 'columns' : 'returning';

    if ( !$query[ columnsTarget ] ){
      $query[ columnsTarget ] = ['*'];
    }

    $query[ columnsTarget ].push( tmpl( context ) );
  });
};

var applyMixin = function( graph, table_name, $query ){
  var cid = 1;
  var tmpl = function( data ){
    var where = _.extend( {}, data.where );
    var on = _.extend( {}, data.on );

    data.pivots.forEach( function( p ){
      /*where[ p.target_col ] = */on[ p.target_col ] = '$' + mosqlUtils.quoteObject( p.source_col, data.source ) + '$';
    });

    var main = _.extend({
      type:     'select'
    , table:    data.target
    , alias:    data.qAlias
    , where:    where
    , limit:    1
    }, _.omit( data, ['table', 'pivots', 'target', 'source', 'where', 'on'] ));

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
    , alias:  data.qalias
    , target: data.target
    , on:     on
    };
  };

  $query.mixin.forEach( function( target ){
    var targetDal = graph[ target.table ];

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

    if ( targetDal )
    if ( targetDal.dependencies[ table_name ] ){
       pivots = pivots.concat( Object.keys( targetDal.dependencies[ table_name ] ).map( function( p ){
        return {
          source_col: targetDal.dependencies[ table_name ][ p ]
        , target_col: p
        };
      }));
    }

    var context = _.extend({
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

    var columnsTarget = $query.type === 'select' ? 'columns' : 'returning';

    if ( !$query[ columnsTarget ] ){
      $query[ columnsTarget ] = ['*'];
    }

    if ( Array.isArray( target.columns ) ){
      $query[ columnsTarget ] = $query[ columnsTarget ].concat(
        target.columns.map( function( column ){
          return typeof column === 'string'
            ? mosqlUtils.quoteObject( column, target.table )
            : column;
        })
      );
    } else {
      $query[ columnsTarget ].push({ table: context.alias, name: '*' })
    }


    $query.joins.push( tmpl( context ) );
  });
};

var applyMany = function( graph, table_name, $query ){
  var tmpl = function( data ){
    var where = _.extend( {}, data.where );

    data.pivots.forEach( function( p ){
      where[ p.target_col ] = '$' + mosqlUtils.quoteObject( p.source_col, data.source ) + '$';
    });

    var main = _.extend({
      type:     'select'
    , table:    data.target
    , where:    where
    , alias:    data.qAlias
    }, _.omit( data, ['table', 'alias', 'pivots', 'target', 'source', 'where'] ));

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
    var targetDal = graph[ target.table ];

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

    var context = _.extend({
      source:     target.source || table_name
    , target:     target.table
    , alias:      target.alias || target.table
    , pivots:     pivots
    , qAlias:     'r'
    }, target );

    context.alias = context.alias || target.table;

    var columnsTarget = $query.type === 'select' ? 'columns' : 'returning';

    if ( !$query[ columnsTarget ] ){
      $query[ columnsTarget ] = ['*'];
    }

    $query[ columnsTarget ].push( tmpl( context ) );
  });
};

var applyPluck = function( graph, table_name, $query ){
  var tmpl = function( data ){
    var where = _.extend( {}, data.where );

    data.pivots.forEach( function( p ){
      where[ p.target_col ] = '$' + mosqlUtils.quoteObject( p.source_col, data.source ) + '$';
    });

    var main = _.extend({
      type:     'select'
    , table:    data.target
    , where:    where
    , alias:    data.qAlias
    }, _.omit( data, ['table', 'alias', 'pivots', 'target', 'source', 'where', 'column'] ));

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
    var targetDal = graph[ target.table ];

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

    var context = _.extend({
      source:     target.source || table_name
    , target:     target.table
    , alias:      target.alias || target.table
    , pivots:     pivots
    , qAlias:     'r'
    }, target );

    context.alias = context.alias || target.table;

    var columnsTarget = $query.type === 'select' ? 'columns' : 'returning';

    if ( !$query[ columnsTarget ] ){
      $query[ columnsTarget ] = ['*'];
    }

    $query[ columnsTarget ].push( tmpl( context ) );
  });
};