const Users = require("../../models/Users");
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

exports.getAllStaff = async (req, res) => {
    try {
        const search = req.query?.search ? req.query?.search?.trim() : "";
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 5;
        const skip = (page - 1) * limit;

        let query = { role: 'STAFF' }

        if (search !== "") {
            query.$or = [
                { firstname: { $regex: search, $options: 'i' } },
                { middlename: { $regex: search, $options: 'i' } },
                { lastname: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ]
        }

        const users = await Users.find(query)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({
            success: true,  
            count: users.length,    
            data: users,
            currentPage: page,
            totalPages: Math.ceil(users.length / limit),
            totalUsers: users.length
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
}

exports.updateUser = async (req, res) => {
    try {
        let data = req.body

        if (!data?._id) {
            return res.status(400).json({
                error: "Missing ID",
                message: "No ID provided for updating User"
            });
        }

        if (data.password) {
            const salt = await bcrypt.genSalt(10);
            data.password = await bcrypt.hash(data.password, salt);
        }

        const user = await Users.findByIdAndUpdate(data._id, data, { new: true });
        if (!user) {
            return res.status(404).json({
                error: "Not Found",
                message: "User not found"
            });
        }

        const userData = user.toObject();
        delete userData.password;

        res.status(200).json({
            message: "User Updated successfully",
            user: userData,
            success: true
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

exports.deleteUser = async (req, res) => {
    try {
        const { _id } = req.body;

        if (!_id) {
            return res.status(400).json({
                success: false,
                error: "Missing ID",
                message: "No ID provided for deletion"
            });
        }

        const user = await Users.findByIdAndDelete(_id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: "Not Found",
                message: "User not found"
            });
        }

        const userData = user.toObject();
        delete userData.password;

        res.status(200).json({
            message: "User deleted successfully",
            user: userData,
            success: true
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const { firstname, middlename, lastname, email } = req.body;

        const user = await Users.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        if (firstname) user.firstname = firstname;
        if (middlename !== undefined) user.middlename = middlename;
        if (lastname) user.lastname = lastname;

        if (email && email !== user.email) {
            const existingUser = await Users.findOne({ email });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already in use',
                });
            }
            user.email = email;
        }

        if (req.file && req.image) {
            // Delete old profile image from Cloudinary if it exists
            if (user.profileImage && user.profileImage.cloudinary_id) {
                await cloudinary.uploader.destroy(user.profileImage.cloudinary_id);
            }
            // Update with new Cloudinary data
            user.profileImage = req.image; // From uploadToCloudinary middleware
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                _id: user._id,
                firstname: user.firstname,
                middlename: user.middlename,
                lastname: user.lastname,
                email: user.email,
                role: user.role,
                profileImage: user.profileImage,
            },
        });
    } catch (error) {
        // Clean up temporary file if upload fails
        if (req.file) {
            const tempPath = path.join(__dirname, '../../assets/profiles', req.file.filename);
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        }
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.updatePassword = async (req, res) => {
    try {
        const userId = req.user._id;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide current and new password'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long'
            });
        }

        const user = await Users.findById(userId).select('+password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        user.password = newPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password updated successfully'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};