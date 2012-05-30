var express = require('express');
var util = require('util');
var request = require('request');
var async = require('async');
var config = require('./config');

config.opt.port = parseInt(process.env['app_port'], 10);
console.log('Using port number: ' + config.opt.port);

var app = express.createServer();

app.configure(function() {
  app.use(express.logger());
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'some-moistened-bint-lobbed-a-scimitar-at-me' }));

  app.set('view engine', 'jade');
  app.set('views', __dirname + '/views');
  app.use(express.static(__dirname + '/public'));
  // set error handler for bad requests
  app.use(express.errorHandler({showStack: true, dumpExceptions: true}));
});

// Routes
app.post('/save/:gistId', function (req, res, next) {

    var gist = {
        'files': {
            'water.js': {
                'content': req.body()
            }
        }
    };

    var token = req.session.access_token;

    request.post({ uri:'https://api.github.com/gists/' + gistId, json: true,
      qs: {'access_token': token}, body : gist}, function (error, resp, body) {
    });
});



app.post('/create', function (req, res, next) {
  var gist = {
    'description': 'created by water-js, a live-coding editor (http://water.gabrielflor.it) ported to node.js by @kbateman',
    'public': 'true',
    'files': {
      'water.js': {
        'content': req.body
      }
    }
  };

  var token = req.session.access_token;
  request.post({uri: 'https://api.github.com/gists', qs: {'access_token': token}, json: true, body: gist}, function (error, resp, body) {
    res.send(body.id);
  });

});

// Homepage
app.get('/', function(req, res, next) {

  var vars = {
    create: '',
    username: '',
    github_url : '',
    avatar: ''
  };

  // from http://developer.github.com/v3/oauth/ :
  //
  // 1. Redirect users to request GitHub access
  //       GET https://github.com/login/oauth/authorize
  //
  // 2. GitHub redirects back to your site
  //       POST https://github.com/login/oauth/access_token
  //
  // 3. Use the access token to access the API
  //       GET https://api.github.com/user?access_token=...

  // do we have a token in the session?
  async.series(
    [
      function (callback) {
        if (req.session.access_token) {
          // if so, are we also logged in?
          // try to get user details from github
          request.get({uri: 'https://api.github.com/user', qs: {'access_token': req.session.access_token}, json: true}, function (error, resp, body) {
            if (!error) {
              if (body.login) {
                vars.username = body.login;
                vars.avatar = body.avatar_url;
                vars.github_url = body.html_url;
                callback(null);
              } else {
                req.session.access_token = '';
                callback(error);
              }
            }
          });

        } else {
          req.session.access_token = '';
          callback (null);
        }
      }, 

      function (callback) {

        // by default, client will create code contents
        // to a gist the first time a user logs in to github
        if (req.session.create) {
          create = req.session.create;
          req.session.create = '';
        }

        callback(null);
      }
    ],

    function (err, response) {
      res.render('index.jade', {layout:'', vars: vars});
    }
  );
});

app.get('/github-login', function (req, res, next) {
    res.redirect('https://github.com/login/oauth/authorize?client_id=' + process.env['WATER_GITHUB_CLIENT_ID'] + '&scope=gist');
});

app.get('/github_logged_in', function (req, res, next) {
  // get temporary code
  var tempcode = req.query['code'];

  // construct data and headers to send to github
  data = {'client_id': process.env['WATER_GITHUB_CLIENT_ID'], 'client_secret': process.env['WATER_GITHUB_CLIENT_SECRET'], 'code': tempcode };
  headers = {'content-type': 'application/json', 'accept': 'application/json'};

  
  // request an access token
  request.post({uri: 'https://github.com/login/oauth/access_token', json: true, body:data}, function (error, resp, body) {

    if (!error) {
      // save access token in session
      req.session.access_token = body.access_token;
      // instruct client to create code contents to a gist
      req.session.create = true;
    } 

    res.redirect('/');
  });
});

app.get('/favicon.ico', function(req, res, next) {
  res.sendfile('public/static/img/favicon.ico');
});

app.listen(config.opt.port);
console.log('water-js app started on port ' + config.opt.port);


