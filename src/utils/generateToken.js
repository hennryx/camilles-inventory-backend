const jwt = require('jsonwebtoken')
const generateToken = (res, userId) => {
    try {
        const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
            expiresIn: "1d"
        });
    
        res.cookie('jwt', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV !== 'development',
            sameSite: 'strict',
            maxAge: 1 * 24 * 60 * 60 * 1000
        });
    
        return token
    } catch (error) {
        console.log(error);
    }
}

module.exports = generateToken;