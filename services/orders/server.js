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
// Helper: ensure orders table exists
async function ensureOrdersTable() {
	const client = await pool.connect();
	try {
		await client.query('CREATE TABLE IF NOT EXISTS orders(id SERIAL PRIMARY KEY, item TEXT, qty INT);');
	} finally {
		client.release();
	}
}

async function listOrdersHandler(_req, res) {
	try {
		await ensureOrdersTable();
		const { rows } = await pool.query('SELECT id, item, qty FROM orders ORDER BY id;');
		res.json(rows);
	} catch (e) {
		console.error(e);
		res.status(500).json({ error: 'orders error', detail: e.message });
	}
}

app.get('/', listOrdersHandler);
app.get('/orders', listOrdersHandler);

// Get single order
app.get('/orders/:id', async (req, res) => {
	const id = parseInt(req.params.id, 10);
	try {
		await ensureOrdersTable();
		const { rows } = await pool.query('SELECT id, item, qty FROM orders WHERE id = $1', [id]);
		if (rows.length === 0) return res.status(404).json({ error: 'not found' });
		res.json(rows[0]);
	} catch (e) {
		console.error(e);
		res.status(500).json({ error: 'orders error', detail: e.message });
	}
});

// Update order
app.put('/orders/:id', async (req, res) => {
	const id = parseInt(req.params.id, 10);
	const { item, qty } = req.body || {};
	try {
		await ensureOrdersTable();
		const { rows } = await pool.query('UPDATE orders SET item = COALESCE($2, item), qty = COALESCE($3, qty) WHERE id = $1 RETURNING id, item, qty;', [id, item, qty]);
		if (rows.length === 0) return res.status(404).json({ error: 'not found' });
		res.json(rows[0]);
	} catch (e) {
		console.error(e);
		res.status(500).json({ error: 'orders error', detail: e.message });
	}
});

// Delete order
app.delete('/orders/:id', async (req, res) => {
	const id = parseInt(req.params.id, 10);
	try {
		await ensureOrdersTable();
		const { rowCount } = await pool.query('DELETE FROM orders WHERE id = $1;', [id]);
		if (rowCount === 0) return res.status(404).json({ error: 'not found' });
		res.status(204).send();
	} catch (e) {
		console.error(e);
		res.status(500).json({ error: 'orders error', detail: e.message });
	}
});


app.listen(PORT, () => console.log(`Orders on ${PORT}`));