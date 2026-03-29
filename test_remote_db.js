const mysql = require('mysql2/promise');

async function test() {
  const connection = await mysql.createConnection({
    host: '121.43.190.218',
    user: 'root',
    password: 'cx18590332807',
    database: 'gushi_waimai'
  });

  const [rows] = await connection.execute('SELECT id, order_no, user_id, merchant_id, status, pay_amount, created_at FROM orders ORDER BY id DESC LIMIT 5;');
  console.log(rows);
  
  const [merchants] = await connection.execute('SELECT id, user_id, name FROM merchants ORDER BY id DESC LIMIT 5;');
  console.log(merchants);
  
  await connection.end();
}

test().catch(console.error);