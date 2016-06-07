const Database = require('./lib/database');
const Relationships = require('./middleware/relationships');

module.exports = options => {
  var db = Database.create( options )
    .use( Relationships.QueryMethods() );

  var oldRegister = db.register;

  db.register = table =>{
    return oldRegister.call( this, table ).mutate( db => {
      // Remove old relationships transform
      db.queryTransforms = db.queryTransforms.filter( transform => {
        return !(transform instanceof Relationships.QueryTransform);
      });

      // Add the new transform with the updated graph
      db.use( Relationships.Transform( db.graph ) );
    });
  };

  return db;
}