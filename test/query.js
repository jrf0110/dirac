var assert = require('assert');
var mosql = require('mongo-sql');
var Query = require('../lib/query');
var QueryTransform = require('../lib/query-transform');

describe('Query', ()=>{
  it('constructor( query, options )', ()=>{
    var query1 = new Query();

    assert.deepEqual( query1.mosqlQuery, {} );
    assert( query1.options.immutable );

    var query2 = new Query({ type: 'select' });

    assert.deepEqual( query2.mosqlQuery, { type: 'select' } );
    assert( query2.options.immutable );
    assert( query1 !== query2 );
  });

  it('Query.create( query, options )', ()=>{
    var query1 = Query.create();

    assert.deepEqual( query1.mosqlQuery, {} );
    assert( query1.options.immutable );

    var query2 = Query.create({ type: 'select' });

    assert.deepEqual( query2.mosqlQuery, { type: 'select' } );
    assert( query2.options.immutable );
    assert( query1 !== query2 );
  });

  it('.clone()', ()=>{
    var query1 = Query.create({
      type: 'select'
    , table: 'users'
    });

    var query2 = query1.clone();

    assert( query1 !== query2 );

    assert.deepEqual( query1.mosqlQuery, {
      type: 'select'
    , table: 'users'
    });
  });

  it('.instance()', ()=>{
    var query1 = Query.create();
    var query2 = query1.instance();

    // Clones because is immutable
    assert( query1 !== query2 );

    query1 = Query.create( {}, { immutable: false });
    query2 = query1.instance();

    // Does not clone because is not immutable
    assert( query1 === query2 );
  });

  it('.table()', ()=>{
    var query1 = Query.create({ type: 'select', table: 'users' });

    assert.equal( query1.table(), 'users' );
  });

  it('.table( table )', ()=>{
    var query1 = Query.create();
    var query2 = query1.table('users')

    assert.equal( query1.mosqlQuery.table, undefined );
    assert.equal( query2.mosqlQuery.table, 'users' );
  });

  it('.type()', ()=>{
    var query1 = Query.create({ type: 'select', table: 'users' });

    assert.equal( query1.type(), 'select' );
  });

  it('.type( type )', ()=>{
    var query1 = Query.create();
    var query2 = query1.type('select')

    assert.equal( query1.mosqlQuery.type, undefined );
    assert.equal( query2.mosqlQuery.type, 'select' );
  });

  it('.where()', ()=>{
    var query1 = Query
      .create({ type: 'select', table: 'users', where: { foo: 'bar' } });

    assert.deepEqual( query1.where(), { foo: 'bar' } );
  });

  it('.where( key )', ()=>{
    var query1 = Query.create({
      type: 'select'
    , table: 'users'
    , where: { foo: 'bar' }
    });

    assert.equal( query1.where('foo'), 'bar' );

    var query2 = Query.create({
      type: 'select'
    , table: 'users'
    , where: { foo: { bar: { baz: 'foo' } } }
    });

    assert.equal( query2.where('foo.bar.baz'), 'foo' );
  });

  it('.where( obj )', ()=>{
    var query1 = Query
      .create({ type: 'select', table: 'users' })
      .where({ foo: 'bar' });

    assert.deepEqual( query1.mosqlQuery, {
      type: 'select'
    , table: 'users'
    , where: { foo: 'bar' }
    });

    var query2 = query1.where({ bar: 'baz' });

    assert( query1 !== query2 );

    assert.deepEqual( query1.mosqlQuery, {
      type: 'select'
    , table: 'users'
    , where: { foo: 'bar' }
    });

    assert.deepEqual( query2.mosqlQuery, {
      type: 'select'
    , table: 'users'
    , where: { foo: 'bar', bar: 'baz' }
    });
  });

  it('.where( key, val )', ()=>{
    var query1 = Query
      .create({ type: 'select', table: 'users' })
      .where( 'foo', 'bar' );

    assert.deepEqual( query1.mosqlQuery, {
      type: 'select'
    , table: 'users'
    , where: { foo: 'bar' }
    });

    var query2 = query1.where( 'bar', 'baz' );

    assert( query1 !== query2 );

    assert.deepEqual( query1.mosqlQuery, {
      type: 'select'
    , table: 'users'
    , where: { foo: 'bar' }
    });

    assert.deepEqual( query2.mosqlQuery, {
      type: 'select'
    , table: 'users'
    , where: { foo: 'bar', bar: 'baz' }
    });
  });

  it('.toStringAndValues()', ()=>{
    var query1 = Query.create({
      type: 'select'
    , table: 'users'
    }, { mosql });

    var result = query1.toStringAndValues();

    assert.equal( result.query, 'select "users".* from "users"' );
    assert.deepEqual( result.values, [] );
  });
});