INSERT INTO dark_stores VALUES
(1, 'Koramangala Dark Store', 'Bengaluru', 'ACTIVE'),
(2, 'Indiranagar Dark Store', 'Bengaluru', 'ACTIVE'),
(3, 'Old Airport Store', 'Bengaluru', 'INACTIVE');

INSERT INTO skus VALUES
(101, 'Organic Milk 1L', 'Dairy', 20, FALSE),
(102, 'Brown Bread', 'Bakery', 15, FALSE),
(103, 'Imported Cheese', 'Dairy', 5, TRUE);

INSERT INTO inventory_snapshots VALUES
(1, 1, 101, '2026-06-10', 18),
(2, 1, 101, '2026-06-14', 12),
(3, 1, 102, '2026-06-14', 40),
(4, 2, 101, '2026-06-14', 30),
(5, 2, 102, '2026-06-14', 8),
(6, 3, 101, '2026-06-14', 2),
(7, 1, 103, '2026-06-14', 1);

INSERT INTO sales_orders VALUES
(1001, 1, '2026-06-09', 'COMPLETED'),
(1002, 1, '2026-06-11', 'COMPLETED'),
(1003, 1, '2026-06-13', 'COMPLETED'),
(1004, 2, '2026-06-10', 'COMPLETED'),
(1005, 2, '2026-06-13', 'CANCELLED');

INSERT INTO sales_order_items VALUES
(1, 1001, 101, 10),
(2, 1002, 101, 8),
(3, 1003, 101, 12),
(4, 1001, 102, 3),
(5, 1004, 101, 7),
(6, 1005, 102, 50);
