import mysql from 'mysql2/promise';

async function checkVoiceNames() {
  const connection = await mysql.createConnection({
    host: '47.238.216.176',
    port: 3306,
    user: 'agent_sys',
    password: 'k3RdACw4Jx3HsphB',
    database: 'agent_sys',
  });

  try {
    console.log('检查音色名称数据...');

    const [rows] = await connection.execute(
      'SELECT voiceId, name, prefix FROM voice ORDER BY createdAt DESC LIMIT 10',
    );

    console.log('音色数据:');
    rows.forEach((row) => {
      console.log(`ID: ${row.voiceId}`);
      console.log(`Name: ${row.name || 'NULL'}`);
      console.log(`Prefix: ${row.prefix || 'NULL'}`);
      console.log('---');
    });
  } catch (error) {
    console.error('检查过程中出错:', error.message);
  } finally {
    await connection.end();
  }
}

checkVoiceNames();
