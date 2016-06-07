var assert = require('assert');
var Database = require('../lib/database');
var Table = require('../lib/table');

describe('Database', ()=>{
  it('Database.create()', ()=>{
    var database = Database.create();

    assert.equal( database.connectionString, 'postgres://localhost:5432' );
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

  it('.register(...)', ()=>{
    var db = Database.create();
    var table1 = db.table('table1');

    var db2 = db.register( table1 );

    assert.deepEqual( db.tables, {} );
    assert.equal( db2.table1, table1 );

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
});