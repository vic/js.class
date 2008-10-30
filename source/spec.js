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
    },

    testType : function(obj, types) {
      types = types.constructor == Array ? types : [types];
      return new JS.Enumerable.Collection(types).find(function(type) {
        return obj.constructor == type || typeof(obj) == type ||
          obj instanceof type ||
          (JS.isFn(obj['isA']) && obj.isA(type));
      });
    },

    expect : function(subject, expectation, positive) {
      if (positive == undefined) { positive = true; }
      var res = expectation.matches(subject);
      if (res != positive) {
        var msg = positive ? expectation.failureMessage() :
                    expectation.negativeFailureMessage();
        throw new JS.Spec.ExampleFailure(msg, positive, expectation);
      }
      return res;
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
    JS.Spec.expect(this, expectation, true);
  },
  should_not : function(expectation) {
    JS.Spec.expect(this, expectation, false);
  }
});

/***
 * This module is included on every example instance,
 * matchers registered with JS.Spec.Matches.register method
 * get added as an instance method in this module.
 */
JS.Spec.Matches = new JS.Module({
  extend : {
    Base : new JS.Class({
      matches: function() {
        throw "matches method Not Implemented";
      },
      failureMessage: function() {
        return 'expected '+this.subject+' to '+this.act()+' '+this.expected;
      },
      negativeFailureMessage: function() {
        return 'expected '+this.subject+' not to '+
          this.act()+' '+this.expected;
      },
      act : function() {
        return this.matcher.replace(/([a-z])([A-Z])/, "$1 $2").
          toLowerCase().replace(/\W+/, " ");
      },
      testType: JS.Spec.testType
    }),
    matchers: {},
    register : function(object, name, matchFun) {
      var self = this;
      if (object.constructor === Object) { // a config object
        var mod = new JS.Module(object);
        if (object.matcher.constructor === String) {
          name = object.matcher;
          matchFun = object[name] || object['matches'];
          self.register(mod, name, matchFun);
        } else if (object.matcher.constructor === Array) {
          for (var i = 0; i < object.matcher.length; i++) {
            name = object.matcher[i];
            if (JS.isFn(object[name])) {
              self.register(mod, name, object[name]);
            } else if (JS.isFn(object['matches'])) {
              self.register(mod, name, object['matches']);
            } else {
              throw "No matches method defined for "+name;
            }
          }
        } else if (object.matcher.constructor === Object) {
          for (name in object.matcher) {
            matchFun = object.matcher[name];
            if (typeof(matchFun) == 'string') { // an alias
              matchFun = object.matcher[matchFun];
            }
            if (JS.isFn(matchFun) && !Object.prototype[name]) {
              self.register(mod, name, matchFun);
            }
          }
        } else {
          throw "Invalid object matcher type: "+typeof(object);
        }
      } else if (object.constructor === JS.Module) {
        matchFun = matchFun || object.instanceMethod('matches');
        if (!name) {
          throw "A method name must be provided to register a matcher";
        }
        if (!JS.isFn(matchFun)) {
          throw "No matches function supplied to register matcher: "+name;
        }
        self.register(new JS.Class(self.Base, {
          include : object,
          matcher : name,
          matches: function(subject) {
            this.subject = subject;
            this.expected = this._argv[0];
            var ary = JS.array(this._argv);
            ary.unshift(subject);
            var value = matchFun.apply(this, ary);
            value = this == value ? value.result() : value;
            //console.debug("%o.%s(%o) = %o", this, this.matcher, ary, value);
            return value;
          }
        }), name);
      } else {
        if (!JS.isFn(object)) {
          throw "Expected a constructor function to be register as matcher";
        }
        if (!name) {
          throw "A method name must be provided to register a matcher";
        }
        var config = new Object();
        config[name] = function() {
          var matcher = object.prototype.constructor.
            apply(object.prototype , arguments);
          matcher._example = this;
          matcher._argv = JS.array(arguments);
          return matcher;
        };
        self.include(new JS.Module(config));
      }
    }
  },
  expect : JS.Spec.expect
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
      include : [JS.Spec.Matches, mixin,
                 parent ? parent._module : {},
                 new JS.Module({
                   before : function() { this.callSuper(); },
                   after : function() { this.callSuper(); }
                 })]
    });
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
    if (!body && name.constructor == Object) {
      for(var i in name) {
        if (JS.isFn(name[i]) && !Object.prototype[i]) {
          this.it(i, name[i]);
        }
      }
      return this;
    }
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
      throw "A name must be given for the example group";
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

/**
 * A firebug based reporter. Using firebug instead of generating DOM
 * has the advantage that you can test your pages without altering the
 * DOM being tested.
 */
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
    console.info(instance.example()._name +
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


/*************************************
 * Match methods provided by JS.Spec *
 *************************************/
JS.Spec.Matches.register({
  matcher : {

    /**
     * object equality
     *
     *  obj.should_not( be( undefined ) )
     */
    be : function(a, b) { return a === b; },
    eql : 'equal', // alias for equal
    equal : function(a, b) { return a == b; },
    beLessThan : function(a, b) { return a < b; },
    beLessOrEqualThan : function(a, b) { return a <= b; },
    beGreaterThan : function(a, b) { return a > b; },
    beGreaterOrEqualThan : function(a, b) { return a >= b; },


    /**
     * object type
     *
     *   obj.should( beKindOf(JS.Enumerable, JS.Kernel) )
     */
    beKindOf : function(object, type) {
      return (JS.isFn(object['isA']) && object.isA(type)) ||
        object.prototype.constructor === type;
    },
    beA : 'beKindOf',
    beAn : 'beKindOf',

    /**
     * Object interface
     *
     *   obj.should( implement(new JS.Interface("hello", "world")) )
     */
    respondTo : function() {
      var ary = JS.array(arguments);
      var object = ary.shift();
      return new JS.Interface(ary).test(object);
    },
    implement: function(object, iface) {
      return iface.test(object);
    },


    /**
     * Test if object satisfies a block
     *
     *    obj.should( satisfy(function(o) { return o % 2 == 0 }) )
     */
    satisfy : function() {
      var args = JS.array(arguments);
      var object = args.shift();
      var block = args.shift();
      args.unshift(object);
      return block.apply(object, args);
    }

  }
});

/**
 * "str".should( match(/regex/) )
 * be(undefined).should( match(this.obj) )
 */
JS.Spec.Matches.register({
  matcher: 'match',
  match : function(subject, expect) {
    if (subject.constructor === String) {
      return subject.match(expect);
    } else if (JS.isFn(subject['matches'])) {
      return subject.matches(expect);
    } else if (JS.isFn(expect['match'])) {
      return expect.match(subject);
    } else if (JS.isFn(expect['matches'])) {
      return expect.matches(subject);
    } else {
      return "Don't know how to match "+subject+" with "+expect;
    }
  }
});


/**
 * [1, 2, 3].should( include(1,3) )
 */
JS.Spec.Matches.register({
  matcher: 'include',
  include : function() {
    var args = JS.array(arguments);
    this.expected = args;
    var subject = args.shift();
    if (subject.constructor === Array) {
      subject = new JS.Enumerable.Collection(subject);
    }
    return new JS.Enumerable.Collection(args).all(function(i) {
      return subject.find(function(o) { return o == i; });
    });
  },
  act: function() {
    return 'include elements ';
  }
});


/**
 * (11).should beClose(10, 0.5)
 */
JS.Spec.Matches.register({
  matcher: {
    beClose : function(target, expected, delta) {
      this._delta = delta || 0;
      return (target - expected).abs() < delta;
    }
  },
  failureMessage: function() {
    return "expected " + this.expected +
      " +/- (< " + this._delta + "), got " + this.subject;
  },
  negativeFailureMessage: function() {
    return "expected " + this.subject +
      " not to be within " + this._delta + " of " + this.expected;
  }
});


/**
 * fun.change(object, property).from(old).to(new)
 * fun.change(object, property).by(amount)
 * fun.change(object, property).byAtLeast(amount)
 * fun.change(object, property).byAtMost(amount)
 */
JS.Spec.Matches.register({
  matcher : 'change',
  change : function(fun, obj, property, args) {
    var self = this;
    this.result = function() {
      var before = obj[property];
      if (JS.isFn(before) && args) {
        before = before.apply(obj, args);
      }
      fun.apply(self._obj, self._args);
      var after = obj[property];
      if (JS.isFn(after) && args) {
        after = after.apply(obj, args);
      }
      self._prop = property;
      self._before = before;
      self._after = after;
      if (self._from && before != self._from) { return false; }
      if (self._by && !self._by(after, before)) { return false; }
      if (self._to && after != self._to) { return false; }
      return true;
    };
    return this;
  },
  from : function(from) {
    this._from = from;
    return this;
  },
  to : function(to) {
    this._to = to;
    return this;
  },
  by : function(by) {
    this._byTx = 'by '+by;
    this._by = function(a, b) { return (a - b) == by; };
    return this;
  },
  byAtLeast : function(by) {
    this._byTx = 'by at least '+by;
    this._by = function(a, b) { return (a - b) >= by; };
    return this;
  },
  byAtMost : function(by) {
    this._byTx = 'by at most '+by;
    this._by = function(a, b) { return (a - b) <= by; };
    return this;
  },
  after : function() {
    this._args = JS.array(arguments);
    return this;
  },
  on : function(object) {
    this._obj = object;
    return this;
  },
  act: function() {
    var s = 'change value of '+this._prop;
    if (this._from) { s += ' from '+this._from; }
    if (this._to) { s += ' to '+this._to; }
    if (this._by) { s += this._byTx; }
    s += ' but it changed from '+this._before+' to '+this._after+' in ';
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
