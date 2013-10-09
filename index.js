var qs = require('querystring');
module.exports = exports = {
  router:   Router,
  Router:   Router,
  request:  request,
  parse:    parse,

  required: required,
  optional: optional,
  named:    named,
  flag:     flag,
  rest:     rest,
  unparsed: unparsed,

  http:     require('http')
}

function Router(commands) {
  if (!(this instanceof Router)) return new Router(commands);
  this.commands = commands;
  this.request  = request.bind(null, commands);
  this.parse    = parse.bind(null, commands);
}

function request(commands, args, callback) {
  if (!Array.isArray(args)) {
    callback = args;
    args     = process.argv.slice(2);
  }

  var parsed, req;

  // Catch parse errors
  try {
    parsed = parse(commands, args);
  } catch (err) {
    req = new exports.http.ClientRequest({})
    req.end();
    if (callback) callback(err);
    else process.nextTick(function () {
      req.emit('error', err)
    });
    return req;
  }

  req = exports.http.request(parsed.request);
  if (parsed.serializer && Object.keys(parsed.body).length) {
    var body = parsed.serializer.call(null, parsed.body);
    req.write(body);
  }
  if (typeof callback == 'function') {
    req.on('error', callback);
    req.on('response', callback.bind(null, null));
  }
  req.subCommands = parsed.subCommands;
  req.end();
  return req;
}

function parse (commands, args) {
  if (!Array.isArray(args)) {
    args = process.argv.slice(2);
  }
  args = args.slice();

  var current        = commands
    , subCommands    = []
    , pathComponents = []
    , bodyParams     = {}
    , queryParams    = {}
    , serializer     = JSON.stringify
    , requestParams  = { method: 'GET',
                         headers: {'Content-Type': 'application/json'} }

  while (true) {
    if (Object.hasOwnProperty(current, '_serializer')) {
      serializer = current._serializer;
    }

    if (current._path) updatePath(current._path);
    if (current._body) updateObject(bodyParams, current._body);
    if (current._query) updateObject(queryParams, current._query);

    updateOtherRequestParams(current);

    if (!args.length) break;

    var subCommand = args.shift();

    if (!current[subCommand]) {
      throw new Error("Unknown sub-command: " + subCommand);
    }

    subCommands.push(subCommand);
    current = current[subCommand];
  }

  requestParams.path = pathComponents.join('/');
  if (!/^\//.test(requestParams.path)) {
    requestParams.path = '/' + requestParams.path;
  }
  if (Object.keys(queryParams).length) {
    requestParams.path += '?' + qs.encode(queryParams);
  }

  return {
    request:     requestParams,
    body:        bodyParams,
    serializer:  serializer,
    subCommands: subCommands
  };

  function updatePath(parts) {
    if (typeof parts == 'string') {
      pathComponents.push(parts);
      return;
    }
    parts.forEach(function (part) {
      pathComponents.push(
        typeof part == 'function' ? part.call(null, args) : part.toString()
      )
    })
  }

  function updateObject(target, params) {
    Object.keys(params).forEach(function (name) {
      var v = params[name];
      if (typeof v == 'function') {
        target[name] = v.call(null, args);
      }
      else if (typeof v == 'object') {
        // Nested object
        target[v] = updateObject({}, v);
      }
      else {
        target[name] = String(v);
      }
    })
  }

  function updateOtherRequestParams(obj) {
    [ 'host',
      'hostname',
      'port',
      'localAddress',
      'socketPath',
      'method',
      'auth',
      'agent' ].forEach(function (k) {
        if (obj.hasOwnProperty('_' + k)) {
          requestParams[k] = obj['_' + k];
        }
      })
  }
}

function required (name){
  return function (args) {
    if (!args.length) throw new Error(name + " is required!");
    return args.shift();
  }
}

function optional (fallback) {
  return function (args) {
    return args.length ? args.shift() : fallback
  }
}

function rest () {
  return function (args) {
    return args.splice(0, args.length);
  }
}

function flag (name, shortName) {
  var exp = '^--' + name + '$';
  if (shortName) exp += '|^-' + shortName + '$';
  exp = new RegExp(exp);
  var count = 0;
  return function flag (args) {
    for (var i = 0; i < args.length; i++) {
      if (exp.test(args[i])) {
        args.splice(i, 1);
        count++;
      }
    }
    return count;
  }
}

function named (name, shortName) {
  var exp = '^--' + name + '$';
  if (shortName) exp += '|^-' + shortName + '$';
  exp = new RegExp(exp);
  return function (args) {
    var value;
    for (var i = 0; i < args.length; i++) {
      if (exp.test(args[i])) {
        var x = args.splice(i, 2);
        if (value) {
          if (!Array.isArray(value)) {
            value = [value];
          }
          value.push(x[1]);
        } else {
          value = x[1];
        }
      }
    }
    return value;
  }
}

/** Return all arguments following a literal '--' */
function unparsed () {
  return function (args) {
    var i = args.indexOf('--');
    if (i > -1) {
      args.splice(i, 1);
      return args.splice(i, args.length - i);
    }
  }
}
