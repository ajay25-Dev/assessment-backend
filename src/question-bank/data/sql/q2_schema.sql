CREATE TABLE merchants (
  merchant_id INT PRIMARY KEY,
  merchant_name VARCHAR(120),
  merchant_status VARCHAR(40)
);

CREATE TABLE payment_transactions (
  txn_id INT PRIMARY KEY,
  merchant_id INT REFERENCES merchants(merchant_id),
  txn_amount DECIMAL(12,2),
  gateway_fee DECIMAL(12,2),
  tax_amount DECIMAL(12,2),
  txn_status VARCHAR(40),
  captured_at DATE,
  settlement_due_date DATE
);

CREATE TABLE settlement_payouts (
  payout_id INT PRIMARY KEY,
  txn_id INT REFERENCES payment_transactions(txn_id),
  payout_date DATE,
  payout_amount DECIMAL(12,2),
  payout_status VARCHAR(40)
);
