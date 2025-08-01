const Supplier = require("../../models/Supplier/SupplierSchema");
const TransactionSchema = require("../../models/Transaction/TransactionSchema");

exports.getAllSuppliers = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page - 1) * limit;
        let search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        let query = {};

        if (search) {
            query.$or = [
                { firstname: { $regex: search, $options: 'i' } },
                { middlename: { $regex: search, $options: 'i' } },
                { lastname: { $regex: search, $options: 'i' } },
                { companyName: { $regex: search, $options: 'i' } }
            ];
        }

        const suppliers = await Supplier.find(query)
            .skip(skip)
            .limit(limit)
            .sort({ isActive: -1, created: -1 })
            .lean()

        let totalItems = 0;
        if (req.query?.search !== "") {
            totalItems = suppliers.length
        } else {
            totalItems = await Supplier.countDocuments()
        }

        const suppliersWithLastOrder = await Promise.all(
            suppliers.map(async (supplier) => {
                const lastOrder = await TransactionSchema.findOne({ supplier: supplier._id }, { transactionDate: 1 })
                    .sort({ createdAt: -1 })
                    .lean();

                return {
                    ...supplier,
                    lastOrder: lastOrder || null
                };
            })
        );

        res.status(200).json({
            success: true,
            count: totalItems,
            currentPage: page,
            totalPages: Math.ceil(totalItems / limit),
            data: suppliersWithLastOrder
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

exports.getAllActiveSuppliers = async (req, res) => {
    try {
        
        const suppliers = await Supplier.find({isActive: true})
            .sort({ created: -1 })
            .lean()

        res.status(200).json({
            success: true,
            data: suppliers
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}


exports.addSupplier = async (req, res) => {
    const body = req.body;

    try {
        const supplier = await Supplier.create(body);

        res.status(201).json({
            success: true,
            message: "Supplier added Succesfully!",
            user: supplier
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
}

exports.deleteSupplier = async (req, res) => {
    try {
        const { _id } = req.body;

        if (!_id) {
            return res.status(400).json({
                success: false,
                message: "Missing Id"
            })
        }

        const supplier = await Supplier.findById(_id);

        if (!supplier) {
            return res.status(400).json({
                success: false,
                message: "Supplier Not Found"
            })
        }

        const updatedSupplier = await Supplier.findByIdAndUpdate(_id,
            { isActive: !supplier.isActive },
            { new: true }
        );

        const data = await Supplier.find()
            .sort({ isActive: -1, created: -1 })
            .lean();

        res.status(200).json({
            data,
            count: data.length,
            currentPage: 1,
            totalPages: Math.ceil(data.length / 5),
            message: `Supplier Status changed successfully`,
            user: updatedSupplier,
            success: true
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        })
    }
}

exports.updateSupplier = async (req, res) => {
    try {
        const data = req.body;

        if (!data._id) {
            return res.status(400).json({
                success: false,
                message: "No user Found"
            });
        }

        const supplier = await Supplier.findByIdAndUpdate(data._id, data, { new: true });

        if (!supplier) {
            return res.status(400).json({
                success: false,
                message: "No user Found"
            });
        }

        res.status(200).json({
            message: "Supplier updated successfully",
            user: supplier,
            success: true
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        })
    }
}