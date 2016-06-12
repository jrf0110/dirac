var assert = require('assert');
var PGPool = require('pg-pool');
var Database = require('../lib/database');
var Relationships = require('../middleware/relationships');

var pool = new PGPool();

describe('Relationships', ()=>{
  it('database.use( relationships )', ()=>{
    var db = Database.create()
      .use( Relationships() )
      .register('users');

    assert.equal( db.queryTransforms.length, 1 );
    assert.equal( db.Query, Relationships.Query );
    assert.equal( db.users.Query, Relationships.Query );

    var query = db.query();

    assert( query instanceof Relationships.Query );
    assert.equal( query.queryTransforms.length, 1 );
  });

  describe('Relationships.Query', ()=>{
    it('.one(...)', ()=>{
      var query = Relationships.Query.create( {}, { pool } )
        .one({ table: 'users' });

      assert.deepEqual( query.mosqlQuery.one, [
        { table: 'users' }
      ]);

      var query2 = query.one('orders');

      assert.deepEqual( query.mosqlQuery.one, [
        { table: 'users'}
      ]);

      assert.deepEqual( query2.mosqlQuery.one, [
        { table: 'users' }
      , { table: 'orders' }
      ]);
    });

    it('.many(...)', ()=>{
      var query = Relationships.Query.create( {}, { pool } )
        .many({ table: 'users' });

      assert.deepEqual( query.mosqlQuery.many, [
        { table: 'users' }
      ]);

      var query2 = query.many('orders');

      assert.deepEqual( query.mosqlQuery.many, [
        { table: 'users'}
      ]);

      assert.deepEqual( query2.mosqlQuery.many, [
        { table: 'users' }
      , { table: 'orders' }
      ]);
    });

    it('.mixin(...)', ()=>{
      var query = Relationships.Query.create( {}, { pool } )
        .mixin({ table: 'users' });

      assert.deepEqual( query.mosqlQuery.mixin, [
        { table: 'users' }
      ]);

      var query2 = query.mixin('orders');

      assert.deepEqual( query.mosqlQuery.mixin, [
        { table: 'users'}
      ]);

      assert.deepEqual( query2.mosqlQuery.mixin, [
        { table: 'users' }
      , { table: 'orders' }
      ]);
    });

    it('.pluck(...)', ()=>{
      var query = Relationships.Query.create( {}, { pool } )
        .pluck({ table: 'users' });

      assert.deepEqual( query.mosqlQuery.pluck, [
        { table: 'users' }
      ]);

      var query2 = query.pluck('orders');

      assert.deepEqual( query.mosqlQuery.pluck, [
        { table: 'users'}
      ]);

      assert.deepEqual( query2.mosqlQuery.pluck, [
        { table: 'users' }
      , { table: 'orders' }
      ]);
    });
  });

  it('transforms many', ()=>{
    var db = Database.create()
      .use( Relationships() )
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

    var query = db.users.find().many('user_books');

    assert.equal( query.queryTransforms.length, 1 );
    assert.deepEqual( query.getTransformedQuery().mosqlQuery, {
      "type": "select",
      "table": "users",
      "many": [
        {
          "table": "user_books"
        }
      ],
      "columns": [
        "*",
        {
          "type": "expression",
          "alias": "user_books",
          "expression": {
            "parenthesis": true,
            "expression": {
              "type": "array_to_json",
              "expression": {
                "type": "array",
                "expression": {
                  "type": "select",
                  "columns": [
                    {
                      "type": "row_to_json",
                      "expression": "r"
                    }
                  ],
                  "table": {
                    "type": "select",
                    "table": "user_books",
                    "where": {
                      "user_id": "$\"users\".\"id\"$"
                    },
                    "alias": "r",
                    "qAlias": "r"
                  }
                }
              }
            }
          }
        }
      ]
    });
  });

  it('transforms one', ()=>{
    var db = Database.create()
      .use( Relationships() )
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

    var query = db.user_books.find().one('users');

    assert.equal( query.queryTransforms.length, 1 );

    assert.deepEqual( query.getTransformedQuery().mosqlQuery, {
      "type": "select",
      "table": "user_books",
      "one": [
        {
          "table": "users"
        }
      ],
      "columns": [
        "*",
        {
          "type": "expression",
          "alias": "users",
          "expression": {
            "parenthesis": true,
            "expression": {
              "type": "select",
              "columns": [
                {
                  "type": "row_to_json",
                  "expression": "r"
                }
              ],
              "table": {
                "type": "select",
                "table": "users",
                "alias": "r",
                "where": {
                  "id": "$\"user_books\".\"user_id\"$"
                },
                "limit": 1,
                "qAlias": "r"
              }
            }
          }
        }
      ]
    });
  });

  it('transforms mixin', ()=>{
    var db = Database.create()
      .use( Relationships() )
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

    var query = db.user_books.find().mixin('books');

    assert.equal( query.queryTransforms.length, 1 );

    assert.deepEqual( query.getTransformedQuery().mosqlQuery, {
      "type": "select",
      "table": "user_books",
      "mixin": [
        {
          "table": "books"
        }
      ],
      "joins": [
        {
          "type": "left",
          "target": "books",
          "alias": undefined,
          "on": {
            "id": "$\"user_books\".\"book_id\"$"
          }
        }
      ],
      "columns": [
        "*",
        {
          "table": "books",
          "name": "*"
        }
      ]
    });
  });

  it('transforms pluck', ()=>{
    var db = Database.create()
      .use( Relationships() )
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

    var query = db.users.find().pluck({ table: 'user_books', column: 'book_id' });

    assert.equal( query.queryTransforms.length, 1 );

    assert.deepEqual( query.getTransformedQuery().mosqlQuery, {
      "type": "select",
      "table": "users",
      "pluck": [
        {
          "table": "user_books",
          "column": "book_id"
        }
      ],
      "columns": [
        "*",
        {
          "type": "expression",
          "alias": "user_books",
          "expression": {
            "parenthesis": true,
            "expression": {
              "type": "array",
              "expression": {
                "type": "select",
                "columns": [
                  "book_id"
                ],
                "table": {
                  "type": "select",
                  "table": "user_books",
                  "where": {
                    "user_id": "$\"users\".\"id\"$"
                  },
                  "alias": "r",
                  "qAlias": "r"
                }
              }
            }
          }
        }
      ]
    });
  });
});