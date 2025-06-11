import bcrypt from 'bcrypt';
import postgres from 'postgres';
import { invoices, customers, revenue, users } from '../lib/placeholder-data';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

async function seedUsers() {
  console.log('🔄 Creating users table...');
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );
  `;

  console.log('🔄 Inserting users...');
  const insertedUsers = await Promise.all(
    users.map(async (user) => {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      return sql`
        INSERT INTO users (id, name, email, password)
        VALUES (${user.id}, ${user.name}, ${user.email}, ${hashedPassword})
        ON CONFLICT (id) DO NOTHING;
      `;
    }),
  );

  console.log(`✅ Users seeded: ${insertedUsers.length} records`);
  return insertedUsers;
}

async function seedInvoices() {
  console.log('🔄 Creating invoices table...');
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

  await sql`
    CREATE TABLE IF NOT EXISTS invoices (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      customer_id UUID NOT NULL,
      amount INT NOT NULL,
      status VARCHAR(255) NOT NULL,
      date DATE NOT NULL
    );
  `;

  console.log('🔄 Inserting invoices...');
  const insertedInvoices = await Promise.all(
    invoices.map(
      (invoice) => sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${invoice.customer_id}, ${invoice.amount}, ${invoice.status}, ${invoice.date})
        ON CONFLICT (id) DO NOTHING;
      `,
    ),
  );

  console.log(`✅ Invoices seeded: ${insertedInvoices.length} records`);
  return insertedInvoices;
}

async function seedCustomers() {
  console.log('🔄 Creating customers table...');
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

  await sql`
    CREATE TABLE IF NOT EXISTS customers (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      image_url VARCHAR(255) NOT NULL
    );
  `;

  console.log('🔄 Inserting customers...');
  const insertedCustomers = await Promise.all(
    customers.map(
      (customer) => sql`
        INSERT INTO customers (id, name, email, image_url)
        VALUES (${customer.id}, ${customer.name}, ${customer.email}, ${customer.image_url})
        ON CONFLICT (id) DO NOTHING;
      `,
    ),
  );

  console.log(`✅ Customers seeded: ${insertedCustomers.length} records`);
  return insertedCustomers;
}

async function seedRevenue() {
  console.log('🔄 Creating revenue table...');
  await sql`
    CREATE TABLE IF NOT EXISTS revenue (
      month VARCHAR(4) NOT NULL UNIQUE,
      revenue INT NOT NULL
    );
  `;

  console.log('🔄 Inserting revenue...');

  // 使用单个批量插入而不是 Promise.all
  try {
    const result = await sql`
      INSERT INTO revenue ${sql(revenue, 'month', 'revenue')}
      ON CONFLICT (month) DO NOTHING;
    `;
    console.log(`✅ Revenue seeded: ${result.length} records`);
    return result;
  } catch (error) {
    console.error('Revenue insertion error:', error);
    // 如果批量插入失败，改为逐条插入
    console.log('Falling back to individual inserts...');
    for (const rev of revenue) {
      await sql`
        INSERT INTO revenue (month, revenue)
        VALUES (${rev.month}, ${rev.revenue})
        ON CONFLICT (month) DO NOTHING;
      `;
    }
    console.log(`✅ Revenue seeded: ${revenue.length} records (fallback)`);
  }
}

export async function GET() {
  try {
    console.log('🚀 Starting database seed...');

    // 移除 sql.begin() 事务，改为顺序执行
    console.log('📝 Seeding users...');
    await seedUsers();

    console.log('👥 Seeding customers...');
    await seedCustomers();

    console.log('📄 Seeding invoices...');
    await seedInvoices();

    console.log('💰 Seeding revenue...');
    await seedRevenue();

    console.log('🎉 Database seeded successfully!');
    return Response.json({ message: 'Database seeded successfully' });
  } catch (error) {
    console.error('❌ Seeding error:', error);

    // 返回更详细的错误信息
    return Response.json({
      error: {
        message: error.message || 'Unknown error',
        code: error.code || 'UNKNOWN',
        name: error.name || 'Error'
      }
    }, { status: 500 });
  }
}