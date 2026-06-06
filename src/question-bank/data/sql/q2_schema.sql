CREATE TABLE clients (
  client_id INT PRIMARY KEY,
  client_name VARCHAR(120),
  account_status VARCHAR(40)
);

CREATE TABLE servers (
  server_id INT PRIMARY KEY,
  client_id INT REFERENCES clients(client_id),
  server_name VARCHAR(120),
  environment VARCHAR(40),
  is_active BOOLEAN
);

CREATE TABLE backup_policies (
  policy_id INT PRIMARY KEY,
  policy_name VARCHAR(120),
  backup_frequency VARCHAR(40),
  is_enabled BOOLEAN
);

CREATE TABLE server_policy_map (
  server_id INT REFERENCES servers(server_id),
  policy_id INT REFERENCES backup_policies(policy_id),
  effective_from DATE,
  effective_to DATE
);

CREATE TABLE backup_jobs (
  job_id INT PRIMARY KEY,
  server_id INT REFERENCES servers(server_id),
  policy_id INT REFERENCES backup_policies(policy_id),
  scheduled_start_ts TIMESTAMP,
  completed_ts TIMESTAMP,
  status VARCHAR(40),
  data_size_gb DECIMAL(12,2)
);

CREATE TABLE backup_error_logs (
  job_id INT REFERENCES backup_jobs(job_id),
  error_code VARCHAR(40),
  error_message VARCHAR(255)
);
