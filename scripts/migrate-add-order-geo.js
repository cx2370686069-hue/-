const { DataTypes } = require('sequelize');
const { sequelize } = require('../models');

const TABLE_NAME = 'orders';

const columnsToAdd = [
  { name: 'merchant_lng', type: DataTypes.DECIMAL(11, 8), comment: '商家经度' },
  { name: 'merchant_lat', type: DataTypes.DECIMAL(10, 8), comment: '商家纬度' },
  { name: 'customer_lng', type: DataTypes.DECIMAL(11, 8), comment: '客户经度' },
  { name: 'customer_lat', type: DataTypes.DECIMAL(10, 8), comment: '客户纬度' }
];

async function main() {
  const qi = sequelize.getQueryInterface();
  const table = await qi.describeTable(TABLE_NAME);

  for (const col of columnsToAdd) {
    if (table[col.name]) continue;
    await qi.addColumn(TABLE_NAME, col.name, {
      type: col.type,
      allowNull: true,
      comment: col.comment
    });
  }
}

main()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (err) => {
    try {
      await sequelize.close();
    } catch (e) {}
    console.error(err);
    process.exit(1);
  });

