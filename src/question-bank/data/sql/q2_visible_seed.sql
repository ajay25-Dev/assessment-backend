INSERT INTO clients VALUES
(1, 'Northwind Finance', 'ACTIVE'),
(2, 'Legacy Retail', 'ACTIVE');

INSERT INTO servers VALUES
(10, 1, 'fin-prod-db-1', 'PROD', TRUE),
(11, 1, 'fin-stage-app-1', 'STAGE', TRUE),
(20, 2, 'retail-prod-db-1', 'PROD', TRUE);

INSERT INTO backup_policies VALUES
(100, 'Daily Critical Backup', 'DAILY', TRUE),
(200, 'Weekly Archive', 'WEEKLY', TRUE);

INSERT INTO server_policy_map VALUES
(10, 100, '2025-03-03', NULL),
(11, 100, '2025-03-03', NULL),
(20, 200, '2025-03-03', NULL);

INSERT INTO backup_jobs VALUES
(1001, 10, 100, '2025-05-28 00:00:00'::TIMESTAMP, '2025-05-28 01:00:00'::TIMESTAMP, 'FAILED', 20),
(1002, 10, 100, '2025-05-29 00:00:00'::TIMESTAMP, '2025-05-29 01:00:00'::TIMESTAMP, 'FAILED', 21),
(1003, 10, 100, '2025-05-30 00:00:00'::TIMESTAMP, '2025-05-30 01:00:00'::TIMESTAMP, 'FAILED', 21),
(1004, 11, 100, '2025-05-29 00:00:00'::TIMESTAMP, '2025-05-29 01:00:00'::TIMESTAMP, 'FAILED', 10),
(1005, 11, 100, '2025-05-30 00:00:00'::TIMESTAMP, '2025-05-30 01:00:00'::TIMESTAMP, 'SUCCESS', 10);

INSERT INTO backup_error_logs VALUES
(1003, 'E_CONN', 'Repository connection failed');