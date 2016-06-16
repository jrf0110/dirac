const chalk = require('chalk');
const sqlformatter = require('sqlformatter').format;

class QueryDebugger {
  static getTimeColorizer( seconds ){
    if ( seconds < 0.2 )  return chalk.green;
    if ( seconds < 0.4 )  return chalk.yellow;
    if ( seconds < 0.6 )  return chalk.orange;
                          return chalk.red;
  }

  constructor( query, values, original ){
    this.query = query;
    this.values = values;
    this.original = original;
    this.begin = new Date();
  }

  log(){
    console.log( this.highlight() );
  }

  end(){
    var seconds = (new Date() - this.begin) / 100;
    var colorizer = QueryDebugger.getTimeColorizer( seconds );

    console.log('Finished executing in', colorizer( seconds + 's' ) );
    console.log('');
  }

  highlight(){
    var ordering = QueryDebugger.highlightOrdering;

    return sqlformatter( this.query )
      .replace( QueryDebugger.regex.value, match => {
        var value = this.values[ +match.substring(1) - 1 ];

        if ( typeof value === 'string' ){
          return `'${value}'`;
        }

        return value;
      })
      .split('\n')
      .map( line => {
        return line.split(/\s/g).map( token => {
          var highlighter;

          for ( var i = ordering.length - 1, regex; i >= 0; i-- ){
            regex = QueryDebugger.regex[ ordering[ i ] ];

            if ( regex.test( token ) ){
              highlighter = QueryDebugger.style[ ordering[ i ] ];
              break;
            }
          }

          if ( highlighter ){
            return highlighter( token );
          }

          return token;
        })
        .join(' ');
      })
      .join('\n')
  }
}

QueryDebugger.highlightOrdering = [
  'keyword'
, 'number'
, 'primitive'
, 'value'
, 'quotes'
, 'string'
];

QueryDebugger.regex = {
  keyword: new RegExp( require('./sql-keywords').join('|'), 'ig' )
, quotes: /("[^"]*")/g
, string: /('[^']*')/g
, number: /-?\d+(?:\.\d+)?(?:e-?\d+)?/g
, primitive: /true|false|null/g
, value: /\$\d+/g
};

QueryDebugger.style = {
  keyword: token => chalk.bold.white( token )
, quotes: token => chalk.cyan( token )
, string: token => chalk.yellow( token )
, number: token => chalk.red( token )
, primitive: token => chalk.red( token )
, value: token => chalk.blue( token )
};

module.exports = QueryDebugger;