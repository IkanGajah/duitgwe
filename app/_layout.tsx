import { Stack } from 'expo-router';
import { SQLiteProvider, SQLiteDatabase } from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    // Kita membungkus seluruh navigasi aplikasi dengan SQLiteProvider
    // Agar semua halaman di dalamnya bisa akses database
    <SQLiteProvider databaseName="keuanganku_v2.db" onInit={migrateDbIfNeeded}>
      <StatusBar style="light" /> 
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </SQLiteProvider>
  );
}

// --- FUNGSI MIGRASI DATABASE (Dipindah kesini) ---
async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const DATABASE_VERSION = 1;
  
  // Cek versi database
  let result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentDbVersion = result ? result.user_version : 0;
  
  if (currentDbVersion >= DATABASE_VERSION) {
    return;
  }

  // Buat Tabel
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, type TEXT);
    CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, type TEXT);
    CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, amount INTEGER, type TEXT, description TEXT, account_id INTEGER, category_id INTEGER, date TEXT, FOREIGN KEY(account_id) REFERENCES accounts(id), FOREIGN KEY(category_id) REFERENCES categories(id));
  `);
  
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}