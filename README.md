# Dirac.js - Postgres ORM Thing

Paul Dirac was a theoretical physicist who made fundamental contributions to the early development of both quantum mechanics and quantum electrodynamics. Dirac.js is a flexible and extendable database layer for Node Postgres.

## Database as a Data Structure

Dirac.js is built on top of [MoSQL](https://github.com/goodybag/mongo-sql), whose primary goal is to provide SQL query construction, but maintain value consistently throughout. This library extends that goal allowing you to reflect on the overall state of your database and retrieve your table structure in semantic JSON.

Dirac provides you with a decent foundation to start a postgres project with. It allows you to easily group all of your table logic and schema into one file and keep things generally dry and well-namespaced.

## Features

* Non-destructive database syncing
* Destructive database syncing
* Standard crud
* Robust JSON queries
* Before/After Middleware
* Easy-to-use database function organization

## Examples

Register a new table with dirac:

```javascript
var dirac = require('dirac');

dirac.register({
  name: 'users'
, schema: {
    id: {
      type: 'serial'
    , primaryKey: true
    }

  , groups: {
      type: 'int[]'
    , references: {
        table: 'groups'
      , column: 'id'
      }
    }

  , email: {
      type: 'text'
    , unique: true
    }

  , createdAt: {
      type: 'timestamp'
    , default: 'now()'
    }
  }

  // Add your own custom functions
, findOneWithGroups: function( user_id, callback ){
    return this.find( user_id, {
      joins: { /* add appropriate joins */ }
    }, callback );
  }
});
```

Connect to your database, sync, and query:

```javascript
dirac.init('postgres://server/my_database');
// or
dirac.init({
  host:     'localhost'  // <- this actually isn't required because host defaults to localhost
, database: 'my_database'
});

// Tell dirac to use all of the schemas in `/tables`
dirac.use( dirac.dir( __dirname + '/tables' ) );

// Creates new tables, performs non-destructive schema changes
db.sync(); // Optionally pass { force: true } to do a complete wipe

// You do not need to supply a callback.
// You can start querying right away since node-pg
// queues queries until ready
dirac.dals.users.find({ id: { $gt: 5 } }, function(error, users){
  /* ... */
});

// If the first parameter to findOne isn't an object, we assume we're querying by id
// Dirac wraps the value in an object like this: { id: 57 }
dirac.dals.users.findOne( 57, function(error, user){ /* ... */ });

// Update user 57, set name = 'poop' returning "users".*
dirac.dals.users.update( 57, { name: "poop" }, { returning: ['*'] }, function(error, users){
  /* ... */
});

// delete from users where name = "poop" returning *
dirac.dals.users.remove( { name: "poop" }, { returning: ['*'] }, function(error, users){
  /* ... */
});
```

## API

Dirac has two namespaces:

* Root
* Database

The Root namespace is for top-level non-table specific methods while the Databasse namepace is for table specfic methods

### Root

#### dirac.init( connStr [options], [options] )

Connect to Postgres

__Arguments:__

* Connection String or Options
* Options
  - Must contain property called ```connStr``` or ```host```, ```port```, and ```database```
  - Will mix into ```pg.defaults```

___Options:___

* ```connectionString```


#### dirac.dropAllTables( [callback] )

Drops all tables registered in dirac.

__Arguments:__

* Callback ```(error)```

#### dirac.register( name, schema )

Registers a new table or view with dirac. Will not actually create the table until ```dirac.sync()``` is called. Alternatively, you could call: ```dirac.dals.table_name.createIfNotExists()``` to manually add it. However, ```sync``` will resolve table dependencies and it will also save the database state so dirac can reason about your current table structure.

__Arguments:__

* Name - name of the table
* Schema - as described in [https://github.com/goodybag/mongo-sql](https://github.com/goodybag/mongo-sql) create table statement definitions

__Example:__

```javascript
// Register table
dirac.register({
  name: 'users'
, schema: {
    id: {
      type: 'serial'
    , primaryKey: true
    }
  , name: { type: 'text' }
  }
});

// Register View
dirac.register({
  name: 'bobs'
, type: 'view'
, query: {
    type: 'select'
  , table: 'users'
  , where: { name: { $ilike: 'bob' } }
  }
});
```

#### dirac.sync( options )

Perform non-destructive syncs:

* Add new tables
* Add new columns
* Add column constraints

Options:

* force - If true, will perform a destructive sync, thus clearing any orphan columns

#### dirac.use( middleware )

Pass a function to dirac to be called whenever ```dirac.init``` is called. Useful for initializing before/after filters and adding database-wide properties to all schemas.

__Arguments:__

* middleware( dirac ) - the function that will be called when dirac is initialized. It's passed a single parameter (the dirac module).

__Example:__

```javascript
/**
 * db/middleware/created-at.js
 */

var utils = require('utils');

// Middleware automatically adds created_at/updated_at fields to schemas
module.exports = function( options ){
  return function( dirac ){
    utils.defaults( options, {
      createdAt: {
        name: 'created_at'
      , type: 'timestamp'
      , default: 'now()'
      }
    , updatedAt: {
        name: 'updated_at'
      , type: 'timestamp'
      , default: 'now()'
      }
    });

    // Adds fields to a DAL
    var addFields = function( dal ){
      var schema = dirac.dals[ dal ].schema;

      // Add createdAt if it's not already there
      if ( !(options.createdAt.name in schema) ){
        schema[ options.createdAt.name ] = options.createdAt;
      }

      // Add updatedAt if it's not already there
      if ( !(options.updatedAt.name in schema) ){
        schema[ options.updatedAt.name ] = options.updatedAt;
      }
    };

    // Before filter adds updatedAt = 'now()' to the update query
    var updateFilter = function( $query, schema, next ){
      // Updates may be on values or updates
      var values = 'values' in $query ? $query.values : $query.updates;

      values[ options.updatedAt.name ] = 'now()';

      next();
    };

    // Registers before filters to update updatedAt
    var addFilters = function( dal ){
      dirac.dals[ dal ].before( 'update', updateFilter );
    };

    // Add fields to each DAL
    Object.keys( dirac.dals ).forEach( addFields )

    // Add filters to each DAL
    Object.keys( dirac.dals ).forEach( addFilters )
  };
};
```

```javascript
/**
 * db/index.js
 */

var middleware = {
  createdAt: require('./middleware/created-at')
};

dirac.use(
  middleware.createdAt({
    updatedAt: {
      name: 'last_updated'
    , type: 'timestamp'
    , default: 'now()'
    }
  })
);

// DAL registration
// ...
// ...

// After init is called, all functions specified in use are called
dirac.init( config.db );
```

#### dirac.createTable( )

Explicitly create a DALs table. You don't really need to use this unless you're adding new DALs, even then, _you should just call ```sync```_

#### dirac.saveCurrentDbState( )

Save an entry in the dirac_schemas table of the current DAL state in memory. This happens everytime you call ```sync```

#### dirac.setMoSql( instance )

Sets dirac's instance of [MoSQL](https://github.com/goodybag/mongo-sql). Useful if you're already using MoSQL in your project.

### Database

All table interfaces are accessed through the ```dirac.dals``` namespace. Each table is defined as an instance of Dirac.Dal.

#### dirac.dals.table_name.find( $query, [options], callback )

Select documents in ```table_name```. ```$query``` object is the ```where``` property of a MoSQL object. ```options``` is everything else.

__Arguments:__

* $query - MoSQL conditional query ( select where clause )
* options - Anything else that would go in a MoSQL query ( limit, offset, groupBy, etc )
* callback - ```function( error, results ){ }```

__Example:__

```javascript
// Query where condition
var $query = {
  rating: { $gte: 3.5 }
, high_score: { $lt: 5000 }
, name: { $in: [ 'Bob', 'Alice', 'Joe', 'Momma' ] }
};

// Other options for the query
var options = {
  columns: [
    '*' // users.*
  , {   // Get average user high_score
      type:       'average'           // Name of the function
    , as:         'average_score'     // Name of the column
    , expression: 'users.high_score'  // Function argument
    }
  ]
, offset: 50
, limit:  25
, order: { column: 'id', direction: 'desc' }
, group: [ 'id', 'name' ]
};

dirac.dals.users.find( $query, options, function( error, results ){
  /* ... */
});
```

#### dirac.dals.table_name.findOne( $query, [options], callback)

Identical to find only it adds a ```limit: 1``` to the options and will return an object rather than an array.  Substitute an ID for $query.

__Arguments:__

* $query - MoSQL conditional query ( select where clause ) or ID
* options - Anything else that would go in a MoSQL query ( limit, offset, groupBy, etc )
* callback - ```function( error, result ){ }```

#### dirac.dals.table_name.remove( $query, [options], callback )

Removes a document from the database. Substitute an ID for $query.

__Arguments:__

* $query - MoSQL conditional query ( select where clause ) or ID
* options - Anything else that would go in a MoSQL query ( returning, etc )
* callback - ```function( error, result ){ }```

#### dirac.dals.table_name.update( $query, $update, [options] callback )

Update documents in the database. Substitute an ID for $query.

__Arguments:__

* $query - MoSQL conditional query ( select where clause ) or ID
* $update - Object whose keys map to column names and values map to values
* options - Anything else that would go in a MoSQL query ( returning, etc )
* callback - ```function( error, result ){ }```

#### dirac.dals.table_name.insert( document, [options], callback )

Insert a doument

__Arguments:__

* document - Object whose keys map to column names and values map to values
* options - Anything else that would go in a MoSQL query ( returning, etc )
* callback - ```function( error, result ){ }```

#### dirac.dals.table_name.before( [fnName], handler... )

Add a _before_ filter to the DAL. Before filters are like middleware layers that get run before the query is executed. You can add as long as a chain as you'd like.  ```...``` denotes you can add as many handlers as you want.

__Arguments:__

* fnName [optional] - If provided, will add the filter only to the method on the dal, otherwise will add on all methods.
* handler - The logic for your before filter. Will be called withe following arguments:
  + $query - The full MoSQL query object along with the values
  + schema - The schema for the current table
  + next - A function to tell dirac to go the next function in the before stack
           (If you pass an argument to ```next```, dirac assumes that it is an
            error and will send the value back to the consumers callbaack)

__Example:__

```javascript
dirac.register({
  name: 'books'
, schema: {
    id: { type: 'serial', primaryKey: true }
  , name: {
      type: 'text'

      // Dirac doesn't know anything about this object
      // So we can use it for our own benefit
    , validation: {
        type: 'string'
      , max_length: 250
      }
    }
  }
})

// Crappy validation
dirac.dals.books.before( 'insert', function( $query, schema, next ){
  if ( typeof $query.values.name != schema.name.validation.type )
    return next({ type: 'VALIDATION_ERROR', message: 'invalid type for `name`' });

  if ( $query.values.name.length > schema.validation.max_length )
    return next({ type: 'VALIDATION_ERROR', message: 'invalid length for `name`' });

  /* ... */
});
```

#### dirac.dals.table_name.after( [fnName], handler... )

Add an _after_ filter to the DAL. After filters are like middleware layers that get run after the query is executed. You can add as long as a chain as you'd like.  ```...``` denotes you can add as many handlers as you want.

__Arguments:__

* fnName [optional] - If provided, will add the filter only to the method on the dal, otherwise will add on all methods.
* handler - The logic for your after filter. Will be called withe following arguments:
  + results - The results from the query
  + $query - The full MoSQL query object along with the values
  + schema - The schema for the current table
  + next - A function to tell dirac to go the next function in the after stack
           (If you pass an argument to ```next```, dirac assumes that it is an
            error and will send the value back to the consumers callbaack)

__Example:__

```javascript
dirac.register({
  name: 'books'
, schema: {
    id: { type: 'serial', primaryKey: true }
  , num_words: {
      type: 'text'

      // node-pg returns bigints as strings
      // Tell casting after filter to cast to a number
    , cast: 'number'
    }
  }
})

// Crappy casting
dirac.dals.books.after( 'find', function( results, $query, schema, next ){
  var casts = {};
  for ( var key in schema ){
    if ( 'cast' in schema ) casts[ key ] = schema[ key ][ cast ];
  }

  // Transform result set
  for ( var i = 0, l = results.length; i < l; ++i ){
    for ( var key in casts ){
      switch ( casts[ key ] ){
        case 'int':     results[ i ][ key ] = parseInt( results[ i ][ key ] ); break;
        case 'number':  results[ i ][ key ] = parseFloat( results[ i ][ key ] ); break;
        case 'string':  results[ i ][ key ] = "" + results[ i ][ key ]; break;
        default: break;
      }
    }
  }
});
```

### Transactions

Transactions can be made by created a transaction object via `dirac.tx.create()`. Normally, every query by default uses a pool client and releases it per request. You do not want to release a client back into the pool in the middle of a transaction, because that would be _very, very bad_.

For transactions, dirac allows you to access the same client to execute multiple queries until you commit or rollback.

__Example:__

```js
var tx = dirac.tx.create();

tx.begin(function(err) {
  if ( err ) return tx.rollback();
  tx.users.update(userId, balance: { $inc: 5 } }, function(err) {
    if ( err ) return tx.rollback();
    tx.users.insert(userId, balance: { $dec: 5 }, function(err) {
      if ( err ) return tx.rollback();
      tx.commit();
    });
  });
});
```

This can be rather unwieldy so you could use a control library or abstract this further:

```js
var async = require('async')
var tx = dirac.tx.create();

async.series([
  tx.begin.bind(tx)
, tx.users.update.bind(tx.users, userId, { balance: { $inc: 5 } })
, tx.users.update.bind(tx.users, userId, { balance: { $dec: 5 } })
], function(err) {
  if ( err ) return tx.rollback(); // rollback if any queries fail
  tx.commit();
});
```

If you need to apply [explicit table locks](http://www.postgresql.org/docs/9.4/static/explicit-locking.html)
to a transaction, you can use `.lock(mode)` per table:

```js
async.series([
  tx.begin.bind(tx)
, tx.users.lock.bind(tx, 'ACCESS EXCLUSIVE')
, tx.users.update.bind(tx.users, userId, { name: 'Billy' })
, tx.commit.bind(tx)]);
```

To query the following

```sql
BEGIN;
LOCK TABLE users IN ACCESS EXCLUSIVE MODE;
UPDATE "users" set "users"."name" = 'Billy';
COMMIT;
```

#### dirac.tx.create()

Creates a new `tx` object which accesses the same pg.Client for transactional queries.

#### tx.begin( callback )

Invokes a `begin` statement

#### tx.commit( callback )

Invokes the `commit` statement and releases the `tx` client. Subsequent queries will throw an error.

#### tx.rollback( callback )

If you run into an error you can `rollback` and release the client. Subsequent queries will throw an error.

#### tx data access

All dirac.dals are available under the `tx` object.

__Example__

```javascript
var tx = dirac.tx.create();

tx.users.insert({ name: 'Ben Jammin' }, callback);
tx.restaurants.update(5, { name: 'Uncle Billys' }, callback);
```

#### Composing Transactions

Often times, you'll need to create custom functions that operate within its own transaction or part of an outside transaction. This is trivial to support and is outlined in the following example:

Suppose we want to create a function that atomically deletes existing user groups and saves new ones.

```javascript
var tx = require('dirac').tx.create();
tx.begin();

// Create a user
tx.users.insert({ name: 'Bob' }, function( error, user ){
  if ( error ){
    return tx.rollback();
  }

  // insert default groups
  tx.users.updateGroups( user.id, ['consumer'], function( error ){
    if ( error ){
      return tx.rollback();
    }

    tx.commit();
  });
});
```

How the DAL method would look:

```javascript
{ name: 'users'
, schema: {...}

, updateGroups: function( user_id, groups, callback ){
    // If this function is called within the context of an
    // existing transaction, the client/transaction object
    // will be available under `this.client`
    var tx = this.client || dirac.tx.create();

    async.series([
      // If we're a part of an existing transaction, don't worry
      // about writing `begin`
      this.client ? async.noop : tx.begin.bind( tx )

      // Remove existing groups
    , tx.user_groups.remove.bind( tx.user_groups, {
        user_id: user_id
      })

      // Insert if needed
    , groups.length > 0
      ? tx.user_groups.insert.bind(
          tx.user_groups
        , groups.map( function( group ){
            return { user_id: user_id, group: group };
          })
        )
      : async.noop

      // If we're a part of an existing transaction, don't worry
      // about writing `begin`
    , this.client ? async.noop : tx.commit.bind( tx )
    ], function( error ){
      if ( error ){
        // If there's an existing transaction, let's not
        // automatically rollback
        if ( this.client ){
          return callback( error );
        }

        return tx.rollback( callback.bind( null, error ) );
      }

      return callback();
    }.bind( this ));
  }
}
```

### Configure Data Access

Dirac exposes mongo-sql and pg instances through `dirac.db`.
This way your database layer can reuse the same connection pool
and data access configurations.

#### dirac.db.mosql

The mongo-sql instance

#### dirac.db.setMosql( mosql )

Replaces the mosql object

__Arguments__
* mosql - mongo-sql object

#### dirac.db.pg

The node-pg instance

#### dirac.db.setPg( pg )

Replaces the node-pg object

__Arguments__

* pg - node-pg object

#### Example of setting dirac.db.pg

```js
// Customizing pg so we parse timestamps into moment objects
var pg = require('pg');
var dirac = require('dirac');

var timestampOid = 1114;
var parseTimestamp = function(str) {
  return moment(str);
}

pg.types.setTypeParser(timestampOid, parseTimestamp);

// Now abstractions such as dirac can reuse the same pg.
dirac.db.setPg( pg );
```

## Examples

### Getting Started

Directory layout:

```
- my-app/
  - db/
    - tables/
      - table_1.js
      - table_2.js
      - table_3.js
    - index.js
```

__index.js:__

```javascript
/**
 * db.js
**/
var dirac = require('dirac');
var config = require('../config');

// Tell dirac to use all of the schemas in `/tables`
dirac.use( dirac.dir( __dirname + '/tables' ) );

dirac.init( config.db );

// Get our database schemas up to date
// This will add any tables and columns
dirac.sync();

// Expose dals on base db layer so I can do something like:
//   db.users.findOne( 7, function( error, user){ /* ... */ });
for ( var k in dirac.dals ) module.exports[ k ] = dirac.dals[ k ];
```

__table_1.js:__

```javascript
/**
 * table_1.js
 * Export a JavaScript object containing the
 * table.name, table.schema
**/
module.exports = {
  name: 'table_1'
, schema: {
    id:       { type: 'serial', primaryKey: true }
  , name:     { type: 'text' }
  , content:  { type: 'text' }
  }
, last_updated: {
    type: 'date'
  , withoutTimezone: true
  , default: 'now()'
  }
};
```

### Querying

One of the nicest parts about dirac is its robust querying DSL. Since it's built on top of MoSQL, we get to take advantage of a fairly complete SQL API.

__Find a single user by id:__

```javascript
dirac.dals.users.findOne( 7, function( error, user ){ /* ... */ });
```

__Find a user, join on groups and aggregate into array:__

```javascript
var options = {
  columns: [
    // Defaults to "users".*
    '*'

    // Columns can have sub-queries and expressions like this array_agg function
  , { type: 'array_agg', expression: 'groups.name', as: 'groups' }
  ]

  // Specify all joins here
, joins: {
    groups: {
      type: 'left'
    , on: { 'user_id': '$users.id$' }
    }
  }
}

// select "users".*, array_agg( groups.name ) as "groups" from "users"
//   left join "groups" on "groups"."user_id" = "users"."id"
//
// Now the user object will have an array of group names
dirac.dals.users.findOne( 7, function( error, user ){ /* ... */ });
```

__Sub-Queries:__

You can put sub-queries in lots of places with dirac/MoSQL

```javascript
var options = {
  // Construct a view called "consumers"
  with: {
    consumers: {
      type: 'select'
    , table: 'users'
    , where: { type: 'consumer' }
    }
  }
}

var $query = {
  name: { $ilike: 'Alice' }
, id: {
    $in: {
      type:     'select'
    , table:    'consumers'
    , columns:  ['id']
    }
  }
};

dirac.dals.users.find( $query, options, function( error, consumers ){ /* ... */ });
```

## Built-in Middleware

Dirac has the following built-in middleware modules:

* Cast To JSON
* Dir
* Embeds
* [Relationships](#middleware-relationships)
* Table Ref

### Middleware Relationships

The relationships middleware allows you to easily embed foreign data in your result set. Dirac uses the schemas defined with `dirac.register` to build a dependency graph of your schemas with pivots on foreign key relationships. It uses this graph to build the proper sub-queries to embed one-to-one or one-to-many type structures.

__Relationships Directives__

* [One](#relationships-one)
* [Many](#relationships-many)
* [Pluck](#relationships-pluck)
* [Mixin](#relationships-mixin)

__Full Blown Example:__

```javascript
var dirac = require('dirac');

// Make sure to call relationships before registering tables
dirac.use( dirac.relationships() );
dirac.use( dirac.dir( __dirname + '/tables' ) );

dirac.init( config );

// Embed Order Items as an array on the order
// Embed user and restaurant as json objects
var options = {
  many: [ { table: 'order_items'
          , alias: 'items'
            // Automatically do the left join to get item options
          , mixin: [{ table: 'order_item_options' }]
          }
        ]
, one:  [ { table: 'restaurants'
          , alias: 'restaurant'
          }
        , { table: 'users'
          , alias: 'user'
            // Automatically pull out just an array of group names
            // that apply to the user object
          , pluck: [ { table: 'groups', column: 'name' } ]
          }
        ]
};

dirac.dals.orders.findOne( user.id, options, function( error, user ){
  // Array.isArray( order.items ) => true
  // typeof order.restaurant === 'object' => true
  // typeof order.user === 'object' => true
  // Array.isArray( order.user.groups ) => true
});
```

This is all done with a single query to the database without any result coercion.

#### Relationships: One

Applies a one-to-one relationship on the query:

```javascript
// orders (id, user_id, ...)
// users (id, ...)
dirac.dals.orders.find( {}, {
  one: [{ table: 'users', alias: 'user' }]
})

// [{ id: 1, user: { ... } }, { id: 2, user: { ... } }]
```

#### Relationships: Many

Applies a one-to-many relationship on the query:

```javascript
// users (id, ...)
// orders (id, user_id, ...)
dirac.dals.users.findOne( 32, {
  many: [{ table: 'orders', alias: 'orders' }]
})

// { id: 32, orders: [{ id: 1, user_id: 32, ... }, { id: 2, user_id: 32, ... }] }
```

#### Relationships: Pluck

Like [Many](#relationships-many), but maps on a single field:

```javascript
// users (id, ...)
// groups (id, user_id, name, ...)
dirac.dals.users.findOne( 32, {
  pluck: [{ table: 'groups', column: 'name' }]
})

// { id: 32, groups: ['client', 'cool-guys'] }
```

#### Relationships: Mixin

Like [One](#relationships-one), but mixes in the properties from the target into the source (basically a more abstract join).

```javascript
// Useful for junction tables
// user_invoices (id, user_id, ...)
// user_invoice_orders (id, user_invoice_id, order_id, ...)
// orders (id, ...)
db.user_invoices.findOne( 1, {
 many: [ { table: 'user_invoice_orders'
         , alias: 'orders'
         , mixin: [ { table: 'orders' } ]
         }
       ]
})

// { id: 1, orders: [{ id: 1, user_invoice_id: 1, user_id: 1 }, ... ] }
```