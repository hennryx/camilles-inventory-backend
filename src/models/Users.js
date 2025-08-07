const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    firstname: {
        type: String,
        required: [true, 'Please add a name'],
        trim: true
    },

    middlename: {
        type: String,
        trim: true
    },

    lastname: {
        type: String,
        required: [true, 'Please add a lastname'],
        trim: true
    },

    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: [true, "This email already exist!"],
        match: [
            /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email'
        ]
    },

    password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: 6,
        select: false
    },

    role: {
        type: String,
        enum: ['ADMIN', 'STAFF', 'CUSTOMER'],
        default: 'STAFF'
    },

    profileImage: {
        name: String,
        url: String,
        cloudinary_id: String,
    },

    resetPasswordToken: String,
    resetPasswordExpire: Date,

    addresses: [{
        street: String,
        city: String,
        state: String,
        postalCode: String,
        country: String,
        isDefault: {
            type: Boolean,
            default: false
        }
    }],

    createdAt: {
        type: Date,
        default: Date.now
    }
});

UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        next();
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Users', UserSchema);