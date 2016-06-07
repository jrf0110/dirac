class QueryTransform {
  static create( handler ){
    return new this( handler );
  }

  constructor( handler ){
    this.handler = handler;
  }

  execute( query ){
    return this.handler( query );
  }
}

module.exports = QueryTransform;