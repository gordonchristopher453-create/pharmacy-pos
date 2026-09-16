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
    return successResponse(res, 201, 'Product created successfully', product);
  } catch (error) {
    logger.error('Create product error:', error.message, error.stack);
    if (error.code === '23505') {
      const constraint = (error.constraint || '').toLowerCase();
      const detail = (error.detail || '').toLowerCase();
      if (constraint.includes('barcode') || detail.includes('barcode')) {
        return errorResponse(res, 400, `Barcode "${req.body.barcode || ''}" already exists in this facility.`);
      }
      if (constraint.includes('name') || detail.includes('name')) {
        return errorResponse(res, 400, `A product named "${req.body.name || ''}" already exists in this facility.`);
      }
      return errorResponse(res, 400, 'A product with matching details already exists in this facility.');
    }
    return errorResponse(res, 500, 'Failed to create product: ' + error.message);
  }
};

const updateProduct = async (req, res) => {
  try {
    const product = await ProductModel.update(req.params.id, req.pharmacy_id, req.body);
    if (!product) return errorResponse(res, 404, 'Product not found');
    return successResponse(res, 200, 'Product updated successfully', product);
  } catch (error) {
    logger.error('Update product error:', error.message);
    if (error.code === '23505') {
      const constraint = (error.constraint || '').toLowerCase();
      const detail = (error.detail || '').toLowerCase();
      if (constraint.includes('barcode') || detail.includes('barcode')) {
        return errorResponse(res, 400, `Barcode "${req.body.barcode || ''}" already exists in this facility.`);
      }
      if (constraint.includes('name') || detail.includes('name')) {
        return errorResponse(res, 400, `A product named "${req.body.name || ''}" already exists in this facility.`);
      }
      return errorResponse(res, 400, 'A product with matching details already exists in this facility.');
    }
    return errorResponse(res, 500, 'Failed to update product: ' + error.message);
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
      product_id,
      quantity: parseInt(quantity, 10),
      batch_number: batch_number || null,
      expiry_date: expiry_date || null,
      pharmacy_id: req.pharmacy_id,
      department: product.department || 'pharmacy'
    });
    await StockModel.logMovement({
      product_id, user_id: req.user.id,
      movement_type: 'purchase',
      quantity: parseInt(quantity, 10),
      reference_id: stock?.id || null,
      notes: `Stock added. Batch: ${batch_number || 'N/A'}`,
      pharmacy_id: req.pharmacy_id
    });
    return successResponse(res, 201, 'Stock added successfully', stock);
  } catch (error) {
    logger.error('Add stock error:', error.message);
    return errorResponse(res, 500, 'Failed to add stock: ' + error.message);
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
