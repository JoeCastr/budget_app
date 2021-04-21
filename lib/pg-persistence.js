// const { Client } = require("pg");
const { dbQuery } = require("./db-query");
const bcrypt = require("bcrypt");

module.exports = class PgPersistence {
  constructor(session) {
    this.username = session.username;
  }

  async loadExpenseList() {
    let SELECT_EXPENSE_LIST = "SELECT id, expense_name, expense_amount FROM expense_list WHERE username = $1";

    let result = await dbQuery(SELECT_EXPENSE_LIST, this.username);
    // console.log("load expense list ", result.rows);
    return result.rows;
  }

  async loadIncomeList() {
    let SELECT_INCOME_LIST = "SELECT id, source_name, source_amount FROM income_list WHERE username = $1";

    let result = await dbQuery(SELECT_INCOME_LIST, this.username);
    // console.log("load income list", result.rows);
    return result.rows;
  }

  async updateIncomeList(name, amount) {
    let UPDATE_INCOME_LIST = "INSERT INTO income_list (source_name, source_amount, username)" +
                             " VALUES ($1, $2, $3)";

    let result = await dbQuery(UPDATE_INCOME_LIST, name, amount, this.username);
    return result.rows;
  }

  async updateExpenseList(name, amount) {
    let UPDATE_EXPENSE_LIST = "INSERT INTO expense_list (expense_name, expense_amount, username)" +
                             " VALUES ($1, $2, $3)";

    let result = await dbQuery(UPDATE_EXPENSE_LIST, name, amount, this.username);
    return result.rows;
  }

  async deleteIncomeSource(income_id) {
    let DELETE_SOURCE = "DELETE FROM income_list WHERE id = $1";

    let result = await dbQuery(DELETE_SOURCE, income_id);
    return result;
  }

  async deleteExpenseSource(expense_id) {
    let DELETE_EXPENSE = "DELETE FROM expense_list WHERE id = $1 AND username = $2";

    let result = await dbQuery(DELETE_EXPENSE, expense_id, this.username);
    return result;
  }

  async total() {

    let incomeList = await this.loadIncomeList();
    let expenseList = await this.loadExpenseList();

    let total = 0;

    // console.log("income list " + incomeList);
    // console.log("expense list " + expenseList);

    for (let idx1 = 0; idx1 < incomeList.length; idx1 += 1) {
      let currentIncomeAmount = incomeList[idx1].source_amount;
      console.log("current income amount " + currentIncomeAmount)
      total += Number(currentIncomeAmount);
    }

    for (let idx2 = 0; idx2 < expenseList.length; idx2 += 1) {
      let currentExpenseAmount = expenseList[idx2].expense_amount;
      console.log("current expense amount " + currentExpenseAmount)
      total -= Number(currentExpenseAmount);
    }

    return total.toFixed(2);
  }

  // async addUser(username, password) {
  //   let ADD_USER = "INSERT INTO users (username, password)" + 
  //                  " VALUES ($1, $2)";

  //   let result = await dbQuery(ADD_USER, username, password);
  //   return result;
  // }

  async authenticate(username, password) {
    const FIND_HASHED_PASSWORD = "SELECT password FROM users" +
                         " WHERE username = $1";

    let result = await dbQuery(FIND_HASHED_PASSWORD, username);
    if (result.rowCount === 0) return false;

    return result.rowCount > 0;
  }
};