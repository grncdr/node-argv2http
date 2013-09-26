var assert = require('assert');

var cli = require('./');

var commands = {
  _path: '/procs',
  _host: 'localhost',

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
}

require('tap').test("Basic parsing",function (t) {
  t.deepEqual(
    {
      request: {
        host: 'localhost',
        method: "GET",
        path:"/procs"
      },
      body: {},
      serializer: JSON.stringify,
      subCommands: ['list']
    },
    cli.parse(['list'], commands)
  )

  t.deepEqual(
    {
      request: {
        host: 'localhost',
        method: "POST",
        path:"/procs"
      },
      body: {
        script: 'my-script.js',
        args: []
      },
      serializer: JSON.stringify,
      subCommands: ['start']
    },
    cli.parse(['start', 'my-script.js'], commands)
  )
  t.end()
})
