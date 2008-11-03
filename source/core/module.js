JS.Module = JS.makeFunction();
JS.extend(JS.Module.prototype, {
  initialize: function(methods, options) {
    options = options || {};
    this.__mod__ = this;
    this.__inc__ = [];
    this.__fns__ = {};
    this.__dep__ = [];
    this.__res__ = options._resolve || null;
    this.include(methods || {});
  },

  define: function(name, func, options) {
    options = options || {};
    this.__fns__[name] = func;
    if (JS.Module._notify && options._notify && JS.isFn(func))
        JS.Module._notify(name, options._notify);
    var i = this.__dep__.length;
    while (i--) this.__dep__[i].resolve();
  },

  instanceMethod: function(name) {
    var method = this.lookup(name).pop();
    return JS.isFn(method) ? method : null;
  },

  instanceMethods: function(includeSuper) {
    typeof(includeSuper) === 'undefined' && (includeSuper = true);
    var names = [];
    var seen = {};
    var addNames = function(mod) {
      for (var name in mod.__mod__.__fns__) {
        !seen[name] &&
          typeof(name) === 'string' &&
          JS.isFn(mod.__mod__.__fns__[name]) &&
          (seen[name] = true) &&
          names.push(name);
      }
      if (includeSuper) {
        var ancestors = mod.ancestors();
        for (var i = 0, n = ancestors.length; i < n; i++) {
          if (seen[ancestors[i]]) continue;
          seen[ancestors[i]] = true;
          addNames(ancestors[i]);
        }
      }
    };
    addNames(this);
    return names;
  },

  include: function(module, options, resolve) {
    if (!module) return resolve && this.resolve();
    options = options || {};
    var inc = module.include, ext = module.extend, modules, i, n, method,
        includer = options._included || this;

    if (module.__inc__ && module.__fns__) {
      this.__inc__.push(module);
      module.__dep__.push(this);
      if (options._extended) module.extended && module.extended(options._extended);
      else module.included && module.included(includer);
    }
    else {
      if (options._recall) {
        for (method in module) {
          if (JS.ignore(method, module[method])) continue;
          this.define(method, module[method], {_notify: includer || options._extended || this});
        }
      } else {
        if (typeof inc === 'object') {
          modules = [].concat(inc);
          for (i = 0, n = modules.length; i < n; i++)
            includer.include(modules[i], options);
        }
        if (typeof ext === 'object') {
          modules = [].concat(ext);
          for (i = 0, n = modules.length; i < n; i++)
            includer.extend(modules[i], false);
          includer.extend();
        }
        options._recall = true;
        return includer.include(module, options, resolve);
      }
    }
    return resolve && this.resolve();
  },

  includes: function(moduleOrClass) {
    if (Object === moduleOrClass || this === moduleOrClass || this.__res__ === moduleOrClass.prototype)
      return true;
    var i = this.__inc__.length;
    while (i--) {
      if (this.__inc__[i].includes(moduleOrClass))
        return true;
    }
    return false;
  },

  ancestors: function(results) {
    results = results || [];
    for (var i = 0, n = this.__inc__.length; i < n; i++)
      this.__inc__[i].ancestors(results);
    var klass = (this.__res__||{}).klass,
        result = (klass && this.__res__ === klass.prototype) ? klass : this;
    result !== JS.MethodMissing && // avoid processing missing methods
      JS.indexOf(results, result) === -1 && results.push(result);
    return results;
  },

  lookup: function(name) {
    var ancestors = this.ancestors(), results = [], i, n, method;
    for (i = 0, n = ancestors.length; i < n; i++) {
      method = ancestors[i].__mod__.__fns__[name];
      if (method) results.push(method);
    }
    return results;
  },

  make: function(name, func) {
    if (!JS.isFn(func) || !JS.callsSuper(func)) return func;
    var module = this;
    return function() {
      return module.chain(this, name, arguments);
    };
  },

  chain: JS.mask( function(self, name, args) {
    var callees = this.lookup(name),
        stackIndex = callees.length - 1,
        currentSuper = self.callSuper,
        params = JS.array(args),
        result;

    var noMoreSuper = function() {
      var methodMissing = JS.Kernel.instanceMethod('methodMissing');
      if (methodMissing === self.methodMissing)
        throw "No superclass method `"+name+"' on "+self.inspect();
      else
        return self.methodMissing(name, params);
    };

    self.callSuper = function() {
      var i = arguments.length, superFun, returnValue;
      while (i--) params[i] = arguments[i];
      stackIndex -= 1;
      superFun = callees[stackIndex];
      if (superFun) returnValue = superFun.apply(self, params);
      else returnValue = noMoreSuper();
      stackIndex += 1;
      return returnValue;
    };

    result = callees.pop().apply(self, params);
    currentSuper ? self.callSuper = currentSuper : delete self.callSuper;
    return result;
  } ),

  resolve: function(target) {
    var target = target || this, resolved = target.__res__, i, n, key, made;

    if (target === this) {
      i = this.__dep__.length;
      while (i--) this.__dep__[i].resolve();
    }

    if (!resolved) return;

    for (i = 0, n = this.__inc__.length; i < n; i++)
      this.__inc__[i].resolve(target);
    for (key in this.__fns__) {
      made = target.make(key, this.__fns__[key]);
      if (resolved[key] !== made) resolved[key] = made;
    }
  }
});

