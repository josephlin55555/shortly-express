var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var bcrypt = require('bcrypt-nodejs');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(session({secret: 'hr secrets'}));




app.get('/', util.checkUser,
function(req, res) {
  res.render('index');
});

app.get('/login',
  function(req, res){
    res.render('login');
  });

app.get('/signup',
  function(req, res){
    res.render('signup');
  });

app.get('/create', util.checkUser,
function(req, res) {
  res.render('index');
});

app.get('/links',
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});




app.post('/links',
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/


app.post('/login', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;


  new User({'username': username})
  .fetch()
  .then(function(user){
    if(!user){
      res.redirect('/login');
    } else {
      var salt = user.attributes.salt;
      var testHash = bcrypt.hashSync(password, salt);

      if(testHash === user.attributes.hash){
        req.session.regenerate(function(){
          req.session.user = username;
          res.redirect('/');
        });

      } else {
        console.log("invalid password");
        res.redirect('/login');
      }

    }

  });


});

app.post('/signup', function(req, res){
  var username = req.body.username;
  var password = req.body.password;
  var salt = bcrypt.genSaltSync(10);
  var hash = bcrypt.hashSync(password, salt);

//create new user in database and save username, salt, and hash.
  var user = new User({
    username: username,
    salt: salt,
    hash: hash
  });

  user.save().then(function(newuser) {
    console.log(newuser);
    Users.add(newuser);

          // establish session with user
    req.session.user = username;
    res.redirect('/');
    });
});



app.post('/logout', function(req, res){
  req.session.destroy();
  res.redirect('/login');
});








/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
