import express from 'express';
import { Pool } from 'pg';


const app = express();
app.use(express.json());


const PORT = process.env.ORDERS_PORT || 3002;
const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_ORDERS;


const pool = new Pool({ connectionString: DATABASE_URL });


app.get('/health', (req, res) => res.json({ status: 'ok', service: 'orders' }));


// Crear orden (POST /)
app.post('/', async (req, res) => {
const { item, qty } = req.body || {};
if (!item || !qty) return res.status(400).json({ error: 'item and qty required' });


const client = await pool.connect();
try {
await client.query('CREATE TABLE IF NOT EXISTS orders(id SERIAL PRIMARY KEY, item TEXT, qty INT);');
const { rows } = await client.query(
'INSERT INTO orders(item, qty) VALUES ($1,$2) RETURNING id, item, qty;',
[item, qty]
);
res.status(201).json(rows[0]);
} catch (e) {
console.error(e);
res.status(500).json({ error: 'orders error', detail: e.message });
} finally {
client.release();
}
});


// Listar órdenes (GET /)
app.get('/', async (_req, res) => {
const { rows } = await pool.query('SELECT id, item, qty FROM orders ORDER BY id;');
res.json(rows);
});


app.listen(PORT, () => console.log(`Orders on ${PORT}`));