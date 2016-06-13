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

db.users.find()
  .where({ id: { $gt: 100 } })
  // .many({ table: 'orders', limit: 2, order: { id: 'desc' }, columns: ['id', 'user_id', 'restaurant_id'] })
  .stream()
  .then( stream => {
    return new Promise( ( resolve, reject )=> {
      stream.on('data', console.log);
      stream.once('error', reject);
      stream.on('end', resolve);
    });
  })
  .then( user => process.exit(0) )
  .catch( e =>{ throw e } )