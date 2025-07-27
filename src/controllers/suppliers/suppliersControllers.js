const Supplier = require("../../models/Supplier/SupplierSchema");

exports.getAllSuppliers = async (req, res) => {
    try {
        const supplier = await Supplier.find().populate('products');

        res.status(200).json({
            success: true,
            count: supplier.length,
            data: supplier
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

        const supplier = await Supplier.findByIdAndDelete(_id);

        if(!supplier) {
            return res.status(400).json({
                success: false,
                message: "No user Found"
            });
        }

        res.status(200).json({
            message: "Supplier deleted successfully",
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

exports.updateSupplier = async(req, res) => {
    try {
        const data = req.body;
        
        if(!data._id) {
            return res.status(400).json({
                success: false,
                message: "No user Found"
            });
        }

        const supplier = await Supplier.findByIdAndUpdate(data._id, data, { new: true });

        if(!supplier) {
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