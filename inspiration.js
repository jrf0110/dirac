var db = require('dirac')({ connectionString })

db.users = db.table('users')
  .stream({ concurrency: 10 })
  .where({ id: { $gt: 100 } })
  .map()

//

var db = require('dirac')({ connectionString: '...' })

db.users = db.dal({
  name: 'users'
, schema: {...}
})

db.users
  .find()
  .where({ id: { $gt: 100 } })
  .where('id.$or.$lt', 500)
  .exec()
  .then( users => ... )
  .catch( error => ... )

// ...
( db )=>{
  db.before
}

db.users.findOne(100)
  .options({
    many: [ { table: 'orders'
            , many: [ ... ]
            }
          ]
  })

db.users.findOne(100)
  .many({ table: '' })

//

db.tx().begin()
  // Update book 123
  .then( tx => {
    return db.books.update(123)
      .values({ likes: { $inc: 1 } })
      .returning('*')
      .exec( tx )
  })
  // Update the book author's total likes
  .then( tx => {
    // Transaction results are accumulated on `tx.results`
    // We know the result is a single object since the operation
    // was updating the table via the singular condition by primary key
    return db.authors.update( tx.results.book.author_id )
      .values({ total_likes: { $inc: 1 } })
      .returning('*')
      .exec( tx )
  })
  .then( tx => tx.commit() )
  .catch( error => tx.abort() )
  .then( results => {
    res.json( results.book );
  });

//

var query = users
  .findOne(123)
  // Find orders in parallel
  .and( orders.find().where({ user_id: 123 }) )
  // Results accumulate on an object
  // Map the result to just the user object
  .map( result => {
    result.user.orders = result.orders;
    return result.user;
  })
  // After that, insert something requiring the user data
  .then( user => user_thing.insert({ foo: 'bar', user }) )

db.execute( query )
  .then( user => res.json( user ) )
  .catch( error => res.error( error ) )

//

var db = require('dirac')()
  // Use .register to automatically add the table to
  // the database instance (each register call creates
  // a new instance unless options.immutable: false).
  // As new tables are registered, the dependency graph
  // is updated
  .register(
    db.table({
      name: 'users'
    , schema: {
        id: { type: 'serial', primaryKey: true }
      , name: { type: 'text' }
      }
    })
    // If you want to map all results from this query factory to
    // an application model, you could do something like this:
    .after( users => {
      if ( Array.isArray( users ) ){
        return users.map( user => UserModel.create( user ) )
      }

      // Otherwise, they used a method that returned one result
      return UserModel.create( users )
    })
  )
  // Optionally, just pass in the table definition to register
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
  })

// Remove user 123 returning the user object
// and the user's books
var query = db.users
  .remove(123)
  .returning('*')
  .many(
    db.query()
      .table('user_books')
      .alias('books')
      .mixin('books')
  );

// Note: user instanceof UserModel === true
query.exec().then( user => console.log( user.books[0].name ) )

// Notes on transactions
// 
db.transaction()
  .begin( tx => {

    tx.query(  )
      .then( ()=> {
        

        
      })
    .then( ()=> tx.commit() )
  })

// Transactions should behave more like Queries
// where calling .query(..) simply adds queries to the transaction
// building up a transaction plan
// and .execute() would execute that plan
var createUser = user => {
  return db.transaction()
    // Insert base user object
    .query( tx => db.users.insert(user) )
    // Insert user's groups with the new user_id assigned
    .query( tx => {
      let groups = user.groups.map( group => {
        return Object.assign( { user_id: tx.user.id }, group )
      })

      return tx.query( db.user_groups.insert(groups) )
    })
}

var createOrder = order => {
  return db.transaction()
    // Insert base order
    .query( tx => db.orders.insert(order) )
    // Also, update the order_statuses table
    // This is a bit of a contrived example since you'd probably do this with triggers
    .query( tx => db.order_statuses.insert({ order_id: tx.order.id,  }))
}

// This way, you can compose transactions
createUser(user)
  .query( tx => createOrder( Object.assign(order, { user_id: tx.user.id } ) ) )
  .execute()
  .then( results => {
    console.log( results.user, results.order );
  })