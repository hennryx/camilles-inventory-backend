const Users = require("../models/Users");
const generateToken = require("../utils/generateToken");


exports.login = async (req, res) => {

    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an email and password'
            });
        }

        const user = await Users.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const token = generateToken(res, user._id);

        res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
}

exports.register = async (req, res) => {
    try {
        const data = req.body;
        const user = await Users.create(data);

        const token = generateToken(res, user._id);

        const userData = user.toObject();
        delete userData.password;

        res.status(201).json({
            success: true,
            token,
            user: userData
        });
        
    } catch (err) {
        res.status(400).json({
            success: false,
            message: err.message
        });
    }
}

exports.provideToken = async (req, res) => {
    const user = req.user;
    res.json({
        success: "Validation Success",
        data: user,
    });
}

exports.logout = async (req, res) => {
    res.cookie('jwt', '', {
        httpOnly: true,
        expires: new Date(0),
    })
    res.status(200).json({ message: "User logged out" })
}