CREATE TABLE customers (
  customer_id INT PRIMARY KEY,
  customer_name VARCHAR(120),
  industry VARCHAR(80),
  account_status VARCHAR(40)
);

CREATE TABLE license_contracts (
  contract_id INT PRIMARY KEY,
  customer_id INT REFERENCES customers(customer_id),
  plan_type VARCHAR(60),
  purchased_seats INT,
  contract_status VARCHAR(40),
  start_date DATE,
  end_date DATE,
  is_trial BOOLEAN
);

CREATE TABLE users (
  user_id INT PRIMARY KEY,
  customer_id INT REFERENCES customers(customer_id),
  user_email VARCHAR(160),
  user_status VARCHAR(40),
  is_internal_user BOOLEAN
);

CREATE TABLE license_assignments (
  assignment_id INT PRIMARY KEY,
  contract_id INT REFERENCES license_contracts(contract_id),
  user_id INT REFERENCES users(user_id),
  assigned_from DATE,
  assigned_to DATE
);

CREATE TABLE usage_sessions (
  session_id INT PRIMARY KEY,
  user_id INT REFERENCES users(user_id),
  product_id INT,
  session_start_ts TIMESTAMP,
  session_end_ts TIMESTAMP,
  minutes_used INT
);

CREATE TABLE products (
  product_id INT PRIMARY KEY,
  product_name VARCHAR(120),
  product_family VARCHAR(80)
);
