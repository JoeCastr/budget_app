const express = require('express');
const morgan = require('morgan');
const app = express();
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
    // .matches(/\d+\.{0,1}\d*/)
    // .withMessage("Please enter a number greater than .00")
    // .bail()
    // .not()
    // .matches(/.*\,.*/)
    // .withMessage("Please do not use commas")
    // .bail()
    // .matches(/\d+/)
    // .withMessage("Please enter numbers only")


    // This line is the one I am having problems with.
    // Entries with non-numeric characters like "1*" or "1," will get through
    // even though they shouldn't
    .custom((val) => (/\d+\.{0,1}\d*/).test(val)) /
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

app.set("views", "./views");
app.set("view engine", "pug");

app.get("/", (req, res) => {
  res.redirect("/begin");
});

app.get("/begin",
  catchError(async (req, res) => {
    let store = res.locals.store;
    let expense_list = await store.loadExpenseList();
    let income_list = await store.loadIncomeList();
    let total = await store.total(income_list, expense_list);

    res.render("begin", {
      flash: req.flash(),
      sources: income_list,
      expenses: expense_list,
      total: total,
    });
  }),
);

app.get("/newSource", (req, res) => {
  res.render("new-source");
});

app.post("/newSource",
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

app.get("/newExpense", (req, res) => {
  res.render("new-expense");
});

app.post("/newExpense", 
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
  // req.session.incomeSources.splice((req.params.index), 1);
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
  // req.session.expenseSources.splice((req.params.index), 1);
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


app.listen(3000, "localhost", () => {
  console.log("Listening to port 3000.");
});
