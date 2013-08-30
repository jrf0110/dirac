// Your own local db module that wraps dirac
var db = require('./db');
// Your own local middleware module that wraps dirac-middleware
var m = require('./lib/middleware');
// Pretend express is here
var app = express();

app.get( '/api/users'
  // Use Dirac Middleware function `pagination` to add limit|offset support
  // for this route defaulting limit to 30
, m.pagination( 'pagination', 30 )
  // Set table.some_condition = /users?some_condition
, m.param( 'some_condition' )
, m.param( 'created_at', function( created_at, 
);
