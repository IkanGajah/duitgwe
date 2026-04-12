import { Account, Category, Transaction } from '@/types/types';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import { FlatList, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function HistoryScreen() {
  const db = useSQLiteContext();
  
  // --- STATE DATA ---
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [report, setReport] = useState({ income: 0, expense: 0 });

  // --- STATE FILTER ---
  // Default bulan adalah bulan saat ini (Format: YYYY-MM)
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().substring(0, 7));
  const [filterCategoryId, setFilterCategoryId] = useState<number | null>(null);
  const [filterAccountId, setFilterAccountId] = useState<number | null>(null);

  // --- STATE MODAL ---
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedIdToDelete, setSelectedIdToDelete] = useState<number | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => { 
      fetchFiltersData(); 
      fetchTransactionsAndReport(); 
    }, [filterMonth, filterCategoryId, filterAccountId])
  );

  // 1. Ambil data Kategori & Dompet untuk pilihan Filter
  const fetchFiltersData = async () => {
    setCategories(await db.getAllAsync<Category>("SELECT * FROM categories"));
    setAccounts(await db.getAllAsync<Account>("SELECT * FROM accounts"));
  };

  // 2. Ambil Transaksi & Hitung Laporan berdasarkan Filter
  const fetchTransactionsAndReport = async () => {
    // QUERY UNTUK LIST TRANSAKSI BAWAH (Tampilkan Semua, Termasuk Transfer)
    let listQueryStr = `SELECT t.id, t.amount, t.type, t.description, t.date, c.name as category, a.name as account 
                        FROM transactions t 
                        LEFT JOIN categories c ON t.category_id = c.id 
                        LEFT JOIN accounts a ON t.account_id = a.id 
                        WHERE t.date LIKE ?`;
    
    // Parameter wajib pertama: Bulan (Pakai LIKE agar cocok dengan ISO String)
    const listParams: any[] = [`${filterMonth}%`];

    // Tambah filter Kategori jika dipilih
    if (filterCategoryId !== null) { 
      listQueryStr += " AND t.category_id = ?"; 
      listParams.push(filterCategoryId); 
    }
    // Tambah filter Dompet jika dipilih
    if (filterAccountId !== null) { 
      listQueryStr += " AND t.account_id = ?"; 
      listParams.push(filterAccountId); 
    }
    listQueryStr += " ORDER BY t.date DESC, t.id DESC";
    const transResult = await db.getAllAsync<Transaction>(listQueryStr, listParams);
    setTransactions(transResult);

    // 2. QUERY UNTUK LAPORAN ATAS (KECUALIKAN TRANSFER -> category_id IS NOT NULL)
    let reportQueryStr = `SELECT t.type, SUM(t.amount) as total 
                          FROM transactions t 
                          WHERE t.date LIKE ? AND t.category_id IS NOT NULL`;
    const reportParams: any[] = [`${filterMonth}%`];

    if (filterCategoryId !== null) { reportQueryStr += " AND t.category_id = ?"; reportParams.push(filterCategoryId); }
    if (filterAccountId !== null) { reportQueryStr += " AND t.account_id = ?"; reportParams.push(filterAccountId); }
    reportQueryStr += " GROUP BY t.type";
    const reportResult = await db.getAllAsync<{type: string, total: number}>(reportQueryStr, reportParams);
    
    let inc = 0; let exp = 0;
    reportResult.forEach(row => {
      if(row.type === 'income') inc = row.total;
      if(row.type === 'expense') exp = row.total;
    });
    setReport({ income: inc, expense: exp });
  };

// --- FUNGSI NAVIGASI BULAN (UPDATE: FIX TIMEZONE BUG) ---
  const changeMonth = (offset: number) => {
    const [year, month] = filterMonth.split('-').map(Number);
    
    let newMonth = month - 1 + offset; // Index bulan di JS mulai dari 0
    let newYear = year;

    // Jika lewat Desember, maju ke tahun depan
    if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    } 
    // Jika mundur sebelum Januari, mundur ke tahun lalu
    else if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    }

    // Gabungkan kembali jadi format YYYY-MM (tambahkan angka 0 di depan jika bulan < 10)
    const mm = String(newMonth + 1).padStart(2, '0');
    setFilterMonth(`${newYear}-${mm}`);
  };

  const getMonthName = (yyyymm: string) => {
    const [year, month] = yyyymm.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  // --- FUNGSI HAPUS ---
  const confirmDelete = (id: number) => { setSelectedIdToDelete(id); setDeleteModalVisible(true); };
  const executeDelete = async () => {
    if (selectedIdToDelete !== null) {
      await db.runAsync("DELETE FROM transactions WHERE id = ?", [selectedIdToDelete]);
      setDeleteModalVisible(false); setSelectedIdToDelete(null); fetchTransactionsAndReport();
    }
  };
  
  const formatRupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

  const selisihBulanIni = report.income - report.expense;

  return (
    <View className="flex-1 bg-slate-950">
      
      {/* HEADER */}
      <View className="p-5 pt-16 bg-slate-900 rounded-b-3xl shadow-lg shadow-black/50 z-10">
         <Text className="text-2xl font-bold text-white mb-4">Laporan & Histori</Text>

         {/* KARTU LAPORAN BULANAN */}
         <View className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-white font-bold text-base">{getMonthName(filterMonth)}</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(true)} className="bg-blue-600 px-3 py-1 rounded-lg">
                <Text className="text-white text-xs font-bold">Atur Filter</Text>
              </TouchableOpacity>
            </View>
            
            <View className="flex-row justify-between">
              <View>
                <Text className="text-slate-400 text-xs">Pemasukan</Text>
                <Text className="text-emerald-400 font-bold text-base">+{formatRupiah(report.income)}</Text>
              </View>
              <View className="items-end">
                <Text className="text-slate-400 text-xs">Pengeluaran</Text>
                <Text className="text-rose-400 font-bold text-base">-{formatRupiah(report.expense)}</Text>
              </View>
            </View>

            {/* GARIS PEMISAH & TOTAL BERSIH */}
            <View className="pt-3 border-t border-slate-700 flex-row justify-between items-center">
               <Text className="text-slate-300 text-xs font-bold">Total Bersih</Text>
               <Text className={`font-bold text-lg ${selisihBulanIni >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {selisihBulanIni > 0 ? '+' : ''}{formatRupiah(selisihBulanIni)}
               </Text>
            </View>
         </View>
      </View>

      {/* INDIKATOR FILTER AKTIF */}
      {(filterCategoryId !== null || filterAccountId !== null) && (
        <View className="px-5 pt-4 flex-row flex-wrap gap-2">
          {filterCategoryId !== null && (
            <View className="bg-blue-900/50 px-2 py-1 rounded border border-blue-700"><Text className="text-blue-300 text-xs">Kategori Difilter</Text></View>
          )}
          {filterAccountId !== null && (
            <View className="bg-purple-900/50 px-2 py-1 rounded border border-purple-700"><Text className="text-purple-300 text-xs">Dompet Difilter</Text></View>
          )}
        </View>
      )}

      {/* LIST TRANSAKSI */}
      <FlatList
        data={transactions}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={{paddingBottom: 50, paddingTop: 16}}
        renderItem={({ item }) => (
          <TouchableOpacity 
            onLongPress={() => confirmDelete(item.id)} 
            className="bg-slate-900 p-4 mx-5 mb-3 rounded-xl flex-row justify-between items-center border border-slate-800"
          >
            <View className="flex-1">
                <Text className="font-bold text-base text-slate-200 mb-1">{item.description}</Text>
                <View className="flex-row items-center">
                  {/* JIKA CATEGORY NULL (KOSONG), TAMPILKAN LABEL 'Transfer' WARNA UNGU */}
                  <Text className={`text-xs px-2 py-1 rounded mr-2 font-bold ${item.category ? 'bg-slate-800 text-slate-400' : 'bg-purple-900/50 text-purple-300 border border-purple-800'}`}>
                    {item.category ? item.category : 'Transfer'}
                  </Text>
                  <Text className="text-xs text-slate-500">{item.account}</Text>
                </View>
                <Text className="text-[10px] text-slate-600 mt-1">{new Date(item.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
            </View>
            <Text className={`font-bold text-base ${item.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {item.type === 'income' ? '+' : '-'}{formatRupiah(item.amount)}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View className="items-center justify-center mt-10">
            <Text className="text-slate-600 text-base font-bold">Tidak ada transaksi</Text>
          </View>
        }
      />

      {/* MODAL FILTER GANDA */}
      <Modal visible={filterModalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/80">
            <View className="bg-slate-900 rounded-t-3xl p-6 min-h-[60%]">
                <Text className="text-xl font-bold mb-6 text-center text-white">Atur Laporan & Filter</Text>

                {/* 1. Filter Bulan */}
                <Text className="font-bold text-slate-400 mb-2">Pilih Bulan:</Text>
                <View className="flex-row justify-between items-center bg-slate-800 p-2 rounded-xl mb-6">
                  <TouchableOpacity onPress={() => changeMonth(-1)} className="p-2 px-4 bg-slate-700 rounded-lg"><Text className="text-white font-bold">{'<'}</Text></TouchableOpacity>
                  <Text className="text-white font-bold text-base">{getMonthName(filterMonth)}</Text>
                  <TouchableOpacity onPress={() => changeMonth(1)} className="p-2 px-4 bg-slate-700 rounded-lg"><Text className="text-white font-bold">{'>'}</Text></TouchableOpacity>
                </View>

                {/* 2. Filter Kategori */}
                <Text className="font-bold text-slate-400 mb-2">Pilih Kategori:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4 h-14">
                  <TouchableOpacity onPress={() => setFilterCategoryId(null)} className={`px-4 my-1 rounded-full mr-2 border justify-center ${filterCategoryId === null ? 'bg-blue-600 border-blue-600' : 'bg-slate-800 border-slate-700'}`}>
                      <Text className={filterCategoryId === null ? 'text-white' : 'text-slate-300'}>Semua</Text>
                  </TouchableOpacity>
                  {categories.map(cat => (
                      <TouchableOpacity key={cat.id} onPress={() => setFilterCategoryId(cat.id)} className={`px-4 my-1 rounded-full mr-2 border justify-center ${filterCategoryId === cat.id ? 'bg-blue-600 border-blue-600' : 'bg-slate-800 border-slate-700'}`}>
                          <Text className={filterCategoryId === cat.id ? 'text-white' : 'text-slate-300'}>{cat.name}</Text>
                      </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* 3. Filter Dompet */}
                <Text className="font-bold text-slate-400 mb-2">Pilih Dompet:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4 h-14">
                  <TouchableOpacity onPress={() => setFilterAccountId(null)} className={`px-4 my-1 rounded-full mr-2 border justify-center ${filterAccountId === null ? 'bg-purple-600 border-purple-600' : 'bg-slate-800 border-slate-700'}`}>
                      <Text className={filterAccountId === null ? 'text-white' : 'text-slate-300'}>Semua</Text>
                  </TouchableOpacity>
                  {accounts.map(acc => (
                      <TouchableOpacity key={acc.id} onPress={() => setFilterAccountId(acc.id)} className={`px-4 my-1 rounded-full mr-2 border justify-center ${filterAccountId === acc.id ? 'bg-purple-600 border-purple-600' : 'bg-slate-800 border-slate-700'}`}>
                          <Text className={filterAccountId === acc.id ? 'text-white' : 'text-slate-300'}>{acc.name}</Text>
                      </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Tombol Aksi */}
                <View className="flex-row gap-4 mt-auto mb-4">
                  <TouchableOpacity onPress={() => { setFilterCategoryId(null); setFilterAccountId(null); setFilterMonth(new Date().toISOString().substring(0, 7)); }} className="p-4 flex-1 items-center bg-slate-800 rounded-xl">
                      <Text className="text-slate-300">Reset Filter</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setFilterModalVisible(false)} className="p-4 flex-1 items-center bg-blue-600 rounded-xl">
                      <Text className="text-white font-bold">Terapkan</Text>
                  </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

      {/* MODAL KONFIRMASI HAPUS */}
      <Modal visible={deleteModalVisible} animationType="fade" transparent>
        <View className="flex-1 justify-center items-center bg-black/80">
            <View className="w-[80%] bg-slate-900 p-6 rounded-2xl items-center border border-slate-800 shadow-xl">
                <Text className="text-xl font-bold text-white mb-2">Hapus Transaksi?</Text>
                <Text className="text-slate-400 text-center mb-6">Data yang dihapus tidak bisa dikembalikan.</Text>
                <View className="flex-row gap-4 w-full">
                    <TouchableOpacity onPress={() => setDeleteModalVisible(false)} className="flex-1 bg-slate-800 p-3 rounded-xl items-center"><Text className="text-slate-300 font-bold">Batal</Text></TouchableOpacity>
                    <TouchableOpacity onPress={executeDelete} className="flex-1 bg-rose-600 p-3 rounded-xl items-center"><Text className="text-white font-bold">Hapus</Text></TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

    </View>
  );
}