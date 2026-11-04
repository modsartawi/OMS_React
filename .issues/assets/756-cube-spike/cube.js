// Ticket 756. The mssql driver has no env var for trustServerCertificate, and the
// constructor's `...config` REPLACES `options` wholesale — so encrypt and useUTC are
// restated here or they are lost. SPIKE_TRUST_CERT=0 reproduces the env-only failure.
const MSSqlDriver = require('@cubejs-backend/mssql-driver');

module.exports = {
  driverFactory: () => {
    if (process.env.SPIKE_TRUST_CERT === '0') return new MSSqlDriver();
    return new MSSqlDriver({
      options: { encrypt: true, trustServerCertificate: true, useUTC: true },
    });
  },
};
