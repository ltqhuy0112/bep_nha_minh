exports.up = (pgm) => {
  pgm.dropIndex("orders", "order_code", {
    name: "idx_orders_order_code_unique",
    ifExists: true
  });
};

exports.down = (pgm) => {
  pgm.createIndex("orders", "order_code", {
    name: "idx_orders_order_code_unique",
    unique: true,
    ifNotExists: true
  });
};
