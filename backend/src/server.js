require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes   = require('./routes/auth');
const tripRoutes   = require('./routes/trips');
const driverRoutes = require('./routes/drivers');

const app = express();

// CORS — permite frontend local y de producción
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'Uber Clone API running' }));

app.use('/api/auth',    authRoutes);
app.use('/api/trips',   tripRoutes);
app.use('/api/drivers', driverRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
