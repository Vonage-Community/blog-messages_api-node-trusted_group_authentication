require('dotenv').config();
const express = require("express");
const { Vonage } = require("@vonage/server-sdk");
const { SMS } = require('@vonage/messages');
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const fs = require("fs");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const vonage = new Vonage({
  apiKey: process.env.API_KEY,
  apiSecret: process.env.API_SECRET,
  applicationId: process.env.APP_ID,
  privateKey: process.env.PRIVATE_KEY_PATH,
});

// init sqlite db
const dbFile = ".data/sqlite.db";

// un/comment out the below line for testing
// let exists = false;
let exists = fs.existsSync(dbFile);
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(dbFile);

// if ./.data/sqlite.db does not exist, create it
db.serialize(function () {
  if (!exists) {
    db.run('CREATE TABLE Sessions (phone NUMERIC, id TEXT)');
    db.run('CREATE TABLE Allowlist (phone NUMERIC, username TEXT)');
    db.run('CREATE TABLE Authors (username TEXT)');
  }
});

//app.use(express.methodOverride());
app.use(require('cookie-parser')());
app.use(
  session({
    store: new SQLiteStore(),
    secret: process.env.SESH_SECRET || '123', // Provide a secret option
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
  })
);

// VIEW ROUTES
app.get('/', function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

app.get('/signup', function (request, response) {
  response.sendFile(__dirname + '/views/signup.html');
});

app.get('/admin', function (request, response) {
  if (isAdmin(request.session)) {
    response.sendFile(__dirname + '/views/admin.html');
  } else {
    response.sendFile(__dirname + '/views/index.html');
  }
});

// APPLICATION ENDPOINTS

// admin invites a phone number, add to temp data store until they text us
// optional: admin associates number with existing username, in case of lost/expired cookie
app.post('/invite', function (request, response) {
  if (!isAdmin(request.session)) {
    response.status(500).send({ message: "Sorry, you're not an admin" });
    return;
  }
  let phone = request.body.phone;
  if (isNaN(phone)) {
    response.status(500).send({ message: "Please use the format 441234567890 for phone numbers" });
  } else {
    if (request.body.username) {
      db.run('INSERT INTO Allowlist (phone, username) VALUES ($phone, $user)', {
        $phone: phone,
        $user: request.body.username
      });
    } else {
      db.run('INSERT INTO Allowlist (phone) VALUES ($phone)', {
        $phone: phone
      });
    }

    vonage.messages.send(
      new SMS(
        `Please reply to this message with "${process.env.INVITE_CODE}" to get your PIN.`,
        phone,
        process.env.APP_NUM,
      ),
    )
      .then(resp => console.log(resp.messageUUID))
      .catch(err => console.error(err));
    response.status(200).send({ message: "Invitation sent!" });
  }
});

// author texts app with current invite code from allowlisted number
// if valid: app texts back single-use authentication code
app.post('/answer', function (request, response) {
  let from = request.body.from;
  if (request.body.text === process.env.INVITE_CODE) {
    db.all('SELECT * from Allowlist WHERE phone = $from', { $from: from }, function (err, rows) {
      if (rows.length) {
        vonage.verify.start({
          number: from,
          brand: 'TrustedApp'
        })
          .then(result => {
            // Insert into database
            return db.run('INSERT INTO Sessions (phone, id) VALUES ($phone, $id)', {
              $phone: from,
              $id: result.request_id
            });

          })
          .then(() => {

            // Success, send 204 response
            response.status(204).end();

          })
          .catch(err => {

            console.error('err', err);

            // Error handling
            response.status(500).send({ message: 'Error processing verification request' });

          });
      }
    });
  }
});

// author enters their authentication code and their new or existing username
// they then receive a client-side cookie keeping them logged in
app.post('/login', function (request, response) {
  let allowed = RegExp('[A-Za-z0-9_-]+');
  let username = request.body.username;
  if (!allowed.test(username)) {
    response.status(500).send({ message: 'Please use basic characters for your username' });
    return;
  }
  db.each('SELECT * FROM Sessions WHERE phone = $phone', {
    $phone: request.body.phone
  }, function (error, sesh) {

    db.all('SELECT * FROM Authors WHERE username = $user', { $user: username }, function (err, rows) {
      if (rows.length) {
        db.all('SELECT * FROM Allowlist WHERE username = $user AND phone = $phone', {
          $user: username,
          $phone: sesh.phone
        }, function (e, r) {
          if (e || !r.length) {
            response.status(500).send({ message: 'Please choose a different username' });
            return;
          }
        });
      }

      vonage.verify.check(sesh.id, request.body.pin)
        .then(result => {
          if (result && result.status === '0') {
            db.serialize(function () {
              db.run('INSERT INTO Authors (username) VALUES ($user)', {
                $user: username
              });
              db.run('DELETE FROM Allowlist WHERE phone = $phone', {
                $phone: sesh.phone
              });
              db.run('DELETE FROM Sessions WHERE phone = $phone', {
                $phone: sesh.phone
              });
            });
            request.session.username = username;
            response.status(200).send({ message: "Success" });
          }
        })
        .catch(err => {

          // handle errors
          console.error(err);

          if (err) {
            console.log('Error occurred:', err);
            response.status(500).send({ message: 'Error verifying your info' });
          }
        });
    });
  });
});

// admin removes a pending number from allowlist in case of typos etc.
app.post('/uninvite', function (request, response) {
  if (!isAdmin(request.session)) {
    response.status(500).send({ message: "Sorry, you're not an admin" });
    return;
  }
});

// admin removes an author from the system for Important Admin Reasons
app.post('/remove', function (request, response) {
  if (!isAdmin(request.session)) {
    response.status(500).send({ message: "Sorry, you're not an admin" });
    return;
  }
});

function isAdmin(sesh) {
  // let admins = process.env.ADMINS.split(',');
  // return admins.includes(sesh.username);
  return true;
}

// listen for requests :)
const listener = app.listen(process.env.PORT, function () { });
console.log("Your app is listening on port " + listener.address().port);