var dirac = module.exports = require('./lib/dirac');
var utils = require('./lib/utils');
var diracSchema = require('./lib/dirac-table');

// Middleware
dirac.tableRef      = require('./middleware/table-ref');
dirac.castToJSON    = require('./middleware/cast-to-json');
dirac.embeds        = require('./middleware/embeds');
dirac.dir           = require('./middleware/dir');
dirac.relationships = require('./middleware/relationships');

dirac.mosql = utils.mosql;

dirac.setMoSql = function( instance ){
  utils.mosql = instance;
};