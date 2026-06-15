INSERT INTO accounts VALUES
(1, 'BuildRight Infra', 'ACTIVE'),
(2, 'EduMakers Lab', 'ACTIVE'),
(3, 'RetailPro Systems', 'ACTIVE'),
(4, 'MediaFlow Ltd', 'ACTIVE'),
(5, 'Dormant Works', 'INACTIVE');

INSERT INTO contracts VALUES
(100, 1, 'Enterprise', 10, 'ACTIVE', '2025-07-01', '2026-07-20', FALSE),
(200, 2, 'Professional', 10, 'ACTIVE', '2025-08-01', '2026-07-10', FALSE),
(300, 3, 'Enterprise', 5, 'ACTIVE', '2025-09-01', '2026-07-05', TRUE),
(400, 4, 'Enterprise', 5, 'ACTIVE', '2025-10-01', '2026-08-01', FALSE),
(500, 5, 'Professional', 5, 'ACTIVE', '2025-10-01', '2026-07-01', FALSE);

INSERT INTO licensed_users VALUES
(1, 1, 'a@buildright.example', 'ACTIVE', FALSE),
(2, 1, 'b@buildright.example', 'ACTIVE', FALSE),
(3, 1, 'c@buildright.example', 'ACTIVE', FALSE),
(4, 1, 'd@buildright.example', 'ACTIVE', FALSE),
(5, 1, 'e@buildright.example', 'ACTIVE', FALSE),
(6, 1, 'f@buildright.example', 'ACTIVE', FALSE),
(7, 1, 'g@buildright.example', 'ACTIVE', FALSE),
(8, 1, 'h@buildright.example', 'ACTIVE', FALSE),
(9, 1, 'internal@buildright.example', 'ACTIVE', TRUE),
(10, 2, 'a@edu.example', 'ACTIVE', FALSE),
(11, 2, 'b@edu.example', 'ACTIVE', FALSE),
(12, 4, 'a@mediaflow.example', 'ACTIVE', FALSE),
(13, 4, 'b@mediaflow.example', 'ACTIVE', FALSE),
(14, 4, 'c@mediaflow.example', 'ACTIVE', FALSE),
(15, 4, 'd@mediaflow.example', 'ACTIVE', FALSE);

INSERT INTO license_assignments VALUES
(1, 100, 1, '2026-01-01', NULL),
(2, 100, 2, '2026-01-01', NULL),
(3, 100, 3, '2026-01-01', NULL),
(4, 100, 4, '2026-01-01', NULL),
(5, 100, 5, '2026-01-01', NULL),
(6, 100, 6, '2026-01-01', NULL),
(7, 100, 7, '2026-01-01', NULL),
(8, 100, 8, '2026-01-01', NULL),
(9, 100, 9, '2026-01-01', NULL),
(10, 200, 10, '2026-01-01', NULL),
(11, 200, 11, '2026-01-01', NULL),
(12, 400, 12, '2026-01-01', NULL),
(13, 400, 13, '2026-01-01', NULL),
(14, 400, 14, '2026-01-01', NULL),
(15, 400, 15, '2026-01-01', NULL);

INSERT INTO product_usage_events VALUES
(1, 1, '2026-06-01', 'LOGIN'),
(2, 2, '2026-06-02', 'REPORT_VIEW'),
(3, 3, '2026-06-03', 'LOGIN'),
(4, 4, '2026-06-04', 'DASHBOARD_VIEW'),
(5, 5, '2026-06-05', 'LOGIN'),
(6, 6, '2026-06-06', 'REPORT_VIEW'),
(7, 7, '2026-06-07', 'LOGIN'),
(8, 8, '2026-06-08', 'DASHBOARD_VIEW'),
(9, 9, '2026-06-08', 'LOGIN'),
(10, 10, '2026-06-08', 'LOGIN'),
(11, 12, '2026-06-01', 'LOGIN'),
(12, 13, '2026-06-02', 'REPORT_VIEW'),
(13, 14, '2026-06-03', 'DASHBOARD_VIEW'),
(14, 15, '2026-06-04', 'LOGIN');

INSERT INTO support_tickets VALUES
(1, 2, 'CRITICAL', 'OPEN', '2026-06-05'),
(2, 4, 'HIGH', 'OPEN', '2026-06-06');
