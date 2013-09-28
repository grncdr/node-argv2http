var test = require('tap').test;
var async = require('async');

var cli = require('./');

var router = cli.router({
  _path: '/jobs',
  _host: 'localhost',
  _port: 9862,

  list: {},

  show: {
    _path: [cli.required('Process ID/name')]
  },

  logs: {
    _path: [cli.optional('_all'), 'logs']
  },

  start: {
    _method: 'POST',
    _body: {
      script: cli.required('Script name'),
      args: cli.rest()
    }
  }
})

test("cli2http", {timeout: 4000}, function (t) {

  t.test(".parse",function (t) {
    t.deepEqual(
      {
        request: {
          host: 'localhost',
          port: 9862,
          method: "GET",
          path:"/jobs"
        },
        body: {},
        serializer: JSON.stringify,
        subCommands: ['list']
      },
      router.parse(['list'])
    )

    t.deepEqual(
      {
        request: {
          host: 'localhost',
          port: 9862,
          method: "POST",
          path:"/jobs"
        },
        body: {
          script: 'my-script.js',
          args: []
        },
        serializer: JSON.stringify,
        subCommands: ['start']
      },
      router.parse(['start', 'my-script.js'])
    )
    t.end()
  })

  t.test('.request', function (t) {
    t.test('parser errors are forwarded to callback', function (t) {
      router.request(['bad command'], function (err) {
        t.assert(err, "Callback received error");
        t.end();
      });
    })

    t.test('parser errors are emitted if no callback', function (t) {
      router.request(['bad command']).on('error', function (err) {
        t.assert(err, "Request emitted error");
        t.assert(/sub-command/.test(err), "Error was " + err.toString())
        t.end();
      });
    })

    t.test('testing with an actual server', function (t) {
      var server = require('http')
        .createServer()
        .listen(router.commands._port);

      t.on('end', server.close.bind(server));
      
      async.waterfall([
        testRequest(['list'], 'GET /jobs'),

        testRequest(['start', 'my-script', '--flag'], 'POST /jobs', {
          script: 'my-script',
          args: ['--flag']
        })
      ], function (err) {
        if (err) throw err;
        else t.end();
      })

      function testRequest(argv, expectation, body) {
        return function (next) {
          server.once('request', checkRequest)
          return router.request(argv);

          function checkRequest(req, res) {
            try {
              t.equal([req.method, req.url].join(' '), expectation, expectation);
              if (body) {
                var received = "";
                req.on('data', function (d) { received += d });
                req.on('end', function () {
                  t.equal(JSON.stringify(body), received, 'request body');
                });
              }
              next();
            } catch(err) {
              next(err);
            }
            res.end('ok');
          }
        };
      }
    });

    t.end();
  })
})
