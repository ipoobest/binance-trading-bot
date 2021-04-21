const moment = require('moment');
const _ = require('lodash');

const { cache } = require('../../../helpers');
const {
  getAndCacheOpenOrdersForSymbol,
  getAccountInfoFromAPI
} = require('../../trailingTradeHelper/common');

/**
 * Retrieve last buy order from cache
 *
 * @param {*} logger
 * @param {*} symbol
 * @returns
 */
const getLastBuyOrder = async (logger, symbol) => {
  const cachedLastBuyOrder =
    JSON.parse(await cache.get(`${symbol}-last-buy-order`)) || {};

  logger.info({ cachedLastBuyOrder }, 'Retrieved last buy order from cache');

  return cachedLastBuyOrder;
};

/**
 * Remove last buy order from cache
 *
 * @param {*} logger
 * @param {*} symbol
 */
const removeLastBuyOrder = async (logger, symbol) => {
  await cache.del(`${symbol}-last-buy-order`);
  logger.info({ debug: true }, 'Deleted last buy order from cache');
};

/**
 * Set buy action and message
 *
 * @param {*} logger
 * @param {*} rawData
 * @param {*} action
 * @param {*} processMessage
 * @returns
 */
const setBuyActionAndMessage = (logger, rawData, action, processMessage) => {
  const data = rawData;

  logger.info({ data }, processMessage);
  data.action = action;
  data.buy.processMessage = processMessage;
  data.buy.updatedAt = moment().utc();
  return data;
};

/**
 * Retrieve last sell order
 *
 * @param {*} logger
 * @param {*} symbol
 * @returns
 */
const getLastSellOrder = async (logger, symbol) => {
  const cachedLastSellOrder =
    JSON.parse(await cache.get(`${symbol}-last-sell-order`)) || {};

  logger.info({ cachedLastSellOrder }, 'Retrieved last sell order from cache');

  return cachedLastSellOrder;
};

/**
 * Remove last sell order from cache
 *
 * @param {*} logger
 * @param {*} symbol
 */
const removeLastSellOrder = async (logger, symbol) => {
  await cache.del(`${symbol}-last-sell-order`);
  logger.info({ debug: true }, 'Deleted last sell order from cache');
};

/**
 * Set sell action and message
 *
 * @param {*} logger
 * @param {*} rawData
 * @param {*} action
 * @param {*} processMessage
 * @returns
 */
const setSellActionAndMessage = (logger, rawData, action, processMessage) => {
  const data = rawData;

  logger.info({ data }, processMessage);
  data.action = action;
  data.sell.processMessage = processMessage;
  data.sell.updatedAt = moment().utc();
  return data;
};

/**
 * Check whether the order existing in the open orders
 *
 * @param {*} _logger
 * @param {*} order
 * @param {*} openOrders
 * @returns
 */
const isOrderExistingInOpenOrders = (_logger, order, openOrders) =>
  _.findIndex(openOrders, o => o.orderId === order.orderId) !== -1;

/**
 * Ensure order is placed
 *
 * @param {*} logger
 * @param {*} rawData
 */
const execute = async (logger, rawData) => {
  const data = rawData;

  const { symbol } = data;

  // Ensure buy order placed
  const lastBuyOrder = await getLastBuyOrder(logger, symbol);
  if (_.isEmpty(lastBuyOrder) === false) {
    logger.info({ debug: true, lastBuyOrder }, 'Last buy order found');

    // Refresh open orders
    const openOrders = await getAndCacheOpenOrdersForSymbol(logger, symbol);

    // Assume open order is not executed, make sure the order is in the open orders.
    // If executed that is ok, after some seconds later, the cached last order will be expired anyway and sell.
    if (isOrderExistingInOpenOrders(logger, lastBuyOrder, openOrders)) {
      logger.info(
        { debug: true },
        'Order is existing in the open orders. All good, remove last buy order.'
      );
      // Remove last buy order from cache
      await removeLastBuyOrder(logger, symbol);

      data.openOrders = openOrders;

      data.buy.openOrders = data.openOrders.filter(
        o => o.side.toLowerCase() === 'buy'
      );

      // Get account info
      data.accountInfo = await getAccountInfoFromAPI(logger);
    } else {
      logger.info(
        { debug: true },
        'Order does not exist in the open orders. Wait until it appears.'
      );
      return setBuyActionAndMessage(
        logger,
        data,
        'buy-order-checking',
        'The buy order seems placed; however, it does not appear in the open orders. ' +
          'Wait for the buy order to appear in open orders.'
      );
    }
  }

  // Ensure sell order placed
  const lastSellOrder = await getLastSellOrder(logger, symbol);
  if (_.isEmpty(lastSellOrder) === false) {
    logger.info({ debug: true, lastSellOrder }, 'Last sell order found');

    // Refresh open orders
    const openOrders = await getAndCacheOpenOrdersForSymbol(logger, symbol);

    // Assume open order is not executed, make sure the order is in the open orders.
    // If executed that is ok, after some seconds later, the cached last order will be expired anyway and sell.
    if (isOrderExistingInOpenOrders(logger, lastSellOrder, openOrders)) {
      logger.info(
        { debug: true },
        'Order is existing in the open orders. All good, remove last sell order.'
      );
      // Remove last sell order from cache
      await removeLastSellOrder(logger, symbol);
      data.openOrders = openOrders;

      data.sell.openOrders = data.openOrders.filter(
        o => o.side.toLowerCase() === 'sell'
      );

      // Get account info
      data.accountInfo = await getAccountInfoFromAPI(logger);
    } else {
      logger.info(
        { debug: true },
        'Order does not exist in the open orders. Wait until it appears.'
      );
      return setSellActionAndMessage(
        logger,
        data,
        'sell-order-checking',
        'The sell order seems placed; however, it does not appear in the open orders. ' +
          'Wait for the sell order to appear in open orders.'
      );
    }
  }

  return data;
};

module.exports = { execute };