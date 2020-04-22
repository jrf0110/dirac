var assert = require('assert');
var createTableGraph = require('../lib/table-graph');

describe('Utils', ()=>{
  it('createTableGraph( tables )', ()=>{
    var graph = createTableGraph({
      'users': {
        name: 'users'
      , schema: {
          id: { type: 'serial', primaryKey: true }
        , name: { type: 'text' }
        }
      }
    , 'books': {
        name: 'books'
      , schema: {
          id: { type: 'serial', primaryKey: true }
        , name: { type: 'text' }
        }
      }
    , 'user_books': {
        name: 'user_books'
      , schema: {
          user_id: { type: 'int', references: { table: 'users', column: 'id' } }
        , book_id: { type: 'int', references: { table: 'books', column: 'id' } }
        }
      }
    });

    assert.deepEqual( graph, {
      "users": {
        "dependents": {
          "user_books": {
            "id": "user_id"
          }
        },
        "dependencies": {}
      },
      "books": {
        "dependents": {
          "user_books": {
            "id": "book_id"
          }
        },
        "dependencies": {}
      },
      "user_books": {
        "dependents": {},
        "dependencies": {
          "users": {
            "user_id": "id"
          },
          "books": {
            "book_id": "id"
          }
        }
      }
    });
  });
});