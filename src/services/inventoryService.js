/* const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const mongoose = require('mongoose'); 

exports.processPurchase = async (purchaseId) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const purchase = await Purchase.findById(purchaseId).session(session);
        
        if (!purchase) {
            throw new Error('Purchase not found');
        }
        
        if (purchase.status === 'processed') {
            throw new Error('This purchase has already been processed');
        }
        
        for (const item of purchase.items) {
            const product = await Product.findById(item.product).session(session);
            
            if (!product) {
                throw new Error(`Product with ID ${item.product} not found`);
            }
            
            product.batches.push({
                batchNumber: item.batchNumber,
                quantity: item.quantity,
                expiryDate: item.expiryDate,
                purchaseDate: purchase.purchaseDate,
                pricePerUnit: item.pricePerUnit,
                purchaseId: purchase._id
            });
            
            await product.save({ session });
        }
        
        purchase.status = 'processed';
        await purchase.save({ session });
        
        await session.commitTransaction();
        session.endSession();
        
        return { success: true, message: 'Purchase processed successfully' };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};
 
exports.getProductInventory = async (productId) => {
    const product = await Product.findById(productId);
    
    if (!product) {
        throw new Error('Product not found');
    }
    
    const sortedBatches = product.getBatchesByFefo();
    
    return {
        product: {
            _id: product._id,
            productName: product.productName,
            totalInStock: product.inStock,
            minStock: product.minStock,
            unit: product.unit,
            unitSize: product.unitSize,
            sellingPrice: product.sellingPrice
        },
        batches: sortedBatches
    };
};
 
exports.reduceInventory = async (productId, quantity) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const product = await Product.findById(productId).session(session);
        
        if (!product) {
            throw new Error('Product not found');
        }
        
        if (product.inStock < quantity) {
            throw new Error('Not enough inventory available');
        }
        
        const sortedBatches = product.getBatchesByFefo();
        
        let remainingQuantity = quantity;
        const batchesUsed = [];
        
        for (const batch of sortedBatches) {
            if (remainingQuantity <= 0) break;
            
            if (batch.quantity > 0) {
                const quantityToDeduct = Math.min(batch.quantity, remainingQuantity);
                
                batch.quantity -= quantityToDeduct;
                remainingQuantity -= quantityToDeduct;
                
                batchesUsed.push({
                    batchNumber: batch.batchNumber,
                    quantityUsed: quantityToDeduct,
                    expiryDate: batch.expiryDate
                });
                
                if (batch.quantity === 0) {
                    product.batches = product.batches.filter(b => 
                        b.batchNumber !== batch.batchNumber || 
                        !b.expiryDate.equals(batch.expiryDate)
                    );
                }
            }
        }
        
        await product.save({ session });
        
        await session.commitTransaction();
        session.endSession();
        
        return { 
            success: true, 
            message: 'Inventory updated successfully',
            batchesUsed: batchesUsed
        };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};
 
exports.getLowStockProducts = async () => {
    const products = await Product.find();
    
    const lowStockProducts = products.filter(product => 
        product.inStock < product.minStock
    );
    
    return lowStockProducts;
};
 
exports.getProductsNearingExpiry = async (daysThreshold = 30) => {
    const products = await Product.find();
    const currentDate = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(currentDate.getDate() + daysThreshold);
    
    const productsWithExpiringBatches = [];
    
    for (const product of products) {
        const expiringBatches = product.batches.filter(batch => 
            batch.expiryDate <= thresholdDate && 
            batch.expiryDate >= currentDate
        );
        
        if (expiringBatches.length > 0) {
            productsWithExpiringBatches.push({
                product: {
                    _id: product._id,
                    productName: product.productName
                },
                expiringBatches: expiringBatches
            });
        }
    }
    
    return productsWithExpiringBatches;
}; */

exports.getStocksInfo = async (allProducts) => {
    const minimumStock = allProducts.filter(p => p.totalStock <= 10 && p.totalStock > 0).length;
    const outStock = allProducts.filter(p => p.totalStock === 0).length;
    const totalNumberItems = allProducts.length;

    return {
        minimumStock,
        outStock,
        totalNumberItems
    }
}