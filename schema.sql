CREATE TABLE expense_list (
  id serial PRIMARY KEY,
  expense_name varchar(25) NOT NULL,
  expense_amount numeric NOT NULL,
  username text NOT NULL
);

CREATE TABLE income_list (
  id serial PRIMARY KEY,
  source_name varchar(25) NOT NULL,
  source_amount numeric NOT NULL,
  username text NOT NULL
);

CREATE TABLE users (
 username text NOT NULL PRIMARY KEY,
 password text NOT NULL
);