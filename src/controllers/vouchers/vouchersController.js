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
        const limit = Number(req.query.limit) || 5;
        const page = Number(req.query.page) || 1;
        const skip = (page-1) * limit;
        let search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        
        let query = {}
        if(search !== "") {
            query.$or = [
                { discountName: { $regex: search, $options: 'i' } }
            ]
        }
        
        const data = await VoucherSchema.find(query)
        .skip(skip)
        .limit(limit)
        .sort({createdAt: -1})
        .lean()

        res.status(200).json({
            data,
            count: data.length,    
            currentPage: page,
            toalPages: Math.ceil(data.length / limit),
            success: true
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: err.message
        })
    }
}

exports.updateVouchers = async (req, res) => {
    try {
        const data = req.body;
        if(!data._id) {
            res.status(200).json({
                success: false,
                message: "Missing id"
            })
        }
        const updatedVoucher = await VoucherSchema.findByIdAndUpdate(data._id, data, {new: true})

        res.status(200).json({
            data: updatedVoucher,
            success: true
        })  
    } catch (error) {
        res.status(500).json({
            success: false,
            message: err.message
        })
    }
}

exports.deleteVouchers = async (req, res) => {
    try {
        const { _id } = req.body;
        if(!_id) {
            res.status(200).json({
                success: false,
                message: "Missing id"
            })
        }
        
        await VoucherSchema.findByIdAndDelete(_id)

        const data = await VoucherSchema.find();

        res.status(200).json({
            data,
            success: true
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: err.message
        })
    }
}