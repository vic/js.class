JS.extend(JS.MethodMissing = new JS.Module(), {

  addMethod : function(name) {
    if (!this.__fns__[name]) {
      var missing = function() {
        return missing.isMissing(this)
          ? this.methodMissing(name, arguments)
          : this[name].apply(this, arguments);
      };
      missing.isMissing = function(self) {
        return self[name] === missing;
      };
      this.__fns__[name] = missing;
      var i = this.__dep__.length;
      while (i--) this.__dep__[i].resolve();
    }
  },

  addMethods : function(object) {
    var methods = [], property, i;

    if (object instanceof Array) {
      i = object.length;
      while (i--)
        typeof object[i] === 'string' && methods.push(object[i]);
    } else {
      for (property in object)
        Number(property) !== property && methods.push(property);
    }

    i = methods.length;
    while (i--) this.addMethod(methods[i]);

    object.prototype &&
      this.addMethods(object.prototype);
  }

});

JS.MethodMissing.addMethods([
  "abbr", "abs", "accept", "acceptCharset", "accesskey", "acos", "action", "addEventListener",
  "adjacentNode", "align", "alignWithTop", "alink", "alt", "anchor", "appendChild", "appendedNode",
  "apply", "archive", "arguments", "arity", "asin", "atan", "atan2", "attrNode", "attributes",
  "axis", "background", "bgcolor", "big", "blink", "blur", "bold", "border", "call", "caller",
  "ceil", "cellpadding", "cellspacing", "char", "charAt", "charCodeAt", "charoff", "charset",
  "checked", "childNodes", "cite", "className", "classid", "clear", "click", "clientHeight",
  "clientLeft", "clientTop", "clientWidth", "cloneNode", "code", "codebase", "codetype", "color",
  "cols", "colspan", "compact", "concat", "content", "coords", "cos", "data", "datetime", "declare",
  "deep", "defer", "dir", "disabled", "dispatchEvent", "enctype", "event", "every", "exec", "exp",
  "face", "filter", "firstChild", "fixed", "floor", "focus", "fontcolor", "fontsize", "forEach",
  "frame", "frameborder", "fromCharCode", "getAttribute", "getAttributeNS", "getAttributeNode",
  "getAttributeNodeNS", "getDate", "getDay", "getElementsByTagName", "getElementsByTagNameNS",
  "getFullYear", "getHours", "getMilliseconds", "getMinutes", "getMonth", "getSeconds", "getTime",
  "getTimezoneOffset", "getUTCDate", "getUTCDay", "getUTCFullYear", "getUTCHours",
  "getUTCMilliseconds", "getUTCMinutes", "getUTCMonth", "getUTCSeconds", "getYear", "global",
  "handler", "hasAttribute", "hasAttributeNS", "hasAttributes", "hasChildNodes", "hasOwnProperty",
  "headers", "height", "href", "hreflang", "hspace", "htmlFor", "httpEquiv", "id", "ignoreCase",
  "index", "indexOf", "innerHTML", "input", "insertBefore", "insertedNode", "isPrototypeOf", "ismap",
  "italics", "join", "label", "lang", "language", "lastChild", "lastIndex", "lastIndexOf", "length",
  "link", "listener", "localName", "log", "longdesc", "map", "marginheight", "marginwidth", "match",
  "max", "maxlength", "media", "method", "min", "multiline", "multiple", "name", "namespace",
  "namespaceURI", "nextSibling", "node", "nodeName", "nodeType", "nodeValue", "nohref", "noresize",
  "normalize", "noshade", "now", "nowrap", "object", "offsetHeight", "offsetLeft", "offsetParent",
  "offsetTop", "offsetWidth", "onblur", "onchange", "onclick", "ondblclick", "onfocus", "onkeydown",
  "onkeypress", "onkeyup", "onload", "onmousedown", "onmousemove", "onmouseout", "onmouseover",
  "onmouseup", "onreset", "onselect", "onsubmit", "onunload", "ownerDocument", "parentNode", "parse",
  "pop", "pow", "prefix", "previousSibling", "profile", "prompt", "propertyIsEnumerable", "push",
  "random", "readonly", "reduce", "reduceRight", "rel", "removeAttribute", "removeAttributeNS",
  "removeAttributeNode", "removeChild", "removeEventListener", "removedNode", "replace",
  "replaceChild", "replacedNode", "rev", "reverse", "round", "rows", "rowspan", "rules", "scheme",
  "scope", "scrollHeight", "scrollIntoView", "scrollLeft", "scrollTop", "scrollWidth", "scrolling",
  "search", "selected", "setAttribute", "setAttributeNS", "setAttributeNode", "setAttributeNodeNS",
  "setDate", "setFullYear", "setHours", "setMilliseconds", "setMinutes", "setMonth", "setSeconds",
  "setTime", "setUTCDate", "setUTCFullYear", "setUTCHours", "setUTCMilliseconds", "setUTCMinutes",
  "setUTCMonth", "setUTCSeconds", "setYear", "shape", "shift", "sin", "size", "slice", "small",
  "some", "sort", "source", "span", "splice", "split", "sqrt", "src", "standby", "start", "strike",
  "style", "sub", "substr", "substring", "summary", "sup", "tabIndex", "tabindex", "tagName", "tan",
  "target", "test", "text", "textContent", "title", "toArray", "toFunction", "toGMTString",
  "toLocaleDateString", "toLocaleFormat", "toLocaleString", "toLocaleTimeString", "toLowerCase",
  "toSource", "toString", "toUTCString", "toUpperCase", "type", "unshift", "unwatch", "useCapture",
  "usemap", "valign", "value", "valueOf", "valuetype", "version", "vlink", "vspace", "watch", "width"
]);
