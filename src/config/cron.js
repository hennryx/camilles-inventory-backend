const { CronJob } = require('cron');
const https = require('https');
const ProductBatch = require('../models/Products/batchSchema');
const Product = require('../models/Products/ProductSchema');
const Notification = require('../models/Notification/NotificationSchema');
require('dotenv').config();

const checkStocks = async () => {
    try {
        const products = await Product.find({ status: 'active' });
        for (const product of products) {
            await Product.updateTotalStock(product._id);
        }
        console.log('Stock check completed');
        return { success: true, message: 'Stock check completed' };
    } catch (error) {
        console.error('Error in cron job:', error.message);
        return { success: false, error: error.message };
    }
};

const checkExpires = async () => {
    try {
        await ProductBatch.checkExpiredBatches();
        console.log('Expired products check completed');
        return { success: true, message: 'expiry check completed' };
    } catch (error) {
        console.error('Error in cron job:', error.message);
        return { success: false, error: error.message };
    }
}

// CronJob: run every day at midnight
const dailyMidnightJob = new CronJob('0 0 * * *', async () => {
    console.log('Running the midnight expiry check...');
    await checkExpires();
}, null, false)

// CronJob: run every hour at minute 0
const hourlyJob = new CronJob('0 * * * *', async () => {
    console.log('Running hourly stock and expiry check...');
    await checkStocks();
}, null, false); // false means don't start immediately

// CronJob: run every day at midnight
const cleanupJob = new CronJob('0 0 * * *', async () => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        await Notification.deleteMany({ createdAt: { $lt: thirtyDaysAgo } });
        console.log('Cleaned up old notifications');
    } catch (error) {
        console.error('Error cleaning up notifications:', error.message);
    }
}, null, false);

// CronJob: health check every 14 minutes to keep the server alive we need to check it every 14 minutes
const performHealthCheck = async () => {
    https
        .get(process.env.API_URL_HEALTH, (res) => {
            if (res.statusCode === 200) console.log('GET request sent successfully');
            else console.log('GET request failed', res.statusCode);
        })
        .on('error', (e) => console.error('Error while sending request', e));
};

const healthCheckJob = new CronJob('*/14 * * * *', async () => {
    await performHealthCheck();
}, null, false);

// Start all cron jobs
const startCronJobs = () => {
    hourlyJob.start();
    dailyMidnightJob.start();
    cleanupJob.start();
    if (process.env.NODE_ENV === 'production') {
        console.log('Health check started');
        healthCheckJob.start();
    }
    console.log('Cron jobs started');
};

// Stop all cron jobs
const stopCronJobs = () => {
    hourlyJob.stop();
    dailyMidnightJob.stop();
    cleanupJob.stop();
    healthCheckJob.stop();
    console.log('Cron jobs stopped');
};

// Expose manual triggers
const triggerStockAndExpiryCheck = async () => {
    return await checkStocks();
};

module.exports = {
    checkStocks,
    startCronJobs,
    stopCronJobs,
    triggerStockAndExpiryCheck,
};
