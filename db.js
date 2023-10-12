const mysql = require('mysql2');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'appuser',
  password: 'Sape123',
  database: 'flashstudy_prueba'
}).promise();

async function getUser(sub) {
    const [rows, fields] = await pool.query(`
        SELECT * 
        FROM users 
        WHERE sub = ?
        `, [sub]);
    console.log('row length: ', rows.length)
    if (rows.length === 0) {
        console.log('User not found');
        return null;
    }
    return rows[0];
}

async function insertUser(user){
    const sql = `
    INSERT INTO users (sub, email, plan, tokens, token_limit)
    VALUES (?, ?, ?, ?, ?)
  `;

  const values = [
    user.sub,
    user.email,
    'free',
    0,
    process.env.FREE_PLAN_LIMIT
  ];
  const [result] = await pool.query(sql, values);
  return result;
}


async function updateUserTokens(sub, newTokens) {
    const sql = `
      UPDATE users
      SET tokens = ?
      WHERE sub = ?
    `;
  
    const values = [
      newTokens,
      sub
    ];

    const [result] = await pool.query(sql, values);
    return result.affectedRows > 0;
}

async function updateDatabaseWebhook(sub, plan, subscription_id, token_limit, cycle){
    const sql = `
    UPDATE users
    SET tokens = 0, plan = ?, token_limit = ?, lemon_sub_id = ?, cycle = ?
    WHERE sub = ?
  `;

  const values = [
    plan,
    token_limit,
    subscription_id,
    sub,
    cycle
  ];

  const [result] = await pool.query(sql, values);
  return result.affectedRows > 0;
}

async function updateDatabaseGrade(plan, subscription_id, token_limit, cycle){
  const sql = `
  UPDATE users
  SET tokens = 0, plan = ?, token_limit = ?, cycle = ?
  WHERE lemon_sub_id = ?
`;

const values = [
  plan,
  token_limit,
  cycle,
  subscription_id,
];

const [result] = await pool.query(sql, values);
return result.affectedRows > 0;
}


module.exports = {getUser, insertUser, updateUserTokens, updateDatabaseWebhook, updateDatabaseGrade};
