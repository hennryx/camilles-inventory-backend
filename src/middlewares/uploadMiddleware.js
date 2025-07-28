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

// Multer storage (temporary local storage)
const storage = multer.diskStorage({
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

// File filter for images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Not an image! Please upload only images.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter,
});

// Middleware to upload to Cloudinary
const uploadToCloudinary = async (req, res, next) => {
  if (!req.file) {
    // Allow no image upload (optional product image)
    req.image = null;
    return next();
  }
  try {
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'mern_app/products',
      public_id: `product-${req.file.filename.split('.')[0]}`,
    });

    // Clean up temporary file
    fs.unlinkSync(req.file.path);

    // Attach image data to request
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
  uploadProductImage: upload.single('image'),
  uploadMiddleware: [upload.single('image'), uploadToCloudinary], // Combine middlewares
};