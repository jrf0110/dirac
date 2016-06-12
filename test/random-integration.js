process.on('unhandledRejection', error => {
  throw error;
});

var db = require('../')()
  .database('cater')
  .register({
    name: 'users'
  , schema: {
      id: { type: 'serial', primaryKey: true }
    }
  })
  .register({
    name: 'orders'
  , schema: {
      id: { type: 'serial', primaryKey: true }
    , user_id: { type: 'int', references: { table: 'users', column: 'id' } }
    }
  })

db.users
  .findOne(11)
  .many({ table: 'orders', limit: 2, columns: ['id', 'user_id', 'restaurant_id'] })
  .execute()
  .then( user => console.log( user ) )
  .then( user => process.exit(0) )
  .catch( e =>{ throw e } )