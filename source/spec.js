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
        var str = "(function() { with(this) { return ("+
                    body+").apply(this, arguments); } })";
        var fun = eval(str);
        fun.apply(self, args || [self]);
      }
      return undefined;
    }
  },
  initialize : function(body) {
    this._root = new JS.Spec.ExampleGroup();
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

  initialize : function(name, group, body) {
    this._name = name;
    this._group = group;
    this._body = body;
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
  initialize : function(name, parent, mixin) {
    this._name = name;
    this._parent = parent;
    this._examples = {};
    this._examples_ord = [];
    this._module = new JS.Module({
      include : [JS.Spec.Matcher.Methods, mixin,
                 parent ? parent._module : {},
                 new JS.Module({
                   before : function() { this.callSuper(); },
                   after : function() { this.callSuper(); }
                 })]
    });
  },

  def : function(name, fun) {
    if (fun)  {
      var obj = {};
      obj[name] = fun;
      this._module.include(new JS.Module(obj));
    } else {
      this._module.include.apply(this._module, [name]);
    }
    return this;
  },

  include : function() {
    this._module.include.apply(this._module, arguments);
  },

  name : function() {
    if (this._parent && this._parent._name) {
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
    if (example) {
        throw "Cannot define example '"+name+"' more than once.";
    } else {
      example = new JS.Spec.Example(name, this, body);
      this._examples[name] = example;
      this._examples_ord.push(name);
    }
    return example;
  },

  describe : function() {
    this._child_groups = this._child_groups || {};
    this._child_groups_ord = this._child_groups_ord || [];
    var name = "";
    var mixin = new JS.Module();
    var body = new JS.Module({ body : function() { this.callSuper(); } });
    new JS.Enumerable.Collection(arguments).forEach(function(arg) {
      if (typeof(arg) == 'string') {
        name = (name + ' ' + arg).replace(/^\s+|\s+$/g, '');
      } else if (typeof(arg) == 'function') {
        var fun = arg;
        body.include(new JS.Module({
          body : function() {
            this.callSuper();
            JS.Spec.applyBody(this, fun);
          }
        }));
      } else if (arg.constructor == Object) {
        body.include(new JS.Module({
          body : function() {
            this.callSuper();
            for (var name in arg) {
              if (typeof(name) == 'string' &&
                  name.match(/\s/) && JS.isFn(arg[name])) {
                this.it(name, arg[name]);
              }
            }
          }
        }));
      } else {
        mixin.include(arg);
      }
    });
    if (name.length == 0) {
      name = (this.name +
              ' Anonymous example_group_'+
              this._child_groups.length).replace(/^\s+|\s+$/g, '');
    }
    var group = this._child_groups[name];
    if (group) {
      throw "Already defined group: "+name;
    } else {
      group = new JS.Spec.ExampleGroup(name, this, mixin);
      this._child_groups[name] = group;
      this._child_groups_ord.push(name);
      group.extend(body);
      group.body();
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
    self.notify('onStart');
    this.trasverse_examples(this._root, filter, function(instance) {
      var group_name = instance.example().group().name();
      if (!groups_seen[group_name]) {
        self.notify('onGroupStart', instance);
      }
      groups_seen[group_name] = instance;
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
    }, null, function(endingGroup) {
      if (groups_seen[endingGroup.name()]) {
        self.notify("onGroupEnd", groups_seen[endingGroup.name()]);
      }
    }) ;
    self.notify('onEnd');
  },
  trasverse_examples : function(root, filter, each, start, end) {
    var len = (root._examples_ord ? root._examples_ord.length : 0) +
              (root._child_groups_ord ? root._child_groups_ord.length : 0);
    if (len == 0) { return; }
    if (start) { start(root); }
    new JS.Enumerable.Collection(root._examples_ord).forEach(function(i) {
      var mod = root._examples[i];
      if (mod.name().match(filter)) {
        var example = new JS.Spec.Example.Instance(mod);
        each(example);
      }
    });
    var self = this;
    new JS.Enumerable.Collection(root._child_groups_ord).forEach(function(i) {
      var grp = root._child_groups[i];
      self.trasverse_examples(grp, filter, each, start, end);
    });
    if (end) { end(root); }
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
  },

  onStart : function() { },
  onEnd : function() { },
  onGroupStart : function(instance) { },
  onGroupEnd : function(instance) { },
  onExampleStart : function(instance) {},
  onExampleSuccess : function(instance) { },
  onExamplePending : function(instance) { },
  onExampleFailure : function(instance, failure) { },
  onExampleError : function(instance, error) { }

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

JS.Spec.Listener.Firebug = new JS.Class(JS.Spec.Listener, {
  extend : { format : 'firebug' },

  initialize : function(config) {
    this._examples = 0;
    this._failures = 0;
    this._pending = 0;
  },

  onStart : function() {
    console.time("JS.Spec ran in");
  },
  onEnd : function() {
    console.log(this._examples, "examples,",
                this._failures, "failures,",
                this._pending, "pending");
    console.timeEnd("JS.Spec ran in");
  },
  onGroupStart : function(instance) {
    console.group(instance.example().group()._name);
  },
  onGroupEnd : function(instance) {
    console.groupEnd();
  },
  onExampleStart : function(instance) {
    this._examples += 1;
  },
  onExampleSuccess : function(instance) {
    console.log(instance.example()._name, instance.example()._body);
  },
  onExamplePending : function(instance) {
    this._pending += 1;
    console.info(instance.example()._name,
                 "(PENDING: Not Yet Impelemnted)");
  },
  onExampleFailure : function(instance, failure) {
    this._failures += 1;
    console.error(instance.example()._name,
                  instance.example()._body,
                  'FAILED: ', failure);

  },
  onExampleError : function(instance, error) {
    this._failures += 1;
    console.error(instance.example()._name,
                  instance.example()._body,
                  'ERROR: ', error);

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
