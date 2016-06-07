var _ = require('lodash');
var QueryGenerator = require('./query-generator');
var Query = require('./query');
var ResultTransform = require('./result-transform');

class Table extends QueryGenerator {
  static create( options ){
    return new this( options );
  }

  constructor( options ){
    super( options );

    if ( typeof options.name !== 'string' ){
      throw new Error('options.name must be a table or view name string');
    }

    if ( options.type && [ 'table', 'view' ].indexOf( options.type ) === -1 ){
      throw new Error('options.type must either view "table" or "view"');
    }

    if ( options.type === 'view' ){
      if ( !(options.expression instanceof Query) ){
        throw new Error('options.expression must be a Query');
      }

      this.expression = options.expression;
      this.materialized = options.materialized || false;
    }

    this.type = options.type || 'table';

    this.name = options.name;
    this.schema = options.schema || {};
  }

  clone(){
    var options = Object.assign( {}, this.options );
    options.queryTransforms = this.queryTransforms.slice(0);
    options.resultsTransforms = this.resultsTransforms.slice(0);

    options.schema = _.cloneDeep( this.schema );

    return Table.create( options );
  }

  getPrimaryKey(){
    for ( var key in this.schema ){
      if ( this.schema[ key ].primaryKey === true ){
        return key;
      }
    }

    return Table.defaultPrimaryKey;
  }

  getIdParamWhereClause( where ){
    if ( typeof where !== 'object' ){
      where = { [this.getPrimaryKey()]: where };
    }

    return where;
  }

  create(){
    if ( this.type === 'view' ){
      return this.query({
        type: 'create-view'
      , view: this.name
      , orReplace: true
      , materialized: this.materialized
      , expression: this.expression.toStringAndValues().original
      });
    }

    return this.query({
      type: 'create-table'
    , ifNotExists: true
    , table: this.name
    , definition: this.schema
    });
  }

  find(){
    return this.query({
      type: 'select'
    , table: this.name
    });
  }

  findOne( where ){
    return this.query({
      type: 'select'
    , table: this.name
    , where: this.getIdParamWhereClause( where )
    }).mutate( query => query.after( ResultTransform.firstRow ) );
  }

  remove( where ){
    var query = this.query({
      type: 'delete'
    , table: this.name
    , where: this.getIdParamWhereClause( where )
    });

    if ( typeof where !== 'object' ){
      query.mutate( query => query.after( ResultTransform.firstRow ) );
    }

    return query;
  }

  update( where ){
    var query = this.query({
      type: 'update'
    , table: this.name
    , where: this.getIdParamWhereClause( where )
    });

    if ( typeof where !== 'object' ){
      query.mutate( query => query.after( ResultTransform.firstRow ) );
    }

    return query;
  }
}

Table.defaultPrimaryKey = 'id';

module.exports = Table;