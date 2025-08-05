const express = require('express');
require('dotenv').config();
const path = require('path')
const app = express();
const routes = require('./routes');
const { startCronJobs, stopCronJobs } = require("./config/cron")
const cors = require('cors');
const cookieParser = require('cookie-parser')

const { connectDB, mongoose } = require('./config/db')
connectDB()
    .then(() => {

        startCronJobs();

        const corsConfig = {
            origin: process.env.FRONTEND_URL,
            methods: ["GET", "POST", "PUT", "DELETE"],
            credentials: true,
            allowedHeaders: [
                "Origin",
                "Content-Type",
                "X-Requested-With",
                "Accept",
                "Authorization",
            ],
        };

        app.use(cors(corsConfig));

        app.use(
            express.urlencoded({
                extended: true,
                limit: "50mb",
            })
        );

        app.use(cookieParser())
        app.use(express.json({ limit: "50mb" }));
        app.use('/assets', express.static(path.join(__dirname, 'assets')));

        app.get("/api/health", (req, res) => {
            res.status(200).json({ success: true });
        });

        app.use('/', routes);

        const port = process.env.PORT || 5000;
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });

    }).catch((err) => {
        console.log(err);
    });

const gracefulShutdown = async () => {
    console.log('🛑 Server shutting down...');

    // Stop scheduled tasks
    stopCronJobs();

    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');

    // Exit the process
    process.exit();
}

/* when server shuts down or restarts to prevent multiple instances or lingering timers from running */
process.on('SIGINT', gracefulShutdown);// local dev: Ctrl+C
process.on('SIGTERM', gracefulShutdown);  // Render platform
