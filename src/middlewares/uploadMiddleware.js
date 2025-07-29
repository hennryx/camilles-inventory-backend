const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Common file filter for images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Not an image! Please upload only images.'), false);
  }
};

// Product image storage
const productStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../assets/products');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'product-' + uniqueSuffix + ext);
  },
});

// Profile image storage
const profileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../assets/profiles');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'profile-' + uniqueSuffix + ext);
  },
});

// Multer instances
const uploadProduct = multer({
  storage: productStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB for products
  fileFilter: fileFilter,
});

const uploadProfile = multer({
  storage: profileStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB for profiles
  fileFilter: fileFilter,
});

// Cloudinary upload middleware
const uploadToCloudinary = async (req, res, next) => {
  if (!req.file) {
    req.image = null; // Allow no image upload
    return next();
  }
  try {
    const folder = req.file.path.includes('products') ? 'mern_app/products' : 'mern_app/profiles';
    const publicIdPrefix = req.file.path.includes('products') ? 'product' : 'profile';
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: folder,
      public_id: `${publicIdPrefix}-${req.file.filename.split('.')[0]}`,
    });

    // Clean up temporary file
    fs.unlinkSync(req.file.path);

    // Attach image data
    req.image = {
      name: req.file.originalname,
      url: result.secure_url,
      cloudinary_id: result.public_id,
    };

    next();
  } catch (error) {
    console.error('Cloudinary upload failed:', error);
    res.status(500).json({ success: false, message: 'Image upload failed' });
  }
};

module.exports = {
  uploadProductImage: uploadProduct.single('image'),
  uploadProfileImage: uploadProfile.single('profileImage'),
  uploadMiddleware: [uploadProduct.single('image'), uploadToCloudinary], // For products
  uploadProfileMiddleware: [uploadProfile.single('profileImage'), uploadToCloudinary], // For profiles
};