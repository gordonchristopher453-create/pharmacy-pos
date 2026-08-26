const ProductModel = require('../models/product.model');
const StockModel = require('../models/stock.model');
const CategoryModel = require('../models/category.model');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

const getProducts = async (req, res) => {
  try {
    const { search, category_id, low_stock, department } = req.query;
    const products = await ProductModel.findAll({
      search, category_id,
      low_stock: low_stock === 'true',
      pharmacy_id: req.pharmacy_id,
      department: department || null
    });
    return successResponse(res, 200, 'Products fetched', products);
  } catch (error) {
    logger.error('Get products error:', error.message, JSON.stringify(error));
    return errorResponse(res, 500, 'Failed to fetch products: ' + error.message);
  }
};

const getByBarcode = async (req, res) => {
  try {
    const product = await ProductModel.findByBarcode(req.params.barcode, req.pharmacy_id);
    if (!product) return errorResponse(res, 404, 'Product not found');
    return successResponse(res, 200, 'Product fetched', product);
  } catch (error) {
    logger.error('Get by barcode error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch product');
  }
};

const getProduct = async (req, res) => {
  try {
    const product = await ProductModel.findById(req.params.id, req.pharmacy_id);
    if (!product) return errorResponse(res, 404, 'Product not found');
    return successResponse(res, 200, 'Product fetched', product);
  } catch (error) {
    logger.error('Get product error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch product');
  }
};

const createProduct = async (req, res) => {
  try {
    logger.info(`Creating product: ${JSON.stringify(req.body)} pharmacy_id: ${req.pharmacy_id}`);
    const product = await ProductModel.create({ ...req.body, pharmacy_id: req.pharmacy_id });
    logger.info(`Product created: ${product.name}`);
    return successResponse(res, 201, 'Product created', product);
  } catch (error) {
    logger.error('Create product error:', error.message, error.stack);
    if (error.code === '23505') return errorResponse(res, 400, 'Barcode already exists');
    return errorResponse(res, 500, 'Failed to create product: ' + error.message);
  }
};

const updateProduct = async (req, res) => {
  try {
    const product = await ProductModel.update(req.params.id, req.pharmacy_id, req.body);
    if (!product) return errorResponse(res, 404, 'Product not found');
    return successResponse(res, 200, 'Product updated', product);
  } catch (error) {
    logger.error('Update product error:', error.message);
    return errorResponse(res, 500, 'Failed to update product');
  }
};

const deleteProduct = async (req, res) => {
  try {
    const product = await ProductModel.delete(req.params.id, req.pharmacy_id);
    if (!product) return errorResponse(res, 404, 'Product not found');
    return successResponse(res, 200, 'Product deleted successfully', product);
  } catch (error) {
    logger.error('Delete product error:', error.message);
    return errorResponse(res, 500, 'Failed to delete product: ' + error.message);
  }
};

const addStock = async (req, res) => {
  try {
    const { quantity, batch_number, expiry_date } = req.body;
    const product_id = req.params.id;
    const product = await ProductModel.findById(product_id, req.pharmacy_id);
    if (!product) return errorResponse(res, 404, 'Product not found');

    const stock = await StockModel.addStock({
      product_id, quantity, batch_number, expiry_date,
      pharmacy_id: req.pharmacy_id
    });
    await StockModel.logMovement({
      product_id, user_id: req.user.id,
      movement_type: 'purchase', quantity,
      reference_id: stock.id,
      notes: `Stock added. Batch: ${batch_number || 'N/A'}`,
      pharmacy_id: req.pharmacy_id
    });
    return successResponse(res, 201, 'Stock added', stock);
  } catch (error) {
    logger.error('Add stock error:', error.message);
    return errorResponse(res, 500, 'Failed to add stock');
  }
};

const getExpiring = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const stock = await StockModel.getExpiring(days, req.pharmacy_id);
    return successResponse(res, 200, 'Expiring stock fetched', stock);
  } catch (error) {
    logger.error('Get expiring error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch expiring stock');
  }
};

const getCategories = async (req, res) => {
  try {
    const categories = await CategoryModel.findAll(req.pharmacy_id);
    return successResponse(res, 200, 'Categories fetched', categories);
  } catch (error) {
    logger.error('Get categories error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch categories');
  }
};

const createCategory = async (req, res) => {
  try {
    const category = await CategoryModel.create({ ...req.body, pharmacy_id: req.pharmacy_id });
    return successResponse(res, 201, 'Category created', category);
  } catch (error) {
    logger.error('Create category error:', error.message);
    return errorResponse(res, 500, 'Failed to create category');
  }
};

module.exports = {
  getProducts, getByBarcode, getProduct, createProduct,
  updateProduct, deleteProduct, addStock, getExpiring, getCategories, createCategory
};
