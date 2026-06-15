CREATE TABLE accounts (
  account_id INT PRIMARY KEY,
  account_name VARCHAR(120),
  account_status VARCHAR(40)
);

CREATE TABLE contracts (
  contract_id INT PRIMARY KEY,
  account_id INT REFERENCES accounts(account_id),
  plan_type VARCHAR(60),
  seats_purchased INT,
  contract_status VARCHAR(40),
  start_date DATE,
  end_date DATE,
  is_trial BOOLEAN
);

CREATE TABLE licensed_users (
  user_id INT PRIMARY KEY,
  account_id INT REFERENCES accounts(account_id),
  user_email VARCHAR(160),
  user_status VARCHAR(40),
  is_internal_user BOOLEAN
);

CREATE TABLE license_assignments (
  assignment_id INT PRIMARY KEY,
  contract_id INT REFERENCES contracts(contract_id),
  user_id INT REFERENCES licensed_users(user_id),
  assigned_from DATE,
  assigned_to DATE
);

CREATE TABLE product_usage_events (
  event_id INT PRIMARY KEY,
  user_id INT REFERENCES licensed_users(user_id),
  event_date DATE,
  event_type VARCHAR(80)
);

CREATE TABLE support_tickets (
  ticket_id INT PRIMARY KEY,
  account_id INT REFERENCES accounts(account_id),
  severity VARCHAR(40),
  ticket_status VARCHAR(40),
  opened_at DATE
);
