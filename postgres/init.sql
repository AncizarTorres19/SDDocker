-- Crear bases (si no existen)
CREATE DATABASE catalog;
CREATE DATABASE orders;

\connect catalog
-- Tabla items para catalog
CREATE TABLE IF NOT EXISTS items (
	id SERIAL PRIMARY KEY,
	name TEXT NOT NULL,
	price NUMERIC DEFAULT 0
);

INSERT INTO items (name, price) VALUES
	('rope', 5.5),
	('ring', 12.0),
	('band', 3.25)
ON CONFLICT DO NOTHING;

\connect orders
-- Tabla orders
CREATE TABLE IF NOT EXISTS orders (
	id SERIAL PRIMARY KEY,
	item TEXT,
	qty INT
);

INSERT INTO orders (item, qty) VALUES
	('rope', 2),
	('ring', 1)
ON CONFLICT DO NOTHING;