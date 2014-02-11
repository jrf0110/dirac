/**
 * DAL Directory
 * Specify the directory where table schemas/dal defs live
 *
 * dirac.use( dirac.dir( __dirname + '/dals' ) )
 */

var fs    = require('fs');
var path  = require('path');

module.exports = function( dir ){
  if ( !dir ) throw new Error('Dirac.middleware.directory - Missing first argument');

  return function( dirac ){
    fs.readdirSync( dir ).filter( function( file ){
      return fs.statSync( path.join( dir, file ) ).isFile();
    }).map( function( file ){
      return require( path.join( dir, file ) );
    }).forEach( function( dal ){
      dirac.register( dal );
      dirac.instantiateDal( dal.name );
    });
  };
};