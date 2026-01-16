const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Database configurations
const mysqlConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'hackathon_user',
    password: process.env.DB_PASSWORD || 'hackathon_pass',
    database: process.env.DB_NAME || 'hackathon_db',
    waitForConnections: true,
    connectionLimit: 10
};

const mongoUri = process.env.MONGO_URI || 'mongodb://root:root123@localhost:27017/hackathon_db?authSource=admin';

// Create MySQL connection pool
let mysqlPool;
let mongoClient;
let mongoDB;

async function initDatabases() {
    try {
        // Initialize MySQL
        mysqlPool = mysql.createPool(mysqlConfig);
        console.log('MySQL connection pool created');

        // Initialize MongoDB
        mongoClient = new MongoClient(mongoUri);
        await mongoClient.connect();
        mongoDB = mongoClient.db('hackathon_db');
        console.log('MongoDB connected');
    } catch (error) {
        console.error('Database connection error:', error);
    }
}

// Import routes
const dataImportRoutes = require('./routes/dataImport');
const submissionRoutes = require('./routes/submissions');
const analyticsRoutes = require('./routes/analytics');
const registrationRoutes = require('./routes/registrations');

// Make database connections available to routes
app.use((req, res, next) => {
    req.mysqlPool = mysqlPool;
    req.mongoDB = mongoDB;
    next();
});

// API Routes
app.use('/api/data', dataImportRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/registrations', registrationRoutes);

// Health check
app.get('/api/health', async (req, res) => {
    try {
        // Test MySQL
        const [rows] = await mysqlPool.query('SELECT 1');
        
        // Test MongoDB
        await mongoDB.command({ ping: 1 });
        
        res.json({ 
            status: 'healthy', 
            mysql: 'connected',
            mongodb: 'connected'
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'unhealthy', 
            error: error.message 
        });
    }
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start server
initDatabases().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    if (mysqlPool) await mysqlPool.end();
    if (mongoClient) await mongoClient.close();
    process.exit(0);
});
