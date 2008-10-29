/***
 * Copyright (c) 2008 Victor Hugo Borja <vic.borja gmail.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */


/**
 * The JS.Spec class provides a minimalist bdd framework built with JS.Class
 *
 * Features:
 *   - RSpec like syntax
 *   - JS.Class power, so you can mixin methods on example groups selectively.
 *   - No need for running on a browser (rhino, v8, friendly)
 *   - Easy to create your own matchers and reporters.
 *   - It's javascript with ruby flavor !.
 *
 *
 * Usage:
 *
 *   To use this library you need to import the following JS.Class files:
 *     class.js, enumerable.js, spec.js
 *
 * A sample hello_spec.js file could look something like:
 *
 *   load("js.class/class.js");
 *   load("js.class/enumerable.js");
 *   load("js.class/spec.js");
 *
 *   // create a new js.spec suite
 *   // on a browser environment, you could store the spec suite on a variable
 *   // and load the examples using ajax, adding them to the same suite.
 *   with(new JS.Spec()) {
 *
 *     describe("TEH AWESOME APP (Running on V8Shell)", function() {
 *
 *       it("Supports pending examples like this");
 *
 *       it("Defines an example like this", function() {
 *          "SomeObject".should( match(/me/) );
 *       });
 *
 *       before('each', function() { }); // before each test
 *       before(/only for ones matching this/, function() {})
 *
 *       after('each', function() {});
 *
 *       // you can mixin methods with JS.Class
 *       // each example will have those methods available.
 *       include(MySpec.HelperMethods);
 *
 *       // or just define them
 *       def('hello', function(who) {
 *         return "Hola "+who;
 *       });
 *
 *       it("can use those methods in this group hierarchy", function() {
 *          hello("mundo").should( equal("Hola mundo") );
 *       });
 *
 *       describe("Nested groups", function() {
 *
 *         after('each', function() {}); // only in this group
 *
 *         it("inherits parent groups mixins", function() {
 *            hello("monde").length.should( be(10) );
 *         });
 *
 *       });
 *
 *     });
 *
 *     describe("Some Other Thing, No hello method available");
 *
 *     // the runner method takes a list of config objects to create
 *     // spec reporters, currently only specdoc output id provided, but
 *     // you can create your owns.
 *     runner({format : 'specdoc', console : print, color : true})();
 *
 *     // Just run the examples matching some pattern
 *     runner({format : 'specdoc', console : print})(/some pattern/);
 *
 *   }
 *
 *
 */
JS.Spec = new JS.Class({
  extend : {
    instance : function() {
      this._instance = this._instance || new JS.Spec();
      return this._instance;
    },

    applyBody : function(self, body, args) {
      if (body) {
        var fun = eval("function() { with(this) { return ("+
                       body.toString()+").apply(this, arguments); } }");
        args = args || [self];
        return fun.apply(self, args);
      }
      return undefined;
    }
  },
  initialize : function(body) {
    this._root = new JS.Spec.ExampleGroup('', undefined);
    if (body) {
      JS.Spec.applyBody(this, body);
    }
  },
  describe : function() {
    return this._root.describe.apply(this._root, arguments);
  },
  runner : function() {
    var listeners = new JS.Enumerable.
      Collection(arguments).map(function(config) {
        return JS.Spec.Listener.instance(config);
      });
    var runner = new JS.Spec.Runner(listeners, this._root);
    return function(filter) {
      runner.run(filter);
    };
  }
});

/**
 * Encapsulates an example failure, so that reporters can
 * obtain info to display.
 */
JS.Spec.ExampleFailure = new JS.Class({
  initialize : function(msg, positive, expectation) {
    this._message = msg;
    this._positive = positive;
    this._expectation = expectation;
  },
  message : function() {
    return this._message;
  },
  isPositive : function() {
    return this._positive == true;
  },
  expectation : function() {
    return this._expectation;
  }
});

/**
 * Add should and should_not methods to kernel Object.
 */
JS.extend(Object.prototype, {
  should : function(expectation) {
    if (!expectation.matches(this)) {
      throw new JS.Spec.ExampleFailure(expectation.failure_message(),
                                       true, expectation);
    }
  },
  should_not : function(expectation) {
    if (expectation.matches(this)) {
      throw new JS.Spec.ExampleFailure(expectation.negative_failure_message(),
                                       false, expectation);
    }
  }
});


/***
 * The base matcher class
 */
JS.Spec.Matcher = new JS.Class({
  initialize : function(example) {
    this._example = example;
  },
  example : function() {
    return this._example;
  },
  init_matcher : function() {
    throw "init_matcher Not Implemented";
  },
  extend : {
    register : function(name, cls) {
      var obj = {};
      var self = this;
      obj[name] = function() {
        var matcher = new cls(self);
        matcher.init_matcher.apply(matcher, arguments);
        return matcher;
      };
      JS.Spec.Matcher.Methods.include(obj);
    },
    inherited : function(sub) {
      if (sub.matcher) { this.register(sub.matcher, sub); }
    }
  }
});


/**
 * This module is included on every example instance,
 * matchers inheriting JS.Spec.Matcher get registered
 * as instance methods in this module.
 */
JS.Spec.Matcher.Methods = new JS.Module({

});

/****************
 * The matchers
 ****************/
JS.Spec.Matcher.Be = new JS.Class(JS.Spec.Matcher, {
  extend : { matcher : 'be' },

  init_matcher : function(expected) {
    this._expected = expected;
  },

  matches : function (target) {
    this._target = target;
    return this._expected === target;
  },

  failure_message : function() {
    return "Expected "+this._target+" to be "+this._expected;
  },

  negative_failure_message : function() {
    return "Not expected "+this._target+" to be "+this._expected;
  }
});

JS.Spec.Matcher.Equal = new JS.Class(JS.Spec.Matcher, {
  extend : { matcher : 'equal' },

  init_matcher : function(expected) {
    this._expected = expected;
  },

  matches : function (target) {
    this._target = target;
    return this._expected == target;
  },

  failure_message : function() {
    return "Expected "+this._target+" to equal "+this._expected;
  },

  negative_failure_message : function() {
    return "Not expected "+this._target+" to equal "+this._expected;
  }
});


JS.Spec.Matcher.Match = new JS.Class(JS.Spec.Matcher, {
  extend : { matcher : 'match' },

  init_matcher : function(pattern) {
    this._pattern = pattern;
  },

  matches : function (target) {
    this._target = target;
    return target.matches(this._pattern);
  },

  failure_message : function() {
    return "Expected "+this._target+" to match "+this._pattern;
  },

  negative_failure_message : function() {
    return "Not expected "+this._target+" to match "+this._pattern;
  }
});


/**
 * An example within an ExampleGroup, created by "it" method.
 */
JS.Spec.Example = new JS.Class({
  extend : {
    Instance : new JS.Class({
      initialize : function(example) {
        this._example = example;
        this.extend(example._group._module);
      },
      example: function() {
        return this._example;
      },
      execute: function() {
        this.before();
        JS.Spec.applyBody(this, this._example._body);
        this.after();
      }
    })
  },

  initialize : function(name, group) {
    this._name = name;
    this._group = group;
  },

  name : function() {
    return this._group.name() + ' ' + this._name;
  },

  group : function() {
    return this._group;
  },

  body : function(value) {
    if (value) {
      this._body = value;
      return this;
    } else {
      return this._body;
    }
  }
});

/**
 * An example group created with "describe" method.
 */
JS.Spec.ExampleGroup = new JS.Class({
  initialize : function(name, body, parent) {
    this._name = name;
    this._parent = parent;
    this._examples = {};
    this._examples_ord = [];
    this._module = new JS.Module({
      include : JS.Spec.Matcher.Methods
    });
    if (parent) { this.include(parent._module); }
    this.include(new JS.Module({
      before : function() { this.callSuper(); },
      after : function() { this.callSuper(); }
    }));
    JS.Spec.applyBody(this, body);
  },

  def : function(name, fun) {
    if (fun)  {
      var obj = {};
      obj[name] = fun;
      this._module.include(obj);
    } else {
      this._module.include.apply(this._module, [name]);
    }
    return this;
  },

  include : function() {
    this._module.include.apply(this._module, arguments);
  },

  name : function() {
    if (this._parent) {
      return this._parent.name() + ' ' + this._name;
    } else {
      return this._name;
    }
  },

  before : function(when, action) {
    this._module.include(new JS.Module({
      before : function() {
        this.callSuper();
        if (when == 'each' ||
            when == this.example()._name ||
            when == this.example().name() ||
            this.example().name().match(when) ||
            this.example()._name.match(when)) {
          action.apply(this, []);
        }
      }
    }));
  },

  after : function(when, action) {
    this._module.include(new JS.Module({
      after : function() {
        if (when == 'each' ||
            when == this.example()._name ||
            when == this.example().name() ||
            this.example().name().match(when) ||
            this.example()._name.match(when)) {
          action.apply(this, []);
        }
        this.callSuper();
      }
    }));
  },

  it : function(name, body) {
    var example = this._examples[name];
    if (!example) {
      example = new JS.Spec.Example(name, this);
      this._examples[name] = example;
      this._examples_ord.push(name);
    }
    if (example.body()) {
      throw "Cannot define example '"+example.name()+"' more than once.";
    }
    example.body(body);
    return example;
  },

  describe : function() {
    this._child_groups = this._child_groups || {};
    this._child_groups_ord = this._child_groups_ord || [];
    var args = JS.array(arguments);
    var body;
    if (JS.isFn(args[args.length - 1])) { body = args.pop(); }
    var first = args.shift().toString();
    var name = new JS.Enumerable.Collection(args).
      inject(first, function(s, i){ return s + " " + i.toString(); });
    var group = this._child_groups[name];
    if (!group) {
      group = new JS.Spec.ExampleGroup(name , body, this);
      this._child_groups[name] = group;
      this._child_groups_ord.push(name);
    }
    return group;
  }

});

/**
 * The class responsible for selecting, running examples
 * and notifying about their status.
 */
JS.Spec.Runner = new JS.Class({
  initialize : function(listeners, root) {
    this._listeners = listeners;
    this._root = root;
  },
  notify: function() {
    var args = JS.array(arguments);
    var event = args.shift();
    new JS.Enumerable.Collection(JS.array(this._listeners)).forEach(function(i) {
      if (JS.isFn(i[event])) {
        i[event].apply(i, args);
      }
    });
  },
  run : function(filter) {
    filter = filter || /.?/;
    var groups_seen = {};
    var self = this;
    var current_group;
    self.notify('onStart');
    this.trasverse_examples(this._root, filter, function(instance) {
      var group_name = instance.example().group().name();
      if (!groups_seen[group_name]) {
        groups_seen[group_name] = true;
        if (current_group && current_group != group_name) {
          self.notify('onGroupEnd', instance);
        }
        current_group = group_name;
        self.notify('onGroupStart', instance);
      }
      if (instance.example()._body) {
        try {
          self.notify('onExampleStart', instance);
          instance.execute();
          self.notify('onExampleSuccess', instance);
        } catch (o) {
          if (o instanceof JS.Spec.ExampleFailure) {
            self.notify('onExampleFailure', instance, o);
          } else {
            self.notify('onExampleError', instance, o);
          }
        }
      } else {
        self.notify('onExamplePending', instance);
      }
    });
    self.notify('onEnd');
  },
  trasverse_examples : function(root, filter, callback) {
    new JS.Enumerable.Collection(root._examples_ord).forEach(function(i) {
      var mod = root._examples[i];
      if (mod.name().match(filter)) {
        var example = new JS.Spec.Example.Instance(mod);
        callback(example);
      }
    });
    var self = this;
    new JS.Enumerable.Collection(root._child_groups_ord).forEach(function(i) {
      var grp = root._child_groups[i];
      self.trasverse_examples(grp, filter, callback);
    });
  }
});

/**
 * Base class for objects listening to runner events (succeed, fail, pending, etc)
 */
JS.Spec.Listener = new JS.Class({
  initialize : function(config) {
    this.extend(config);
  },

  extend : {
    instance : function(config) {
      if (JS.isFn(this[config.format])) {
        return new (this[config.format])(config);
      }
      throw "Cannot construct a listener from format type: "+config.format;
    },

    inherited : function(sub) {
      if (sub.format) { this[sub.format] = sub; }
    }
  }
});

/**
 * A basic specdoc formatter like the one for RSpec.
 * Intended to be used on the command line.
 */
JS.Spec.Listener.ConsoleSpecdoc = new JS.Class(JS.Spec.Listener, {
  extend : { format : 'specdoc' },

  initialize : function() {
    this.color = true;
    this.callSuper();
    this._succeeded = 0;
    this._pendings = [];
    this._failed = [];
  },

  onGroupStart : function(instance) {
    this.console('');
    this.console(instance.example().group().name());
  },

  onExampleSuccess : function(instance) {
    this.console(this.info('- '+instance.example().name()));
    this._succeeded += 1;
  },

  onExamplePending : function(instance) {
    this.console(this.warn('- '+instance.example().name() +
                             ' (PENDING: Not Yet Implemented)'));
    this._pendings.push(instance);
  },

  onExampleFailure : function(instance, failure) {
    this.console(this.error('- '+instance.example().name() +
                          ' (FAILED - '+this._failed.length+')'));
    this._failed.push({
      failure : failure,
      instance : instance
    });
  },

  onExampleError : function(instance, failure) {
    this.console(this.error('- '+instance.example().name() +
                            ' (ERROR - '+this._failed.length+')'));
    this._failed.push({
      error : failure,
      instance : instance
    });
  },

  useColors : function () {
    return this.color != undefined;
  },

  ansi_color: function(str, color) {
    if (!this.useColors()) {
      return str;
    }
    var colors = {
      red : "\033[0;31m",
      green : "\033[0;32m",
      yellow : "\033[0;33m",
      purple : "\033[0;35m"
    };
    return colors[color] + str + "\033[0m";
  },

  info : function(str) {
    return this.ansi_color(str, 'green');
  },

  error : function(str) {
    return this.ansi_color(str, 'red');
  },

  warn : function(str) {
    return this.ansi_color(str, 'purple');
  },

  printPendings : function() {
    var self = this;
    if (self._pendings.length > 0) {
      self.console('Pending:');
      var i = 0;
      new JS.Enumerable.Collection(self._pendings).forEach(function(e) {
        self.console(e.example().name() + ' (Not Yet Implemented)');
        i += 1;
      });
    }
  },

  printFailures : function() {
    var self = this;
    if (self._failed.length < 1) {
      return;
    }
    self.console('');
    self.console('Failures:');
    var i = 0;
    new JS.Enumerable.Collection(self._failed).forEach(function(f) {
      self.console('');
      self.console(i+')');
      if (f.error) {
        self.console(self.error(f.error+" in '"+f.instance.example().name()+"'"));
      } else {
        self.console(self.error("'"+f.instance.example().name()+"' FAILED"));
        self.console(f.failure.message());
      }
      i += 1;
    });
  },

  onEnd : function() {
    var self = this;
    self.console('');
    self.printPendings();
    self.printFailures();
    self.console('');
    self.console((self._failed.length +
                  self._pendings.length +
                  self._succeeded + ' examples, ')+
                 (self._failed.length+' failures, ')+
                 (self._pendings.length + ' pending'));
  }

});

/**
 * TODO:
 * - Better error reporting (backtraces)
 * - A DOM based reporter (useful when running in browser)
 * - More matchers.
 * - Use JS.Spec for JS.Class ? :P
 *   At least for the standar library. (JS.Spec only requires class.js and enumerable.js)
 */
