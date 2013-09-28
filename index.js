module.exports = exports = {
  router:   Router,
  Router:   Router,
  request:  request,
  parse:    parse,

  required: required,
  optional: optional,
  rest:     rest,
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
    args     = process.argv;
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
    req.write(parsed.serializer.call(null, parsed.body));
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

  var requestParams = {method: 'GET'}
    , subCommands    = []
    , pathComponents = []
    , bodyParams     = {}
    , serializer     = JSON.stringify
    , current        = commands;

  while (args.length) {
    if (Object.hasOwnProperty(current, '_serializer')) {
      serializer = current._serializer;
    }

    if (current._path) updatePath(current._path);
    if (current._body) updateBody(current._body);

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

  function updateBody(params) {
    Object.keys(params).forEach(function (name) {
      var v = params[name];
      v = typeof v == 'function' ? v.call(null, args) : v.toString();
      bodyParams[name] = v;
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
