INSERT INTO customers VALUES
(1, 'BuildRight Infra', 'Construction', 'ACTIVE'),
(2, 'EduMakers Lab', 'Education', 'ACTIVE');

INSERT INTO license_contracts VALUES
(100, 1, 'Enterprise', 20, 'ACTIVE', CURRENT_DATE - INTERVAL '120 days', CURRENT_DATE + INTERVAL '180 days', FALSE),
(200, 2, 'Trial', 15, 'ACTIVE', CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '20 days', TRUE);

INSERT INTO users VALUES
(1, 1, 'a@buildright.example', 'ACTIVE', FALSE),
(2, 1, 'b@buildright.example', 'ACTIVE', FALSE),
(3, 1, 'internal@autodesk.example', 'ACTIVE', TRUE),
(4, 2, 'student@edu.example', 'ACTIVE', FALSE);

INSERT INTO license_assignments VALUES
(1, 100, 1, CURRENT_DATE - INTERVAL '60 days', NULL),
(2, 100, 2, CURRENT_DATE - INTERVAL '60 days', NULL),
(3, 100, 3, CURRENT_DATE - INTERVAL '60 days', NULL),
(4, 200, 4, CURRENT_DATE - INTERVAL '5 days', NULL);

INSERT INTO products VALUES
(10, 'AutoCAD', 'Design');

INSERT INTO usage_sessions VALUES
(1001, 1, 10, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '30 minutes', 30),
(1002, 2, 10, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '4 minutes', 4);
