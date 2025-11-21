import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const execAsync = promisify(exec);

// Load environment variables
dotenv.config();

async function initDatabase() {
    console.log('🚀 Initializing database...\n');

    try {
        // 1. Ensure data directory exists
        console.log('📁 Creating data directory...');
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log('✓ Data directory created\n');
        } else {
            console.log('✓ Data directory already exists\n');
        }

        // 2. Get database path from env or use default
        const databaseUrl = process.env.DATABASE_URL || 'sqlite:./data/dev.db';
        const dbPath = databaseUrl.replace('sqlite:', '');
        const dbDir = path.dirname(dbPath);

        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
            console.log('✓ Database directory created\n');
        }

        // 3. Generate migrations
        console.log('📝 Generating database migrations...');
        let useMigrations = true;
        try {
            await execAsync('npm run db:generate');
            console.log('✓ Migrations generated\n');
        } catch (error: any) {
            const errorMsg = error.message || error.stderr || '';
            // If migrations already exist, that's okay
            if (errorMsg.includes('No schema changes') || errorMsg.includes('already exists')) {
                console.log('✓ No schema changes detected\n');
            } else {
                console.log('⚠️  Migration generation had issues, will use push method\n');
                useMigrations = false;
            }
        }

        // 4. Apply schema to database
        if (useMigrations) {
            console.log('🔄 Running database migrations...');
            try {
                await execAsync('npm run db:migrate');
                console.log('✓ Migrations applied\n');
            } catch (error: any) {
                console.log('⚠️  Migration apply failed, using push method instead...\n');
                await execAsync('npm run db:push');
                console.log('✓ Schema pushed to database\n');
            }
        } else {
            // Use push instead of migrations for SQLite
            console.log('🔄 Pushing schema to database (direct push)...');
            await execAsync('npm run db:push');
            console.log('✓ Schema pushed to database\n');
        }

        // 5. Verify database was created
        if (fs.existsSync(dbPath)) {
            const stats = fs.statSync(dbPath);
            console.log(`✓ Database created at: ${dbPath}`);
            console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB\n`);
        } else {
            console.log(`⚠️  Database file not found at: ${dbPath}`);
            console.log('   It will be created on first connection\n');
        }

        console.log('✅ Database initialization complete!');
        console.log('\n📊 You can now:');
        console.log('   - Start the server: npm run dev');
        console.log('   - Open Drizzle Studio: npm run db:studio');
    } catch (error) {
        console.error('\n❌ Database initialization failed:');
        console.error(error);
        process.exit(1);
    }
}

// Run the initialization
initDatabase();

