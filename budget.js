const config = require("./lib/config");
const express = require('express');
const morgan = require('morgan');
const app = express();
const host = config.HOST;
const port = config.PORT;
const flash = require('express-flash');
const session = require('express-session');
const store = require('connect-loki');
const { body, validationResult } = require('express-validator');
const PgPersistence = require("./lib/pg-persistence");
const catchError = require("./lib/catch-error");

const LokiStore = store(session);

const validateSource = (source, whichArg) => {
  return body(source)
    .trim()
    .isLength({ min: 1 })
    .withMessage(`${whichArg} name required`)
    .bail()
    .isLength({ max: 25 })
    .withMessage(`${whichArg} name is too long. Max length is 25 characters`)
    // .isAlpha()
    .matches(/^[A-Za-z\s]+$/)
    .withMessage(`${whichArg} name may only contain alphabetic characters`);
};

const validateAmount = (amount) => {
  return body(amount)
    .custom((val) => (/\d+\.{0,1}\d*/).test(Number(val).toFixed(2)))
    .withMessage("Please enter a number greater than .00 without commas");
};

app.use(express.static("public"));
app.use(morgan("common"));
app.use(session({
  cookie: {
    httpOnly: true,
    maxAge: 31 * 24 * 60 * 60 * 1000, // 31 days in milliseconds
    path: "/",
    secure: false,
  },
  name: "launch-school-contacts-manager-session-id",
  resave: false,
  saveUninitialized: true,
  secret: config.SECRET,
  store: new LokiStore({}),
}));

const clone = (object) => {
  return JSON.parse(JSON.stringify(object));
};

// app.use((req, res, next) => {
//   if (!("incomeSources" in req.session)) {
//     req.session.incomeSources = clone(incomeSources);
//   }

//   next();
// });

// app.use((req, res, next) => {
//   if (!("expenseSources" in req.session)) {
//     req.session.expenseSources = clone(incomeSources);
//   }

//   next();
// });

app.use(express.urlencoded({ extended: false }));
app.use(flash());
app.use((req, res, next) => {
  res.locals.username = req.session.username;
  res.locals.signedIn = req.session.signedIn;
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});
app.use((req, res, next) => {
  res.locals.store = new PgPersistence(req.session);
  next();
});

app.set("views", "./views");
app.set("view engine", "pug");

const requiresAuthentication = (req, res, next) => {
  if (!res.locals.signedIn) {
    res.redirect(302, "/signin");
  } else {
    next();
  }
}

app.get("/", (req, res) => {
  res.redirect("/begin");
});

app.get("/begin",
  requiresAuthentication,
  catchError(async (req, res) => {
    let store = res.locals.store;
    let username = req.session.username;
    let expense_list = await store.loadExpenseList();
    let income_list = await store.loadIncomeList();
    let total = await store.total();

    res.render("begin", {
      flash: req.flash(),
      sources: income_list,
      expenses: expense_list,
      total: total,
    });
  }),
);

app.get("/newSource",

requiresAuthentication,

(req, res) => {
  res.render("new-source");
});

app.post("/newSource",
  requiresAuthentication,

  [
    validateSource("incomeSourceName", "Source"),
    validateAmount("incomeAmount"),
  ],

  catchError(async (req, res) => {
    let errors = validationResult(req);
    let store = res.locals.store;
    let income_list = await store.loadIncomeList();
    
    if (!errors.isEmpty()) {
      errors.array().forEach((error) => req.flash("error", error.msg));
      res.render("new-source", {
        flash: req.flash(),
        incomeSources: income_list, // change to db
      });
    } else {
      // need to format number before putting in database
      let incomeAmount = Number(req.body.incomeAmount).toFixed(2);
      let incomeSourceName = req.body.incomeSourceName;
      await store.updateIncomeList(incomeSourceName, incomeAmount);
      res.redirect("begin");
    }
  }),
);

app.get("/newExpense",

  requiresAuthentication,

  (req, res) => {
  res.render("new-expense");
});

app.post("/newExpense",

  requiresAuthentication,

  [
    validateSource("expenseSourceName", "Source"),
    validateAmount("expenseAmount"),
  ],

  catchError(async (req, res) => {
    let errors = validationResult(req);
    let store = res.locals.store;
    let expense_list = await store.loadExpenseList();

    if (!errors.isEmpty()) {
      errors.array().forEach((error) => req.flash("error", error.msg));
      res.render("new-expense", {
        flash: req.flash(),
        expenseSources: expense_list, // change to db
      });
    } else {
      // need to format number before putting in database
      let expenseAmount = Number(req.body.expenseAmount).toFixed(2);
      let expenseSourceName = req.body.expenseSourceName;
      await store.updateExpenseList(expenseSourceName, expenseAmount);
      res.redirect("begin");
    }
  }),
);

app.post("/begin/income_:incomeId/delete", 
  
  requiresAuthentication,

  catchError(async (req, res) => {
    let store = res.locals.store;
    let expense_list = await store.loadExpenseList();
    let income_list = await store.loadIncomeList();

    let incomeId = req.params.incomeId;
    let deleted = await store.deleteIncomeSource(+incomeId);
    if (!deleted) throw new Error("Not found.");
    res.redirect("/begin");
  }),
);

app.post("/begin/expense_:expenseId/delete",

  requiresAuthentication,

  catchError(async (req, res) => {
    let store = res.locals.store;
    let expense_list = await store.loadExpenseList();
    let income_list = await store.loadIncomeList();

    let expenseId = req.params.expenseId;
    let deleted = await store.deleteExpenseSource(+expenseId);
    if (!deleted) throw new Error("Not found.");
    res.redirect("/begin");
  }),
);

app.get("/signIn", (req, res) => {
  req.flash("info", "Please sign in.");
  res.render("signin", {
    flash:req.flash(),
  });
});

app.post("/signIn", 
  catchError(async (req, res) => {
    let userName = req.body.userName.trim();
    let password = req.body.password;

    let authenticated = await res.locals.store.authenticate(userName, password);
    if (!authenticated) {
      req.flash("error", "Invalid credentials.");
      res.render("signin", {
        flash: req.flash(),
        username: req.body.userName,
      });
    } else {
      let session = req.session
      session.username = userName;
      session.signedIn = true;
      req.flash("info", "Welcome!");
      res.redirect("/begin");
    }
  }),
);

app.post("/signout", (req, res) => {
  delete req.session.username;
  delete req.session.signedIn;
  res.redirect("/begin");
})


app.listen(3000, "localhost", () => {
  console.log("Listening to port 3000.");
});
