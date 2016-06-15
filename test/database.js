var assert = require('assert');
var PGPool = require('pg-pool');
var Database = require('../lib/database');
var Table = require('../lib/table');

describe('Database', ()=>{
  it('Database.create()', ()=>{
    var database = Database.create();

    assert.equal(
      database.clientOptions.toString()
    , `postgres://${process.env.USER}@localhost:5432/${process.env.USER}`
    );

    assert( database.pool instanceof PGPool );

    database = Database.create('postgres://localhost:5432/test');

    assert.equal(
      database.clientOptions.toString()
    , 'postgres://john@localhost:5432/test'
    );

    database = Database.create({
      user: 'foo'
    , host: 'bar'
    , database: 'baz'
    });

    assert.equal(
      database.clientOptions.toString()
    , 'postgres://foo@bar:5432/baz'
    );
  });

  it('.table(...)', ()=>{
    var db = Database.create();

    var table1 = db.table('table1');
    assert( table1 instanceof Table );
    assert.equal( table1.name, 'table1' );

    var table2 = db.table({ name: 'table2' });

    var db2 = db.before( query => query.where('foo', 'bar') );
    var table3 = db2.table({ name: 'table3' });

    assert.equal( table3.queryTransforms.length, 1 );
  });

  it('.adaptTable(...)', ()=>{
    var db = Database.create().database('testtest');

    class CustomTable extends Table {
      foo(v){
        return this.query().where('foo', v)
      }
    }

    var customTable1 = new CustomTable({
      name: 'custom_table_1'
    , pool: new PGPool({ database: 'test' })
    });

    var customTable2 = db.adaptTable( customTable1 );

    assert.equal( customTable1.pool.options.database, 'test' );
    assert.equal( customTable2.pool.options.database, 'testtest' );
  })

  it('.register(...)', ()=>{
    var db = Database.create();
    var table1 = db.table('table1');

    var db2 = db.register( table1 );

    assert.deepEqual( db.tables, {} );
    assert( 'table1' in db2 );

    var db3 = db2.register({ name: 'table2' });

    assert.deepEqual( db.tables, {} );
    assert( 'table1' in db3 );
    assert( 'table2' in db3 );
    assert( !('table2' in db2) );

    var db4 = db3.register('table3');

    assert( 'table1' in db4 );
    assert( 'table2' in db4 );
    assert( 'table3' in db4 );
  });

  it('.getCreateTableAndViewList()', ()=>{
    var db = Database.create()
      .register({
        name: 'users'
      , schema: {
          id: { type: 'serial', primaryKey: true }
        , name: { type: 'text' }
        }
      })
      .register({
        name: 'books'
      , schema: {
          id: { type: 'serial', primaryKey: true }
        , name: { type: 'text' }
        }
      })
      .register({
        name: 'user_books'
      , schema: {
          user_id: { type: 'int', references: { table: 'users', column: 'id' } }
        , book_id: { type: 'int', references: { table: 'books', column: 'id' } }
        }
      });

    var list = db.getCreateTableAndViewList();

    assert.deepEqual( list, [
      'books'
    , 'users'
    , 'user_books'
    ]);
  });

  it('.host(val)', ()=>{
    var database = Database.create().host('foobar');

    assert.equal(
      database.clientOptions.toString()
    , `postgres://${process.env.USER}@foobar:5432/${process.env.USER}`
    );

    assert.equal( database.pool.options.host, 'foobar' );
  });

  it('.port(val)', ()=>{
    var database = Database.create().port(1234);

    assert.equal(
      database.clientOptions.toString()
    , `postgres://${process.env.USER}@localhost:1234/${process.env.USER}`
    );

    assert.equal( database.pool.options.port, 1234 );
  });

  it('.user(val)', ()=>{
    var database = Database.create().user('foobar');

    assert.equal(
      database.clientOptions.toString()
    , `postgres://foobar@localhost:5432/${process.env.USER}`
    );

    assert.equal( database.pool.options.user, 'foobar' );
  });

  it('.database(val)', ()=>{
    var database = Database.create().database('foobar');

    assert.equal(
      database.clientOptions.toString()
    , `postgres://${process.env.USER}@localhost:5432/foobar`
    );

    assert.equal( database.pool.options.database, 'foobar' );
  });

  it('.ssl(val)', ()=>{
    var database = Database.create().ssl(true);

    assert.equal(
      database.clientOptions.toString()
    , `postgres://${process.env.USER}@localhost:5432/${process.env.USER}?ssl=true`
    );

    assert.equal( database.pool.options.ssl, true );
  });
});