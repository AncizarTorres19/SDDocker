import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';


const app = express();
const PORT = process.env.GATEWAY_PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';


app.use(helmet());
app.use(cors());
app.use(express.json());


// Correlación de requests
app.use((req, res, next) => {
req.id = req.headers['x-request-id'] || uuidv4();
res.setHeader('x-request-id', req.id);
next();
});


app.use(morgan(':method :url :status - reqid=:req[id] - :res[content-length] bytes - :response-time ms'));


// Rate limiting por IP
const limiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false });
app.use(limiter);


app.get('/health', (req, res) => res.json({ status: 'ok', service: 'gateway' }));


// Ruta de demo para emitir un JWT
app.post('/auth/token', (req, res) => {
const user = (req.body && req.body.user) || 'demo';
const token = jwt.sign({ sub: user, role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
res.json({ token });
});


// Middleware opcional de auth (descomenta en la ruta que quieras proteger)
function auth(req, res, next) {
const authHeader = req.headers.authorization || '';
const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
if (!token) return res.status(401).json({ error: 'missing token' });
try { req.user = jwt.verify(token, JWT_SECRET); return next(); }
catch { return res.status(401).json({ error: 'invalid token' }); }
}


// Proxy a Catalog
const catalogTarget = `http://catalog:${process.env.CATALOG_PORT || 3001}`;
app.use('/api/catalog', createProxyMiddleware({
target: catalogTarget,
changeOrigin: true,
pathRewrite: { '^/api/catalog': '/' },
onProxyReq(proxyReq, req) { proxyReq.setHeader('x-request-id', req.id); }
}));


// Proxy a Orders (protección opcional)
const ordersTarget = `http://orders:${process.env.ORDERS_PORT || 3002}`;
app.use('/api/orders', /*auth,*/ createProxyMiddleware({
target: ordersTarget,
changeOrigin: true,
pathRewrite: { '^/api/orders': '/' },
onProxyReq(proxyReq, req) { proxyReq.setHeader('x-request-id', req.id); }
}));


app.listen(PORT, () => console.log(`Gateway listening on ${PORT}`));