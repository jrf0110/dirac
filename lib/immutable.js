class Immutable {
  static create( options ){
    return new this( options );
  }

  constructor( options = {} ){
    this.options = options;
    this.options.immutable = typeof this.options.immutable === 'boolean'
      ? this.options.immutable : true;
  }

  instance(){
    return this.options.immutable ? this.clone() : this;
  }

  clone(){
    var options = Object.assign( {}, this.options );
    return Immutable.create( options );
  }

  mutate( handler ){
    var prev = this.options.immutable;

    this.options.immutable = false;
    handler( this );
    this.options.immutable = prev;

    return this;
  }
}

module.exports = Immutable;