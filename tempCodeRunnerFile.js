app.get("/secrets", (req, res) => {
  User.find({ secret: { $ne: null } }).then(function (users) {
    if (users) {
      res.render("secrets", { usersWithSecrets: users });
    }
  });
});