const express = require('express');
const morgan = require('morgan');
const app = express();
const flash = require('express-flash');
const session = require('express-session');
const store = require('connect-loki');
const { body, validationResult } = require('express-validator');
const PgPersistence = require("./lib/pg-persistence");

const LokiStore = store(session);

const incomeSources = [];
const expenseSources = [];

function totals(sources, type) {
  let result = 0;
  for (let idx = 0; idx < sources.length; idx += 1) {
    result += Number(sources[idx][String(type)]);
  }
  return result;
}

const net = totals(incomeSources, "sourceAmount") - totals(expenseSources, "expenseAmount");

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
    .matches(/\d+\.{0,1}\d*/)
    .withMessage("Please enter a number greater than .00");
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
  secret: "this is not very secure",
  store: new LokiStore({}),
}));

const clone = (object) => {
  return JSON.parse(JSON.stringify(object));
};

app.use((req, res, next) => {
  if (!("incomeSources" in req.session)) {
    req.session.incomeSources = clone(incomeSources);
  }

  next();
});

app.use((req, res, next) => {
  if (!("expenseSources" in req.session)) {
    req.session.expenseSources = clone(incomeSources);
  }

  next();
});

app.use(express.urlencoded({ extended: false }));
app.use(flash());
app.use((req, res, next) => {
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});
app.use((req, res, next) => {
  res.locals.store = new PgPersistence(req.session);
  next();
});

// app.use(async (req, res) => {
//   try {
//     await res.locals.store.testQuery1();
//     await res.locals.store.testQuery2();
//     res.send("quitting");
//   } catch (error) {
//     next(error);
//   }
// });

app.set("views", "./views");
app.set("view engine", "pug");

app.get("/", (req, res) => {
  res.redirect("/begin");
});

app.get("/begin", (req, res) => {
  console.log(req.flash())
  res.render("begin", {
    flash: req.flash(),
    sources: req.session.incomeSources,
    expenses: req.session.expenseSources,
    total: totals(req.session.incomeSources, "amount") - totals(req.session.expenseSources, "amount"),
  });
});

app.get("/newSource", (req, res) => {
  res.render("new-source");
})

app.post("/newSource",
  [
    validateSource("incomeSourceName", "Source"),
    validateAmount("incomeAmount"),
  ],

  (req, res, next) => {
    let errors = validationResult(req);

    if (!errors.isEmpty()) {
      errors.array().forEach(error => req.flash("error", error.msg));
      res.render("new-source", {
        flash: req.flash(),
        incomeSources: req.session.incomeSources,
      });
    } else {
      next();
    }
  },

  (req, res) => {
    let incomeName = req.body.incomeSourceName;
    let incomeAmount = req.body.incomeAmount;
    req.session.incomeSources.push({ 
      name: incomeName,
      amount: Number(incomeAmount).toFixed(2),
    });

    req.flash("success", "Income source added");
    // console.log(incomeSources);
    res.redirect("/begin");
  });

app.get("/newExpense", (req, res) => {
  res.render("new-expense");
})

app.post("/newExpense", 
  [
    validateSource("expenseSourceName", "Source"),
    validateAmount("expenseAmount"),
  ],

  (req, res, next) => {
    let errors = validationResult(req);

    if (!errors.isEmpty()) {
      errors.array().forEach(error => req.flash("error", error.msg));
      res.render("new-source", {
        flash: req.flash(),
        errorMessages: errors.array().map((error) => error.msg),
        expenseSources: req.session.expenseSources,
      });
    } else {
      next();
    }
  },

  (req, res) => {
    let expenseName = req.body.expenseSourceName;
    let expenseAmount = req.body.expenseAmount;
    req.session.expenseSources.push({ 
      name: expenseName,
      amount: Number(expenseAmount).toFixed(2), 
    });

    req.flash("success", "Expense source added");
    res.redirect("/begin");
  }
);

app.get("/begin/income_:index/delete", (req, res) => {
  req.session.incomeSources.splice((req.params.index), 1);

  res.redirect("/begin");
});

app.get("/begin/expense_:index/delete", (req, res) => {
  req.session.expenseSources.splice((req.params.index), 1);

  res.redirect("/begin");
});


app.listen(3000, "localhost", () => {
  console.log("Listening to port 3000.");
});