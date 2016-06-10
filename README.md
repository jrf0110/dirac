# Dirac.js - Postgres ORM Thing

Paul Dirac was a theoretical physicist who made fundamental contributions to the early development of both quantum mechanics and quantum electrodynamics. Dirac.js is a flexible and extendable database querying library for Node Postgres.

__Quick Example__

```javascript
// Find a random user
db.users.findOne()
  // id > 100
  .where({ id: { $gt: 100 } })
  // or id < 50
  .where('id.$or.$lt', 50)
  .limit(10)
  // user {} will have an array of orders []
  // This works efficientialy without multiple database trips
  // and can be optimized by the user
  .many('orders')
  .execute()
  .then( user => console.log( user.orders[0] ) )
  .catch( error => )
```

__Install__

```bash
npm install -S dirac
```

__Index__


* [Examples](#examples)
* [Documentaiton](#examples)
* [Why Dirac?](#why-dirac)

## Why Dirac?

When dirac was first written, the only seemingly viable ORM for node and postgres was Sequelize. For whatever reason, the style and source code did not jive with me. I wanted a simple no-brainer querying interface so I made dirac. I used dirac in production for a couple of small sites and one large site for years, and for the most part, the experience was fantastic.

Now, we've got Knex and Bookshelf which seem to be really great libraries. Still, I'm left with the feeling that the abstractions are needlessly complex and the API doesn't seem as _nice_ as it could be. Admittedly, this is probably because I've been working with my own tools for the past 3 years. I just don't think I could live without [MoSQL](https://github.com/goodybag/mongo-sql) as my query builder. Its relentless obsession with query introspection and conformance to Postgres's SQL engine makes any query possible.

### The Relationships Middleware

About a year into Gooydbag.com's useage with dirac.js, I found myself needing to fetch sub-resources on top-level queries. They needed to be formatted as JSON documents like so:

```javascript
// Results:

[ { id: 11
  , name: 'John'
    // Users->Orders
  , orders: [ { id: 123
              , user_id: 11
                // Users->Orders->OrderItems
              , items:  [ { ...} ]
                // Users->Orders->Restaurant
              , restaurant: { ... }
              }
            ]
  }
  ...
]
```

I knew how to make the queries that would produce this sort of result (using JSON functions in postgres). The question was whether we could glean the application's database structure and _use that structure_ to make writing queries easier. So I set to work on a dirac plugin that did just that:

```javascript
var where = {};
db.users.find( where, {
  many: [ { table: 'orders'
          , one:  [ { table: 'restaurants', alias: 'restaurant'} ]
          , many: [ { table: 'order_items', alias: 'items' } ]
          }
        ]
}, ( error, users )=>{
  // users[]->orders[]->items[]
  //                  ->restaurant{}
});
```

With those query options, each user returned in the results will have an array of orders, which also had an array of items and a restaurant object. The API is easy, and adding behaviors is simple because we're just working with JSON objects.

The current syntax isn't much different:

```javascript
db.users.find()
  .many({
    table: 'orders'
  , one:  [ { table: 'restaurants', alias: 'restaurant'} ]
  , many: [ { table: 'order_items', alias: 'items' } ]
  })
  .execute()
  .then( users => ... )
  .catch( error => ... )
```

Let's go over what the actual differences between `1.0.0` and older versions:

#### No more singletons

Previously, dirac exported a singleton that the user interacted with; Accepting that dirac and postgres were just pieces of their environment that they couldn't truly control. Now, dirac exports factories to its various object definitions. The default export is a function that creates `Database` instances. You can alternatively dig into `lib/` and make your own.

```javascript
var db = require('dirac')('postgres://localhost:5432/test_db');

// Alternatively:
var Database = require('dirac/lib/database');
var db = new Database({ connectionString: 'postgres://localhost:5432/test_db' });
```

#### Immutability by default (it's configurable, though)

Immutable objects are easier to reason about. Knowing that the instance you're working with won't be mutated by the outside world, and more importantly, that the changes you make won't affect other consumers is extremely important. That's why dirac `1.0.0` started with Immutable primitives.

```javascript
var db = require('dirac')('postgres://localhost:5432/test_db');

// Apply a results transform to the database instance
// db2 !== db;
var db2 = db.after( (results, query) => {
  if ( query.table() === 'users' ){
    return results.map( user => new User( user ) );
  }

  return result;
});

// Make all queries originating from trollDB use the `trolls` table
var trollDB = db2.before( query => query.table('trolls') );
```

Each change to the database object creates a _new_ database instance, inheriting all properties from the original db instance. This underscores the unifying concept in dirac 1.0.0; Query Generators.

#### Query Generators, or everything through the query object

The [Query Object](Link to query docs) is the primary interface to do _all_ database work. You could remove every other concept in the library and the Query object would still work quite nicely. Things like the Database and the Table objects are just a means to creating Query objects. They're a class of factories that make queries that inherit useful members from its parent.

```javascript
var db = require('dirac')('postgres://localhost:5432/test_db');

// query inherits db's connection string.
var query = db.query().table('users').where('id', 1);

var trollDB = db2.before( query => query.table('trolls') );

// Troll query inherits trollDB's query transforms
// when trollQuery is executed, it will run a transformed version of itself
var trollQuery = trollDb.query().table('users').where('name', { $lt: 'bob' });

var users = db.table('users');
var trolls = trollDb.table('users' /* anything could go here,
                                      because it'll be transformed */ );

// Querying from users comes with some defaults
var usersQuery = users.query();
assert.equal( usersQuery.table(), 'users' );

// So does the troll users table
var trollQuery = trolls.query();
// This is still 'users', until we execute and get the transformed version
assert.equal( trollQuery.table(), 'users' );
assert.equal( trollQuery.getTransformedQuery().table(), 'trolls' );

// Table QueryGenerator also comes with other query factories:
var user123Query = users.findOne(123).many('orders');
// Remove user 123, returning the user object and their orders in a JSON array
var removeUserQuery = users.remove(123).returning({ many: [ table: 'orders' ] })

// Or just use the Query by itself:
var Query = require('dirac/lib/query');
// Find user 123, returning the first result
var query = Query
  .create( {}, { connectionString: 'postgres://localhost:5432/test_db' })
  .where('id', 123)
  .after( results => results[0] );
```

#### Promises by default

Promises are nice, except when some part of your environment doesn't use promises. I've found it easier to work with promises within your callback-oriented code than it is to work with callbacks in your promise-oriented code. I'm not sure why this is (I'm well aware of the ability to automatically convert between the two interfaces with Bluebird's API).

```javascript
db.users.findOne(123)
  .many('orders')
  .one({ table: 'regions', alias: 'region' })
  .execute()
  .then( user => console.log( 'user.id', user.id ) )
  .catch( e => console.error( e ) );
```

#### Relationships on be default

In previous versions, you had to explicitly use the relationships middleware (the ability to use many/one/pluck/mixin in queries). Now, the default export on dirac is a database factory that automatically includes the relationships middleware.

#### `.register(...)` is totally optional, and it builds a dependency graph for you

Previously, all interactions through dirac had to be performed after setting up DALs through the `dirac.register(...)` method. Now, using `.register(...)` is optional, unless you want to use the relationships middleware.

As you register tables on your database instance, the dependency graph is updated and available as `db.graph`. 

```javascript
var db = require('dirac')()
  .register({
    name: 'users'
  , schema: {
      id: { type: 'serial', primaryKey: true }
    }
  });

var orders = db.table({
  name: 'orders'
, schema: {
    id: { type: 'serial', primaryKey: true }
  , user_id: { type: 'int', references: { table: 'users', column: 'id' } }
  }
});

db = db.register( orders );

var ordersQuery = db.orders
  .find()
  .one({ table: 'users', alias: 'user' });

var usersQuery = db.users
  .findOne(123)
  .many('orders');
```