const mongoose = require('mongoose');

const SupplierSchema = new mongoose.Schema({
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

    contactNumber: {
        type: String,
        required: [true, "Please add a contact number"]
    },

    products: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],

    companyName: {
        type: String,
        required: [true, 'Please add a Company name'],
        trim: true
    },

    companyAddress: {
        zipcode: { type: String }, 
        street: { type: String },
        region: { type: String },
        province: { type: String },
        municipality: { type: String },
        barangay: { type: String },
    },

    isActive: { type: Boolean, default: true },
}, {
    timestamps: true
});

module.exports = mongoose.model('Supplier', SupplierSchema);