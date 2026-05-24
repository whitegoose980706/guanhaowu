const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data', 'products.json');

// Ensure directories exist
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
    } catch (err) {
      console.error(`Failed to create directory ${dirPath}:`, err);
    }
  }
};

ensureDir(path.join(__dirname, 'data'));
ensureDir(path.join(__dirname, 'public', 'uploads'));

// Helper to read products
const readProducts = () => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return [];
    }
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading products file:', err);
    return [];
  }
};

// Helper to write products
const writeProducts = (products) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing products file:', err);
    return false;
  }
};

// Setup multer for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'public', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Hardcoded admin password
const ADMIN_PASSWORD = 'GuanHaoWu2026!#';

// Auth verification middleware
const checkAdminAuth = (req, res, next) => {
  const password = req.headers['x-admin-password'];
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized: Invalid admin password' });
  }
  next();
};

// APIs

// 0. Verify admin password
app.post('/api/auth/verify', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Unauthorized: Invalid admin password' });
  }
});

// 1. Get all products
app.get('/api/products', (req, res) => {
  const products = readProducts();
  res.json(products);
});

// 2. Get single product
app.get('/api/products/:id', (req, res) => {
  const products = readProducts();
  const product = products.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
});

// 3. Create product
app.post('/api/products', checkAdminAuth, (req, res) => {
  const { name, price, short_desc, long_desc, main_image, gallery_images } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ error: 'Name and price are required' });
  }

  const products = readProducts();
  const newProduct = {
    id: 'prod_' + Date.now() + Math.floor(Math.random() * 1000),
    name: String(name),
    price: Number(price),
    short_desc: String(short_desc || ''),
    long_desc: String(long_desc || ''),
    main_image: String(main_image || '/uploads/placeholder.png'),
    gallery_images: Array.isArray(gallery_images) ? gallery_images.map(String) : [String(main_image || '/uploads/placeholder.png')]
  };

  products.push(newProduct);
  if (writeProducts(products)) {
    res.status(201).json({ success: true, data: newProduct });
  } else {
    res.status(500).json({ error: 'Failed to write data' });
  }
});

// 4. Update product
app.put('/api/products/:id', checkAdminAuth, (req, res) => {
  const products = readProducts();
  const index = products.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const { name, price, short_desc, long_desc, main_image, gallery_images } = req.body;
  
  const updatedProduct = {
    ...products[index],
    ...(name !== undefined && { name: String(name) }),
    ...(price !== undefined && { price: Number(price) }),
    ...(short_desc !== undefined && { short_desc: String(short_desc) }),
    ...(long_desc !== undefined && { long_desc: String(long_desc) }),
    ...(main_image !== undefined && { main_image: String(main_image) }),
    ...(gallery_images !== undefined && { gallery_images: Array.isArray(gallery_images) ? gallery_images.map(String) : [String(main_image)] })
  };

  products[index] = updatedProduct;
  if (writeProducts(products)) {
    res.json({ success: true, data: updatedProduct });
  } else {
    res.status(500).json({ error: 'Failed to write data' });
  }
});

// 5. Delete product
app.delete('/api/products/:id', checkAdminAuth, (req, res) => {
  const products = readProducts();
  const filtered = products.filter(p => p.id !== req.params.id);
  
  if (products.length === filtered.length) {
    return res.status(404).json({ error: 'Product not found' });
  }

  if (writeProducts(filtered)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to write data' });
  }
});

// 6. Upload image
app.post('/api/upload', checkAdminAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('File upload error:', err);
      return res.status(500).json({ error: 'File upload failed: ' + err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const relativePath = `/uploads/${req.file.filename}`;
    res.json({ success: true, url: relativePath });
  });
});

// Start listening if not running as a Vercel serverless function
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`- Resident Home: http://localhost:${PORT}`);
    console.log(`- Admin Console: http://localhost:${PORT}/admin.html`);
  });
}

module.exports = app;
