# Dirac.js - Lighweight Postgres Layer

Paul Dirac was a theoretical physicist who made fundamental contributions to the early development of both quantum mechanics and quantum electrodynamics. Dirac.js is a flexible and extendable database layer for Node Postgres.

## Database as a Data Structure

Dirac.js is built on top of [https://github.com/goodybag/mongo-sql](MongoSQL), whose primary goal is to provide SQL query construction, but maintain value consistently throughout. This library extends that goal allowing you to reflect on the overall state of your database and retrieve your table structure in semantic JSON.

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
dirac.connect('postgres://server/database');

// Creates new tables, performs non-destructive schema changes
db.sync(); // Optionally pass { force: true } to do a complete wipe

// You do not need to supply a callback.
// You can start querying right away since node-pg
// queues queries until ready
dirac.users.find({ id: { $gt: 5 } }, function(error, users){
  /* ... */
})
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

#### ```dirac.table_name.find( $query, [options], callback )```

Select documents in ```table_name```.

__Arguments:__

* $query - MoSQL conditional query ( select where clause )
* options - Anything else that would go in a MoSQL query ( limit, offset, groupBy, etc )
* callback - ```function( error, results ){ }```

#### ```dirac.table_name.findOne( $query, [options], callback)```

Identical to find only it adds a ```limit: 1``` to the options and will return an object rather than an array.

__Arguments:__

* $query - MoSQL conditional query ( select where clause )
* options - Anything else that would go in a MoSQL query ( limit, offset, groupBy, etc )
* callback - ```function( error, result ){ }```

#### ```dirac.table_name.remove( $query, callback )```

#### ```dirac.table_name.update( $query, $update, callback )```

#### ```dorac.table_name.insert( document, [options], callback )```
