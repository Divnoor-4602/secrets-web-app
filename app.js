const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const session = require("express-session");
const ejs = require("ejs");
const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const { default: mongoose } = require("mongoose");
const GoogleStrategy = require("passport-google-oauth2");
const findOrCreate = require("mongoose-findorcreate");

dotenv.config();

const app = express();

app.use(
  session({
    secret: "cats",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(passport.session());
app.use(passport.initialize());

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

mongoose.connect("mongodb://localhost:27017/userDB", { useNewUrlParser: true });

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  googleId: String,
  secret: String,
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("users", userSchema);

passport.use(User.createStrategy());

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: process.env.CALLBACK_REDIRECT_URI,
      passReqToCallback: true,
    },
    function (req, accessToken, refreshToken, profile, cb) {
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

passport.serializeUser(function (user, done) {
  process.nextTick(function () {
    done(null, { id: user._id, username: user.username });
  });
});
passport.deserializeUser(function (user, done) {
  process.nextTick(function () {
    return done(null, user);
  });
});

app.get("/", (req, res) => {
  res.render("home");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.get("/secrets", (req, res) => {
  User.find({ secret: { $ne: null } }).then(function (users) {
    if (users) {
      res.render("secrets", { usersWithSecrets: users });
    }
  });
});

// google routes
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/secrets",
  passport.authenticate("google", {
    successRedirect: "/secrets",
    failureRedirect: "/login",
  })
);

app.post("/register", function (req, res) {
  User.register(
    { username: req.body.username },
    req.body.password,
    function (err, user) {
      if (err) {
        console.log("Error in registering.", err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function () {
          console.log(user, 101);
          res.redirect("/secrets");
        });
      }
    }
  );
});

app.post("/login", function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  req.login(user, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/secrets");
      });
    }
  });
});

app.get("/logout", function (req, res, next) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.get("/submit", (req, res) => {
  if (req.isAuthenticated) {
    res.render("submit");
  } else {
    res.redirect("/login");
  }
});

app.post("/submit", (req, res) => {
  const submittedSecret = req.body.secret;
  console.log(submittedSecret);
  console.log(req.user);

  User.findById(req.user.id).then(function (user) {
    user.secret = submittedSecret;
    user.save().then(function () {
      res.redirect("/secrets");
    });
  });
});

app.listen(3000, () => {
  console.log("Listening at port 3000");
});
