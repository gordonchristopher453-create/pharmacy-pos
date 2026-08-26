const logger = require('../utils/logger');

const initSocket = (io) => {
  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Join a counter room (for multi-counter stock sync)
    socket.on('join_counter', (counterId) => {
      socket.join(`counter_${counterId}`);
      logger.info(`Socket ${socket.id} joined counter_${counterId}`);
    });

    // Broadcast stock update to all counters
    socket.on('stock_update', (data) => {
      io.emit('stock_changed', data);
      logger.info(`Stock update: ${JSON.stringify(data)}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });
};

module.exports = initSocket;
