INSERT INTO customers VALUES
(1, 'BuildRight Infra', 'Construction', 'ACTIVE'),
(2, 'EduMakers Lab', 'Education', 'ACTIVE');

INSERT INTO license_contracts VALUES
(100, 1, 'Enterprise', 20, 'ACTIVE', '2025-02-01', '2025-11-28', FALSE),
(200, 2, 'Trial', 15, 'ACTIVE', '2025-05-22', '2025-06-21', TRUE);

INSERT INTO users VALUES
(1, 1, 'a@buildright.example', 'ACTIVE', FALSE),
(2, 1, 'b@buildright.example', 'ACTIVE', FALSE),
(3, 1, 'internal@autodesk.example', 'ACTIVE', TRUE),
(4, 2, 'student@edu.example', 'ACTIVE', FALSE);

INSERT INTO license_assignments VALUES
(1, 100, 1, '2025-04-02', NULL),
(2, 100, 2, '2025-04-02', NULL),
(3, 100, 3, '2025-04-02', NULL),
(4, 200, 4, '2025-05-27', NULL);

INSERT INTO products VALUES
(10, 'AutoCAD', 'Design');

INSERT INTO usage_sessions VALUES
(1001, 1, 10, '2025-05-30 00:00:00'::TIMESTAMP, '2025-05-30 00:30:00'::TIMESTAMP, 30),
(1002, 2, 10, '2025-05-30 00:00:00'::TIMESTAMP, '2025-05-30 00:04:00'::TIMESTAMP, 4);