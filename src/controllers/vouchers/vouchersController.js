const VoucherSchema = require("../../models/Vouchers/VoucherSchema");

exports.createVoucher = async (req, res) => {
    try {
        const data = req.body;

        await VoucherSchema.create(data);
        const allData = await VoucherSchema.find();

        res.status(200).json({
            data: allData,
            success: true,
            message: "Successfully added Voucher"
        });

    } catch (error) {
        console.error(error.message)
        res.status(500).json({
            success: false,
            message: "Something went wrong"
        })
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
                { voucherName: { $regex: search, $options: 'i' } }
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
            totalPages: Math.ceil(data.length / limit),
            success: true
        })
    } catch (error) {
        console.error(error.message)
        res.status(500).json({
            success: false,
            message: "Something went wrong"
        })
    }
}

exports.updateVouchers = async (req, res) => {
    try {
        const { data, page = 1, limit = 5 } = req.body;
        
        if(!data._id) {
            res.status(200).json({
                success: false,
                message: "Missing id"
            })
        }
        const updatedVoucher = await VoucherSchema.findByIdAndUpdate(data._id, data, {new: true})

        if (!updatedVoucher) {
            return res.status(404).json({
                success: false,
                message: "Voucher not found"
            });
        }

        const dataCount = await VoucherSchema.countDocuments();

        res.status(200).json({
            success: true,
            data: updatedVoucher,
            count: dataCount.length,
            currentPage: page,
            totalPages: Math.ceil(dataCount.length / limit),
            message: "Successfully Updated voucher"
        })  

    } catch (error) {
        console.error(error.message)
        res.status(500).json({
            success: false,
            message: "Something went wrong"
        })
    }
}

exports.deleteVouchers = async (req, res) => {
    try {
        const { _id, page = 1, limit = 5 } = req.body;
        if(!_id) {
            res.status(200).json({
                success: false,
                message: "Missing id"
            })
        }
        const deletedData = await VoucherSchema.findByIdAndDelete(_id);

        if (!deletedData) {
            return res.status(404).json({
                success: false,
                message: "Voucher not found"
            });
        }

        const dataCount = await VoucherSchema.countDocuments()

        res.status(200).json({
            success: true,
            data: deletedData,
            count: dataCount.length,
            currentPage: page,
            totalPages: Math.ceil(dataCount.length / limit),
            message: "Successfully Deleted voucher"
        })
    } catch (error) {
        console.error(error.message)
        res.status(500).json({
            success: false,
            message: "Something went wrong"
        })
    }
}