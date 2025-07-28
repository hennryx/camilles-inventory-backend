const mongoose = require('mongoose');

const SupplierSchema = new mongoose.Schema({
    firstname: {
        type: String,
        required: [true, 'Please add a first name'],
        trim: true
    },
    middlename: {
        type: String,
        trim: true
    },
    lastname: {
        type: String,
        required: [true, 'Please add a last name'],
        trim: true
    },
    contactNumber: {
        type: String,
        required: [true, 'Please add a contact number'],
        match: [/^\+?\d{10,15}$/, 'Please add a valid contact number']
    },
    companyName: {
        type: String,
        required: [true, 'Please add a company name'],
        trim: true
    },
    companyAddress: {
        zipcode: { type: String },
        street: { type: String },
        region: { type: String },
        province: { type: String },
        municipality: { type: String },
        barangay: { type: String }
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Supplier', SupplierSchema);