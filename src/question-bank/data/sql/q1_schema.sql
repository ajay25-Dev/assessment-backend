CREATE TABLE customers (
  customer_id INT PRIMARY KEY,
  customer_name VARCHAR(120),
  city VARCHAR(80),
  customer_segment VARCHAR(50),
  signup_date DATE
);

CREATE TABLE orders (
  order_id INT PRIMARY KEY,
  customer_id INT REFERENCES customers(customer_id),
  order_date DATE,
  order_status VARCHAR(40),
  promised_delivery_ts TIMESTAMP,
  order_value DECIMAL(12,2)
);

CREATE TABLE order_items (
  order_id INT REFERENCES orders(order_id),
  item_id INT,
  product_id INT,
  item_status VARCHAR(40),
  item_value DECIMAL(12,2),
  PRIMARY KEY (order_id, item_id)
);

CREATE TABLE shipments (
  shipment_id INT PRIMARY KEY,
  order_id INT REFERENCES orders(order_id),
  shipped_ts TIMESTAMP,
  delivered_ts TIMESTAMP,
  shipment_status VARCHAR(40),
  fulfilment_center_id INT
);

CREATE TABLE fulfilment_centers (
  fulfilment_center_id INT PRIMARY KEY,
  city VARCHAR(80),
  region VARCHAR(80)
);
