const sql = require('mssql/msnodesqlv8');

const umDbConfig = {
  server: 'AVINASH\\SQL2017',
  database: 'AVI_IRS_UM',
  driver: 'msnodesqlv8',
  options: {
    trustedConnection: true,
    trustServerCertificate: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

const dataDbConfig = {
  server: 'AVINASH\\SQL2017',
  database: 'AVI_IRS_DATA',
  driver: 'msnodesqlv8',
  options: {
    trustedConnection: true,
    trustServerCertificate: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let umPoolPromise = null;
let dataPoolPromise = null;

async function getPool() {
  if (!umPoolPromise) {
    console.log('? [DB.CJS] Connecting to AVINASH\\SQL2017 -> AVI_IRS_UM...');
    umPoolPromise = new sql.ConnectionPool(umDbConfig)
      .connect()
      .then((pool) => {
        console.log('? [DB.CJS] Connected to SQL Server: AVI_IRS_UM');
        return pool;
      })
      .catch((err) => {
        umPoolPromise = null;
        console.error('? [DB.CJS] AVI_IRS_UM Error:', err.message);
        throw err;
      });
  }
  return umPoolPromise;
}

async function getDataPool() {
  if (!dataPoolPromise) {
    console.log('? [DB.CJS] Connecting to AVINASH\\SQL2017 -> AVI_IRS_DATA...');
    dataPoolPromise = new sql.ConnectionPool(dataDbConfig)
      .connect()
      .then((pool) => {
        console.log('? [DB.CJS] Connected to SQL Server: AVI_IRS_DATA');
        return pool;
      })
      .catch((err) => {
        dataPoolPromise = null;
        console.error('? [DB.CJS] AVI_IRS_DATA Error:', err.message);
        throw err;
      });
  }
  return dataPoolPromise;
}

module.exports = { sql, getPool, getDataPool };
