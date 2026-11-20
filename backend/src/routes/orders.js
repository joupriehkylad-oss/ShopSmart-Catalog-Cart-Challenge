import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { orderSchema } from '../validators/schemas.js';
import {
  requireAuth,
  requireTrustedOrigin
} from './auth.js';

const router = Router();

// Prevent caching of private order information
router.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  next();
});

// All order endpoints require authentication
router.use(requireAuth);

// Standard error response
function sendError(response, status, code, message) {
  return response.status(status).json({
    error: { code, message }
  });
}

// Convert Prisma Decimal values to numbers
function serializeOrder(order) {
  return {
    ...order,
    total: Number(order.total),
    items: order.items.map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice)
    }))
  };
}

// GET ALL ORDERS OWNED BY CURRENT CUSTOMER
router.get('/', async (request, response, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        userId: request.user.id
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                emoji: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    response.json({
      orders: orders.map(serializeOrder)
    });

  } catch (error) {
    next(error);
  }
});

// GET A SPECIFIC ORDER
router.get('/:id', async (request, response, next) => {
  try {
    const orderId = Number(request.params.id);

    if (
      !Number.isInteger(orderId) ||
      orderId <= 0 ||
      orderId > 2147483647
    ) {
      return sendError(
        response,
        400,
        'INVALID_ORDER_ID',
        'Invalid order ID.'
      );
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: request.user.id
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                emoji: true
              }
            }
          }
        }
      }
    });

    if (!order) {
      return sendError(
        response,
        404,
        'ORDER_NOT_FOUND',
        'Order could not be found.'
      );
    }

    response.json(serializeOrder(order));

  } catch (error) {
    next(error);
  }
});

// CREATE A NEW ORDER
router.post(
  '/',
  requireTrustedOrigin,
  async (request, response, next) => {
    try {
      // Use the authenticated customer's email
      const parsed = orderSchema.safeParse({
        ...request.body,
        email: request.user.email
      });

      if (!parsed.success) {
        return response.status(422).json({
          error: {
            code: 'INVALID_ORDER',
            message: 'Check the customer and cart information.',
            details: parsed.error.flatten()
          }
        });
      }

      const productIds = [
        ...new Set(
          parsed.data.items.map((item) => item.productId)
        )
      ];

      // Process the order in a database transaction
      const order = await prisma.$transaction(
        async (transaction) => {

          const products = await transaction.product.findMany({
            where: {
              id: { in: productIds },
              active: true
            }
          });

          if (products.length !== productIds.length) {
            throw Object.assign(
              new Error('One or more products are unavailable.'),
              {
                status: 422,
                code: 'PRODUCT_UNAVAILABLE'
              }
            );
          }

          const productMap = new Map(
            products.map((product) => [
              product.id,
              product
            ])
          );

          const normalizedItems = parsed.data.items
            .map((item) => ({
              ...item,
              product: productMap.get(item.productId)
            }))
            .sort((a, b) => a.productId - b.productId);

          // Check available stock
          for (const item of normalizedItems) {
            if (item.quantity > item.product.stock) {
              throw Object.assign(
                new Error(
                  `Only ${item.product.stock} unit(s) of ${item.product.name} are available.`
                ),
                {
                  status: 409,
                  code: 'INSUFFICIENT_STOCK'
                }
              );
            }
          }

          // Calculate total using database prices
          const total = normalizedItems.reduce(
            (sum, item) =>
              sum.plus(
                new Prisma.Decimal(item.product.price)
                  .times(item.quantity)
              ),
            new Prisma.Decimal(0)
          );

          // Deduct purchased quantities
          for (const item of normalizedItems) {
            const updated = await transaction.product.updateMany({
              where: {
                id: item.productId,
                active: true,
                stock: {
                  gte: item.quantity
                }
              },
              data: {
                stock: {
                  decrement: item.quantity
                }
              }
            });

            if (updated.count !== 1) {
              throw Object.assign(
                new Error('Stock changed while placing the order.'),
                {
                  status: 409,
                  code: 'STOCK_CHANGED'
                }
              );
            }
          }

          // Save order with authenticated ownership
          return transaction.order.create({
            data: {
              userId: request.user.id,
              customerName: parsed.data.customerName,
              email: request.user.email,
              address: parsed.data.address,
              total,

              items: {
                create: normalizedItems.map((item) => ({
                  productId: item.productId,
                  quantity: item.quantity,
                  unitPrice: item.product.price
                }))
              }
            },
            include: {
              items: true
            }
          });
        }
      );

      response.status(201).json(
        serializeOrder(order)
      );

    } catch (error) {
      next(error);
    }
  }
);

export default router;