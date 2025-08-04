const VoucherSchema = require("../../models/Vouchers/VoucherSchema");

exports.createVoucher = async (req, res) => {
    try {
        const data = req.body;

        await VoucherSchema.create(data)
        res.status(200).json({
            data,
            success: true,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
}

exports.getVouchers = async (req, res) => {
    try {
        const data = await VoucherSchema.find()

        res.send(200).json({
            data,
            success: true
        })
    } catch (error) {
        res.send(500).json({
            success: false,
            message: err.message
        })
    }
}