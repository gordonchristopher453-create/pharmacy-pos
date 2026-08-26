const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { connectDB } = require('./config/db');
const { errorHandler, notFound } = require('./middleware/error.middleware');
const { protect, requirePharmacy } = require('./middleware/auth.middleware');
const initSocket = require('./sockets/socket.handler');
const logger = require('./utils/logger');
const { checkExpiringSubscriptions } = require('./utils/expiryChecker');

const app = express();
app.get('/health', (req, res) => res.status(200).send('OK'));
const server = http.createServer(app);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const io = socketio(server, {
  cors: { origin: true, methods: ['GET', 'POST'], credentials: true }
});

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 2000, message: 'Too many requests' });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: 'Too many login attempts' });

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP in dev/iframe environment to allow loading assets and scripts smoothly
}));
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api', limiter);

app.get('/api/status', (req, res) => {
  res.json({ success: true, message: '💊 Medicare HMS API', version: '2.0.0' });
});
app.get('/api/test-vision-key', (req, res) => {
  const key = process.env.GOOGLE_VISION_API_KEY;
  res.json({ exists: !!key, preview: key ? key.slice(0, 8) + '...' : 'NOT FOUND' });
});

// Auth
app.use('/api/auth', authLimiter, require('./routes/auth.routes'));

// Core
app.use('/api/pharmacy',       require('./routes/pharmacy.routes'));
app.use('/api/users',          require('./routes/users.routes'));
app.use('/api/audit',          require('./routes/audit.routes'));
app.use('/api/upload',         require('./routes/upload.routes'));

// Protected routes
app.use('/api/products',       protect, requirePharmacy, require('./routes/product.routes'));
app.use('/api/sales',          protect, requirePharmacy, require('./routes/sale.routes'));
app.use('/api/stock',          protect, requirePharmacy, require('./routes/stock.routes'));
app.use('/api/stock-transfers',protect, requirePharmacy, require('./routes/stockTransfer.routes'));
app.use('/api/finance',        protect, requirePharmacy, require('./routes/finance.routes'));
app.use('/api/hr',             protect, requirePharmacy, require('./routes/hr.routes'));
app.use('/api/reports',        protect, requirePharmacy, require('./routes/reports.routes'));
app.use('/api/dashboard',      protect, requirePharmacy, require('./routes/dashboard.routes'));

// Patients & Visits
app.use('/api/patients',       require('./routes/patient.routes'));
app.use('/api/visits',         require('./routes/visit.routes'));
app.use('/api/encounters',     protect, requirePharmacy, require('./routes/encounter.routes'));
app.use('/api/consultations',  protect, requirePharmacy, require('./routes/consultation.routes'));
app.use('/api/billing',        protect, requirePharmacy, require('./routes/billing.routes'));

// Lab - mount on BOTH paths frontend might call
app.use('/api/lab',            protect, requirePharmacy, require('./routes/lab.routes'));
app.use('/api/lab-requests',   protect, requirePharmacy, require('./routes/lab_management.routes'));
app.use('/api/labs',           protect, requirePharmacy, require('./routes/lab.routes'));

// Prescriptions

// Other departments
app.use('/api/procedures',     protect, requirePharmacy, require('./routes/procedure.routes'));
app.use('/api/injection-room', protect, requirePharmacy, require('./routes/injection.routes'));
app.use('/api/inpatient',      protect, requirePharmacy, require('./routes/inpatient.routes'));
app.use('/api/icd10',          require('./routes/icd.routes'));
app.use('/api/icd11',          require('./routes/icd.routes'));
app.use('/api/icd',            require('./routes/icd.routes'));
app.use('/api/ai',             protect, requirePharmacy, require('./routes/ai.routes'));

// Special Clinics
app.use('/api/special-clinics', protect, requirePharmacy, require('./routes/specialClinic.routes'));

// Clinical Decision Support & Enterprise Order Management
app.use('/api/cds',            protect, requirePharmacy, require('./routes/cds.routes'));
app.use('/api/orders',         protect, requirePharmacy, require('./routes/orders.routes'));

// MCH
app.use('/api/anc',            protect, requirePharmacy, require('./routes/anc.routes'));
app.use('/api/pnc',            protect, requirePharmacy, require('./routes/pnc.routes'));
app.use('/api/cwc',            protect, requirePharmacy, require('./routes/cwc.routes'));
app.use('/api/delivery',       protect, requirePharmacy, require('./routes/delivery.routes'));
app.use('/api/mch/delivery',   protect, requirePharmacy, require('./routes/delivery.routes'));
app.use('/api/immunization',   protect, requirePharmacy, require('./routes/immunization.routes'));
app.use('/api/mch',            protect, requirePharmacy, require('./routes/mch.routes'));
app.use('/api/mch-stock',      protect, requirePharmacy, require('./routes/mch_stock.routes'));
app.use('/api/prescriptions', require('./routes/pharmacy.routes'));
app.use('/api/service-prices', require('./routes/service-prices.routes'));
app.use('/api', require('./routes/kenya_medical.routes'));

// Serve Frontend Static Assets or use Vite Middleware
let devMiddleware = null;
let useStaticFallback = false;

if (process.env.NODE_ENV !== 'production') {
  const path = require('path');
  try {
    let viteModule;
    try {
      viteModule = require('vite');
    } catch (e) {
      // Resolve from frontend directory if not available in backend
      const frontendVitePath = path.join(__dirname, '../frontend/node_modules/vite');
      viteModule = require(frontendVitePath);
    }
    const { createServer: createViteServer } = viteModule;
    createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      root: path.join(__dirname, '../frontend')
    }).then((viteInstance) => {
      devMiddleware = viteInstance.middlewares;
      logger.info('✅ Vite dev middleware initialized successfully');
    }).catch((err) => {
      logger.warn('⚠️ Vite dev server failed to start, falling back to static files:', err.message);
      useStaticFallback = true;
    });
  } catch (err) {
    logger.info('ℹ️ Vite is not installed in backend/frontend, falling back to static built files.', err.message);
    useStaticFallback = true;
  }
}

// Synchronous delegating middleware for frontend serving
app.use((req, res, next) => {
  // Always skip API and socket.io routes
  if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/socket.io')) {
    return next();
  }

  if (process.env.NODE_ENV !== 'production' && !useStaticFallback) {
    if (devMiddleware) {
      return devMiddleware(req, res, next);
    }
  }

  // Serve built static files if available
  const path = require('path');
  const fs = require('fs');
  const distPath = path.join(__dirname, '../frontend/dist');
  const indexPath = path.join(distPath, 'index.html');

  if (fs.existsSync(indexPath)) {
    return express.static(distPath)(req, res, (err) => {
      if (err) return next(err);
      res.sendFile(indexPath, (sendErr) => {
        if (sendErr && !res.headersSent) {
          res.status(503).send('Application is starting, please refresh in a moment...');
        }
      });
    });
  }

  return res.status(503).send('Application is starting, please refresh in a moment...');
});

app.use(notFound);
app.use(errorHandler);

initSocket(io);
app.set('io', io);

const startExpiryChecker = () => {
  checkExpiringSubscriptions();
  setInterval(checkExpiringSubscriptions, 24 * 60 * 60 * 1000);
  logger.info('⏰ Expiry checker scheduled (every 24h)');
};

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  logger.info('================================');
  logger.info('💊 Medicare HMS Backend v2.0');
  logger.info('================================');
  logger.info(`🚀 Server     : http://0.0.0.0:${PORT}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
  logger.info(`📧 Email      : ${process.env.SMTP_USER ? 'Configured ✅' : 'NOT configured ❌'}`);
  logger.info('================================');

  // Connect and run database migrations/seeds asynchronously in the background
  connectDB()
    .then(() => {
      startExpiryChecker();
    })
    .catch((err) => {
      logger.error('Database connection/initialization failed:', err.message);
    });
});

module.exports = { app, io };

