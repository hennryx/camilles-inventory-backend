exports.generateBatchNumber = (productId, purchaseDate = new Date(), sequence = 1) => {
    const productCode = productId.toString().slice(-4);
    const dateString = purchaseDate.toISOString().slice(0, 10).replace(/-/g, '');
    const sequenceStr = sequence.toString().padStart(3, '0');
    
    return `${productCode}-${dateString}-${sequenceStr}`;
};
 
exports.parseBatchNumber = (batchNumber) => {
    const parts = batchNumber.split('-');
    if (parts.length !== 3) {
        throw new Error('Invalid batch number format');
    }
    
    const productCode = parts[0];
    
    const year = parseInt(parts[1].substring(0, 4));
    const month = parseInt(parts[1].substring(4, 6)) - 1;  
    const day = parseInt(parts[1].substring(6, 8));
    const date = new Date(year, month, day);
    
    const sequence = parseInt(parts[2]);
    
    return {
        productCode,
        date,
        sequence
    };
};