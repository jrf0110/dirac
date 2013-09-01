# Dirac.js - Lightweight Postgres Layer

Paul Dirac was a theoretical physicist who made fundamental contributions to the early development of both quantum mechanics and quantum electrodynamics. Dirac.js is a flexible and extendable database layer for Node Postgres.

## Database as a Data Structure

Dirac.js is built on top of [https://github.com/goodybag/mongo-sql](MongoSQL), whose primary goal is to provide SQL query construction, but maintain value consistently throughout. This library extends that goal allowing you to reflect on the overall state of your database and retrieve your table structure in semantic JSON.

Dirac provides you with a decent foundation to start a postgres project with. It allows you to easily group all of your table logic and schema into one file and keep things generally dry and well-namespaced.

## Features

* Non-destructive database syncing
* Standard crud
* Robust JSON queries

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

// Creates new tables, performs non-destructive schema changes
db.sync(); // Optionally pass { force: true } to do a complete wipe

// You do not need to supply a callback.
// You can start querying right away since node-pg
// queues queries until ready
dirac.dals.users.find({ id: { $gt: 5 } }, function(error, users){
  /* ... */
})

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

The Root namespace is for top-level non-database specific methods while the Databasse namepace is for database specfic methods

### Root

#### ```dirac.init( connStr [options], [options] )```

Connect to Postgres

__Arguments:__

* Connection String or Options
* Options
  - Must contain property called ```connStr```
  - Will mix into ```pg.defaults```

___Options:___

* ```connectionString```


#### ```dirac.dropAllTables( [callback] )```

Drops all tables registered in dirac.

__Arguments:__

* Callback ```(error)```

#### ```dirac.register( name, schema )```

Registers a new table with dirac. Will not actually create the table until ```dirac.sync()``` is called. Alternatively, you could call: ```dirac.dals.table_name.createIfNotExists()``` to manually add it. However, ```sync``` will resolve table dependencies and it will also save the database state so dirac can reason about your current table structure.

__Arguments:__

* Name - name of the table
* Schema - as described in [https://github.com/goodybag/mongo-sql](https://github.com/goodybag/mongo-sql) create table statement definitions

#### ```dirac.sync( options )```

#### ```dirac.createTable( )```

#### ```dirac.saveCurrentDbState( )```

### Database

All table interfaces are accessed through the ```dirac.dals``` namespace. Each table is defined as an instance of Dirac.Dal.

#### ```dirac.dals.table_name.find( $query, [options], callback )```

Select documents in ```table_name```.

__Arguments:__

* $query - MoSQL conditional query ( select where clause )
* options - Anything else that would go in a MoSQL query ( limit, offset, groupBy, etc )
* callback - ```function( error, results ){ }```

#### ```dirac.dals.table_name.findOne( $query, [options], callback)```

Identical to find only it adds a ```limit: 1``` to the options and will return an object rather than an array.  Substitute an ID for $query.

__Arguments:__

* $query - MoSQL conditional query ( select where clause ) or ID
* options - Anything else that would go in a MoSQL query ( limit, offset, groupBy, etc )
* callback - ```function( error, result ){ }```

#### ```dirac.dals.table_name.remove( $query, [options], callback )```

Removes a document from the database. Substitute an ID for $query.

__Arguments:__

* $query - MoSQL conditional query ( select where clause ) or ID
* options - Anything else that would go in a MoSQL query ( returning, etc )
* callback - ```function( error, result ){ }```

#### ```dirac.dals.table_name.update( $query, $update, [options] callback )```

Update documents in the database. Substitute an ID for $query.

__Arguments:__

* $query - MoSQL conditional query ( select where clause ) or ID
* $update - Object whose keys map to column names and values map to values
* options - Anything else that would go in a MoSQL query ( returning, etc )
* callback - ```function( error, result ){ }```

#### ```dorac.dals.table_name.insert( document, [options], callback )```

Insert a doument

__Arguments:__

* document - Object whose keys map to column names and values map to values
* options - Anything else that would go in a MoSQL query ( returning, etc )
* callback - ```function( error, result ){ }```

## How do I use it in a project?

I create a database module, typically called ```db```.

```javascript
/**
 * db.js
**/
var dirac = require('dirac');
var config = require('../config');

dirac.init( config.db );

// Each item in the collection maps to a filename in the ./collections folder
[
  'users'
, 'groups'
, 'snippets'
].map( function( t ){
  return require( './collections/' + t );
}).forEach( dirac.register );

dirac.sync();

// Expose dals on base db layer so I can do something like:
//   db.users.findOne( 7, function( error, user){ /* ... */ });
module.exports = dirac.dals;

/**
 * snippets.js
**/
module.exports = {
  name: 'snippets'
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
