exports.up = (pgm) => {
  pgm.createExtension("pgcrypto", { ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropExtension("pgcrypto", { ifExists: true });
};
