var assert = require('assert');
var Table = require('../lib/table');
var Query = require('../lib/query');

describe('Table', ()=>{
  it('Table.create()', ()=>{
    var table = Table.create({
      name: 'foo'
    });

    assert.equal( table.name, 'foo' );
  });

  it('.getPrimaryKey()', ()=>{
    var table1 = Table.create({ name: 'foo' });

    assert.equal( table1.getPrimaryKey(), 'id' );

    var table2 = Table.create({
      name: 'bar'
    , schema: { uuid: { type: 'uuid', primaryKey: true } }
    });

    assert.equal( table2.getPrimaryKey(), 'uuid' );
  });

  it('.getIdParamWhereClause( where )', ()=>{
    var table1 = Table.create({ name: 'foo' });

    assert.deepEqual( table1.getIdParamWhereClause(12), { id: 12 })
    assert.deepEqual( table1.getIdParamWhereClause({ foo: 'bar' }), { foo: 'bar' })

    var table2 = Table.create({
      name: 'bar'
    , schema: { uuid: { type: 'uuid', primaryKey: true } }
    });

    assert.deepEqual( table2.getIdParamWhereClause('byah'), { uuid: 'byah' });
  });

  it('.find()', ()=>{
    var table = Table.create({
      name: 'foo'
    });

    var query = table.find();

    assert.equal( query.mosqlQuery.type, 'select' );
    assert.equal( query.mosqlQuery.table, 'foo' );
  });

  it('.findOne(id)', ()=>{
    var table = Table.create({
      name: 'foo'
    });

    var query = table.findOne(100);

    assert.equal( query.mosqlQuery.type, 'select' );
    assert.equal( query.mosqlQuery.table, 'foo' );
    assert.equal( query.mosqlQuery.where.id, 100 );
  });

  it('.findOne({condition})', ()=>{
    var table = Table.create({
      name: 'foo'
    });

    var query = table.findOne({ bar: 'baz' });

    assert.equal( query.mosqlQuery.type, 'select' );
    assert.equal( query.mosqlQuery.table, 'foo' );
    assert.equal( query.mosqlQuery.where.bar, 'baz' );
  });

  it('.findOne(uuid) using primaryKey', ()=>{
    var table = Table.create({
      name: 'foo'
    , schema: {
        uuid: { primaryKey: true }
      }
    });

    var query = table.findOne('some_uuid');

    assert.equal( query.mosqlQuery.type, 'select' );
    assert.equal( query.mosqlQuery.table, 'foo' );
    assert.equal( query.mosqlQuery.where.uuid, 'some_uuid' );
  });

  it('.remove()', ()=>{
    var table = Table.create({
      name: 'foo'
    });

    var query = table.remove(1);

    assert.equal( query.mosqlQuery.type, 'delete' );
    assert.equal( query.mosqlQuery.table, 'foo' );
    assert.equal( query.mosqlQuery.where.id, 1 );
  });

  it('.update()', ()=>{
    var table = Table.create({
      name: 'foo'
    });

    var query = table.update(1).values({ bar: 'baz' });

    assert.equal( query.mosqlQuery.type, 'update' );
    assert.equal( query.mosqlQuery.table, 'foo' );
    assert.equal( query.mosqlQuery.where.id, 1 );
    assert.equal( query.mosqlQuery.values.bar, 'baz' );
  });

  it('.create()', ()=>{
    var table = Table.create({
      name: 'foo'
    , schema: { id: { type: 'serial', primarykey: true } }
    });

    var query = table.create();

    assert.deepEqual( query.mosqlQuery, {
      type: 'create-table'
    , table: 'foo'
    , ifNotExists: true
    , definition: { id: { type: 'serial', primarykey: true } }
    })
  });

  it('.create() view', ()=>{
    var table = Table.create({
      name: 'foo'
    , type: 'view'
    , schema: { id: { type: 'serial', primarykey: true } }
    , expression:   Query.create( {}, { mosql: require('mongo-sql') })
                         .type('select')
                         .table('users')
                         .columns('id')
                         .where({ id: { $gt: 100} })
    });

    var query = table.create();

    assert.deepEqual( query.mosqlQuery, {
      type: 'create-view'
    , view: 'foo'
    , orReplace: true
    , materialized: false
    , expression: {
        type: 'select'
        // Artifact from mosql
      , __defaultTable: 'users'
      , table: 'users'
      , columns: ['id']
      , where: { id: { $gt: 100} }
      }
    });
  });
});