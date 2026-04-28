const { CartItem, Product } = require('../models');
const { errorResponse } = require('../utils/helpers');

const toPositiveInteger = (value, defaultValue = 1) => {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    return defaultValue;
  }
  return num;
};

const normalizeSpecText = (value) => {
  const text = String(value || '').trim();
  return text ? text.slice(0, 100) : '';
};

const buildCartPayload = (cartItems = []) => {
  const normalizedItems = cartItems.map((item) => {
    const price = Number(item.price || 0);
    const quantity = Number(item.quantity || 0);
    const specText = normalizeSpecText(item.selected_spec);

    return {
      商品ID: Number(item.food_id),
      商品名称: item.food_name || '',
      价格: price,
      数量: quantity,
      selected_spec: specText || '',
      规格: specText || '',
      商家ID: item.merchant_id ? Number(item.merchant_id) : null
    };
  });

  const totalPrice = normalizedItems.reduce((sum, item) => sum + Number(item.价格 || 0) * Number(item.数量 || 0), 0);
  const totalCount = normalizedItems.reduce((sum, item) => sum + Number(item.数量 || 0), 0);

  return {
    code: 200,
    message: 'success',
    购物车: normalizedItems,
    总价: Number(totalPrice.toFixed(2)),
    总数量: totalCount
  };
};

const getUserCartItems = async (userId) => {
  return CartItem.findAll({
    where: { user_id: userId },
    order: [['updated_at', 'DESC'], ['id', 'DESC']]
  });
};

exports.getCartList = async (req, res, next) => {
  try {
    const cartItems = await getUserCartItems(req.user.id);
    res.json(buildCartPayload(cartItems));
  } catch (error) {
    next(error);
  }
};

exports.addToCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const productId = Number(req.body?.productId || req.body?.product_id || req.body?.foodId || req.body?.food_id);
    const quantity = toPositiveInteger(req.body?.quantity, 1);
    const selectedSpec = normalizeSpecText(req.body?.selected_spec || req.body?.selectedSpec || req.body?.spec);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json(errorResponse('商品ID不正确'));
    }

    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json(errorResponse('商品不存在'));
    }

    if (Number(product.status) !== 1) {
      return res.status(400).json(errorResponse('商品已下架'));
    }

    const where = {
      user_id: userId,
      food_id: product.id,
      selected_spec: selectedSpec || null
    };

    let cartItem = await CartItem.findOne({ where });
    if (cartItem) {
      await cartItem.update({
        quantity: Number(cartItem.quantity || 0) + quantity,
        food_name: product.name,
        price: Number(product.price || 0),
        merchant_id: product.merchant_id || null,
        selected_spec: selectedSpec || null
      });
    } else {
      cartItem = await CartItem.create({
        user_id: userId,
        merchant_id: product.merchant_id || null,
        food_id: product.id,
        food_name: product.name,
        price: Number(product.price || 0),
        quantity,
        selected_spec: selectedSpec || null
      });
    }

    const cartItems = await getUserCartItems(userId);
    res.json({
      ...buildCartPayload(cartItems),
      message: '加入购物车成功'
    });
  } catch (error) {
    next(error);
  }
};

exports.removeFromCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const productId = Number(req.body?.productId || req.body?.product_id || req.body?.foodId || req.body?.food_id);
    const removeQuantity = toPositiveInteger(req.body?.quantity, 1);
    const selectedSpec = normalizeSpecText(req.body?.selected_spec || req.body?.selectedSpec || req.body?.spec);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json(errorResponse('商品ID不正确'));
    }

    const candidateWhere = {
      user_id: userId,
      food_id: productId
    };
    if (selectedSpec) {
      candidateWhere.selected_spec = selectedSpec;
    }

    let cartItem = await CartItem.findOne({
      where: candidateWhere,
      order: [['id', 'DESC']]
    });

    if (!cartItem && !selectedSpec) {
      return res.status(404).json(errorResponse('购物车商品不存在'));
    }

    if (!cartItem && selectedSpec) {
      cartItem = await CartItem.findOne({
        where: {
          user_id: userId,
          food_id: productId,
          selected_spec: null
        }
      });
    }

    if (!cartItem) {
      return res.status(404).json(errorResponse('购物车商品不存在'));
    }

    const nextQuantity = Number(cartItem.quantity || 0) - removeQuantity;
    if (nextQuantity > 0) {
      await cartItem.update({ quantity: nextQuantity });
    } else {
      await cartItem.destroy();
    }

    const cartItems = await getUserCartItems(userId);
    res.json({
      ...buildCartPayload(cartItems),
      message: '购物车已更新'
    });
  } catch (error) {
    next(error);
  }
};

exports.clearCart = async (req, res, next) => {
  try {
    await CartItem.destroy({
      where: { user_id: req.user.id }
    });

    res.json({
      code: 200,
      message: '购物车已清空',
      购物车: [],
      总价: 0,
      总数量: 0
    });
  } catch (error) {
    next(error);
  }
};
