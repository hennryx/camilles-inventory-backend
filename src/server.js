const express = require('express');
require('dotenv').config();
const path = require('path')
const app = express();
const routes = require('./routes');

const cors = require('cors');
const cookieParser = require('cookie-parser')

const connectDB = require('./config/db')
connectDB()
    .then(() => {
        const corsConfig = {
            origin: 'http://localhost:5173',
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

        app.use('/', routes);

        const port = process.env.PORT || 5000;
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });

    }).catch((err) => {
        console.log(err);
    });
