JS.Kernel = new JS.Module({
  __eigen__: function() {
    if (this.__meta__) return this.__meta__;
    var module = this.__meta__ = new JS.Module({}, {_resolve: this});
    module.include(this.klass.__mod__);
    return module;
  },

  extend: function(module, resolve) {
    return this.__eigen__().include(module, {_extended: this}, resolve !== false);
  },

  isA: function(moduleOrClass) {
    return this.__eigen__().includes(moduleOrClass);
  },

  inspect : function() {
    return this.toString();
  },

  methodMissing : function(name, args) {
    throw 'undefined method: `'+name+"' for "+this.inspect();
  },

  respondTo: function(name) {
    var result = this[name] && !this[name].isMissing;
    if (typeof(result) === 'undefined')
      JS.MethodMissing.addMethod(name);
    return !!result;
  },

  method: function(name) {
    var self = this, cache = self.__mcache__ = self.__mcache__ || {}, method;
    if ((cache[name] || {}).fn === self[name]) {
      method = cache[name];
    } else {
      cache[name] = {fn: self[name], bd: JS.bind(self[name], self)};
    }
    if (!method)
      throw 'undefined method: `'+name+'\' for '+this.inspect();
    return method.bd;
  },

  tap: function(block, scope) {
    block.call(scope || null, this);
    return this;
  }
});

