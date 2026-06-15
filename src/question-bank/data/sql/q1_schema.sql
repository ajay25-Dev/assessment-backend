CREATE TABLE dark_stores (
  store_id INT PRIMARY KEY,
  store_name VARCHAR(120),
  city VARCHAR(80),
  store_status VARCHAR(40)
);

CREATE TABLE skus (
  sku_id INT PRIMARY KEY,
  sku_name VARCHAR(120),
  category VARCHAR(80),
  reorder_point INT,
  is_discontinued BOOLEAN
);

CREATE TABLE inventory_snapshots (
  snapshot_id INT PRIMARY KEY,
  store_id INT REFERENCES dark_stores(store_id),
  sku_id INT REFERENCES skus(sku_id),
  snapshot_date DATE,
  on_hand_units INT
);

CREATE TABLE sales_orders (
  order_id INT PRIMARY KEY,
  store_id INT REFERENCES dark_stores(store_id),
  order_date DATE,
  order_status VARCHAR(40)
);

CREATE TABLE sales_order_items (
  order_item_id INT PRIMARY KEY,
  order_id INT REFERENCES sales_orders(order_id),
  sku_id INT REFERENCES skus(sku_id),
  quantity INT
);
