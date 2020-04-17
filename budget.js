const express = require("express");
const morgan = require("morgan");
const app = express();

let incomeSources = [];
let expenseSources = [];
function totals(arr) {
  let result = 0;
  for (let idx = 0; idx < arr.length; idx += 1) {
    result += Number(arr[idx]["amount"]);
  }
  return result
}

let net = totals(incomeSources)


app.use(express.static("public"));
app.use(morgan("common"));
app.use(express.urlencoded({ extended: false }));

app.set("views", "./views");
app.set("view engine", "pug");

app.get("/", (req, res) => {
  res.redirect("/begin");
});

app.get("/begin", (req, res) => {
  res.render("begin", {
    sources: incomeSources,
    expenses: expenseSources,
    total: totals(incomeSources) - totals(expenseSources)
  });
});

app.post("/begin/newSource", (req, res) => {
  let incomeName = req.body.incomeSourceName;
  let incomeAmount = req.body.incomeAmount;
  incomeSources.push({ 
    name: incomeName,
    amount: incomeAmount, 
  });

  res.redirect("/begin")
});

app.post("/begin/newExpense", (req, res) => {
  let expenseName = req.body.expenseSourceName;
  let expenseAmount = req.body.expenseAmount;
  expenseSources.push({ 
    name: expenseName,
    amount: expenseAmount, 
  });

  res.redirect("/begin");
});

app.get("/begin/income_:index/delete", (req, res) => {
  incomeSources.splice((req.params.index), 1);

  res.redirect("/begin");
})

app.get("/begin/expense_:index/delete", (req, res) => {
  expenseSources.splice((req.params.index), 1);

  res.redirect("/begin");
})


app.listen(3000, "localhost", () => {
  console.log("Listening to port 3000.");
});