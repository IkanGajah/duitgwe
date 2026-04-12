import { Account, Category } from '@/types/types';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const db = useSQLiteContext();

  // --- STATE ---
  const [saldoTunai, setSaldoTunai] = useState(0);
  const [saldoNonTunai, setSaldoNonTunai] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [transModalVisible, setTransModalVisible] = useState(false);
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [editAccountModalVisible, setEditAccountModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);

  const [transType, setTransType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);
  const [selectedAccount2, setSelectedAccount2] = useState<number | null>(null); 
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState('Tunai');
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');

  // --- LOAD DATA ---
  useFocusEffect(
    useCallback(() => { fetchData(); }, [])
  );

  const fetchData = async () => {
    await fetchAccountsAndBalance();
    await fetchCategories();
  };

  const fetchAccountsAndBalance = async () => {
    const result = await db.getAllAsync<Account>(`
      SELECT a.id, a.name, a.type, 
      COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) as current_balance
      FROM accounts a
      LEFT JOIN transactions t ON t.account_id = a.id
      GROUP BY a.id
    `);
    setAccounts(result);
    let tunai = 0, nonTunai = 0;
    result.forEach(acc => acc.type === 'Tunai' ? tunai += acc.current_balance : nonTunai += acc.current_balance);
    setSaldoTunai(tunai);
    setSaldoNonTunai(nonTunai);
  };

  const fetchCategories = async () => {
    const result = await db.getAllAsync<Category>("SELECT * FROM categories");
    setCategories(result);
  };

  // --- LOGIC FORMATTING ANGKA (BARU) ---
  const handleAmountChange = (text: string) => {
    // 1. Hilangkan semua karakter selain angka (biar nggak error kalau terketik huruf)
    const numericText = text.replace(/[^0-9]/g, '');
    // 2. Tambahkan titik setiap 3 digit pakai Regex
    const formattedText = numericText.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    // 3. Simpan ke state
    setAmount(formattedText);
  };

  // --- LOGIC TRANSAKSI ---
  const addTransaction = async () => {
    // Buang titiknya dulu sebelum masuk database supaya jadi angka murni
    const cleanAmount = parseInt(amount.replace(/\./g, ''));

    if (!cleanAmount || cleanAmount <= 0) return Alert.alert("Error", "Masukkan jumlah uang yang valid");

    const dateNow = new Date().toISOString();

    if (transType === 'transfer') {
        if (!selectedAccount || !selectedAccount2) return Alert.alert("Error", "Pilih dompet asal dan tujuan");
        if (selectedAccount === selectedAccount2) return Alert.alert("Error", "Dompet asal dan tujuan tidak boleh sama");

        const sourceAcc = accounts.find(a => a.id === selectedAccount);
        const destAcc = accounts.find(a => a.id === selectedAccount2);
        
        await db.runAsync("INSERT INTO transactions (amount, type, description, account_id, category_id, date) VALUES (?, ?, ?, ?, ?, ?)", 
            [cleanAmount, 'expense', description || `Transfer ke ${destAcc?.name}`, selectedAccount, null, dateNow]);
        
        await db.runAsync("INSERT INTO transactions (amount, type, description, account_id, category_id, date) VALUES (?, ?, ?, ?, ?, ?)", 
            [cleanAmount, 'income', description || `Transfer dari ${sourceAcc?.name}`, selectedAccount2, null, dateNow]);

    } else {
        if (!selectedCategory || !selectedAccount) return Alert.alert("Error", "Pilih kategori dan dompet");
        await db.runAsync("INSERT INTO transactions (amount, type, description, account_id, category_id, date) VALUES (?, ?, ?, ?, ?, ?)", 
            [cleanAmount, transType, description, selectedAccount, selectedCategory, dateNow]);
    }

    setTransModalVisible(false); resetForm(); fetchData(); 
  };

  const handleSaveAccount = async () => {
    if(!accountName) return;
    if (editingAccountId) {
      await db.runAsync("UPDATE accounts SET name = ?, type = ? WHERE id = ?", [accountName, accountType, editingAccountId]);
    } else {
      await db.runAsync("INSERT INTO accounts (name, type) VALUES (?, ?)", [accountName, accountType]);
    }
    setAccountModalVisible(false); setEditAccountModalVisible(false); setAccountName(''); setEditingAccountId(null); fetchData();
  };

  const handleDeleteAccount = async () => {
    if (!editingAccountId) return;
    Alert.alert("Hapus Akun", "Yakin?", [{ text: "Batal" }, { text: "Hapus", style:'destructive', onPress: async () => {
          await db.runAsync("DELETE FROM transactions WHERE account_id = ?", [editingAccountId]); 
          await db.runAsync("DELETE FROM accounts WHERE id = ?", [editingAccountId]); 
          setEditAccountModalVisible(false); fetchData();
      }}]);
  };

  const openEditAccount = (acc: Account) => {
    setAccountName(acc.name); setAccountType(acc.type); setEditingAccountId(acc.id); setEditAccountModalVisible(true);
  };

  const addNewCategory = async () => {
    if(!newCategoryName) return;
    await db.runAsync("INSERT INTO categories (name, type) VALUES (?, ?)", [newCategoryName, 'general']);
    setNewCategoryName(''); fetchCategories();
  };

  const deleteCategory = async (id: number) => {
    Alert.alert("Hapus Kategori", "Yakin?", [{ text: "Batal" }, { text: "Hapus", style: 'destructive', onPress: async () => {
        await db.runAsync("DELETE FROM categories WHERE id = ?", [id]); fetchCategories();
      }}]);
  };

  const resetForm = () => { 
      setAmount(''); setDescription(''); setSelectedCategory(null); setSelectedAccount(null); setSelectedAccount2(null); 
  };
  
  const formatRupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

  return (
    <View className="flex-1 bg-slate-950">
      
      {/* HEADER TOTAL */}
      <View className="p-5 pt-16 bg-slate-900 rounded-b-3xl shadow-lg shadow-black/50">
        <Text className="text-2xl font-bold mb-4 text-white">Ringkasan Keuangan</Text>
        <View className="flex-row justify-between">
          <View className="bg-slate-800 p-4 rounded-xl w-[48%] border border-slate-700">
            <Text className="text-xs text-slate-400 mb-1">Tunai</Text>
            <Text className="text-lg font-bold text-emerald-400">{formatRupiah(saldoTunai)}</Text>
          </View>
          <View className="bg-slate-800 p-4 rounded-xl w-[48%] border border-slate-700">
            <Text className="text-xs text-slate-400 mb-1">Non-Tunai</Text>
            <Text className="text-lg font-bold text-blue-400">{formatRupiah(saldoNonTunai)}</Text>
          </View>
        </View>
      </View>

      {/* DOMPET LIST */}
      <View className="mt-8">
        <Text className="px-5 font-bold text-slate-400 mb-3 text-sm">Dompet Saya (Tahan untuk Edit)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 20}}>
            {accounts.map((acc) => (
                <TouchableOpacity 
                  key={acc.id} 
                  className="bg-slate-900 w-36 h-28 p-4 rounded-2xl mr-3 justify-between border border-slate-800"
                  onLongPress={() => openEditAccount(acc)}
                >
                    <Text className="font-bold text-white text-base">{acc.name}</Text>
                    <Text className="text-[10px] text-slate-500 uppercase">{acc.type}</Text>
                    <Text className="font-bold text-slate-200">{formatRupiah(acc.current_balance)}</Text>
                </TouchableOpacity>
            ))}
             <TouchableOpacity 
                className="bg-slate-900 w-36 h-28 rounded-2xl mr-3 justify-center items-center border border-dashed border-slate-700"
                onPress={() => { setEditingAccountId(null); setAccountName(''); setAccountModalVisible(true); }}
             >
                <Text className="text-3xl text-slate-600">+</Text>
            </TouchableOpacity>
        </ScrollView>
      </View>

      {/* TOMBOL AKSI */}
      <View className="flex-row justify-between px-5 mt-6">
        <TouchableOpacity 
            className="p-3 rounded-xl w-[31%] items-center bg-emerald-600 shadow-md shadow-emerald-900/50" 
            onPress={() => { setTransType('income'); setTransModalVisible(true); }}
        >
            <Text className="text-white font-bold text-xs">Pemasukan</Text>
        </TouchableOpacity>
        <TouchableOpacity 
            className="p-3 rounded-xl w-[31%] items-center bg-rose-600 shadow-md shadow-rose-900/50"
            onPress={() => { setTransType('expense'); setTransModalVisible(true); }}
        >
            <Text className="text-white font-bold text-xs">Pengeluaran</Text>
        </TouchableOpacity>
        <TouchableOpacity 
            className="p-3 rounded-xl w-[31%] items-center bg-purple-600 shadow-md shadow-purple-900/50"
            onPress={() => { setTransType('transfer'); setTransModalVisible(true); }}
        >
            <Text className="text-white font-bold text-xs">Transfer</Text>
        </TouchableOpacity>
      </View>

      {/* TOMBOL KATEGORI */}
      <View className="items-center mt-4 mb-5">
          <TouchableOpacity onPress={() => setCategoryModalVisible(true)} className="p-2">
              <Text className="text-blue-400 font-bold text-sm">+ Atur Kategori</Text>
          </TouchableOpacity>
      </View>

      {/* MODAL TRANSAKSI & TRANSFER */}
      <Modal visible={transModalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/80">
          <View className="bg-slate-900 rounded-t-3xl p-6 h-[80%]">
            <Text className="text-xl font-bold mb-6 text-center text-white">
                {transType === 'income' ? 'Tambah Uang' : transType === 'expense' ? 'Kurang Uang' : 'Transfer Antar Dompet'}
            </Text>

            {/* UPDATE: Gunakan handleAmountChange untuk TextInput ini */}
            <TextInput 
              placeholder="Jumlah (Rp)" 
              placeholderTextColor="#64748b" 
              keyboardType="numeric" 
              className="bg-slate-800 text-white p-4 rounded-xl mb-4 text-lg border border-slate-700" 
              value={amount} 
              onChangeText={handleAmountChange} 
            />
            
            <TextInput placeholder={transType === 'transfer' ? "Catatan (Opsional)" : "Keterangan"} placeholderTextColor="#64748b" className="bg-slate-800 text-white p-4 rounded-xl mb-4 text-lg border border-slate-700" value={description} onChangeText={setDescription} />
            
            {transType === 'transfer' ? (
                <>
                    <Text className="mt-2 mb-2 font-bold text-slate-400">Dari Dompet (Sumber):</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                        {accounts.map(acc => (
                            <TouchableOpacity key={acc.id} onPress={() => setSelectedAccount(acc.id)} 
                                className={`px-4 py-3 rounded-full mr-2 border self-start ${selectedAccount === acc.id ? 'bg-blue-600 border-blue-600' : 'bg-slate-800 border-slate-700'}`}>
                                <Text className={selectedAccount === acc.id ? 'text-white' : 'text-slate-300'}>{acc.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <Text className="mt-2 mb-2 font-bold text-slate-400">Ke Dompet (Tujuan):</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
                        {accounts.map(acc => (
                            <TouchableOpacity key={acc.id} onPress={() => setSelectedAccount2(acc.id)} 
                                className={`px-4 py-3 rounded-full mr-2 border self-start ${selectedAccount2 === acc.id ? 'bg-purple-600 border-purple-600' : 'bg-slate-800 border-slate-700'}`}>
                                <Text className={selectedAccount2 === acc.id ? 'text-white' : 'text-slate-300'}>{acc.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </>
            ) : (
                <>
                    <Text className="mt-2 mb-2 font-bold text-slate-400">Pilih Kategori:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                        {categories.map(cat => (
                            <TouchableOpacity key={cat.id} onPress={() => setSelectedCategory(cat.id)} 
                                className={`px-4 py-3 rounded-full mr-2 border self-start ${selectedCategory === cat.id ? 'bg-blue-600 border-blue-600' : 'bg-slate-800 border-slate-700'}`}>
                                <Text className={selectedCategory === cat.id ? 'text-white text-sm' : 'text-slate-300 text-sm'}>{cat.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <Text className="mt-2 mb-2 font-bold text-slate-400">Pilih Dompet:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
                    {accounts.map(acc => (
                        <TouchableOpacity key={acc.id} onPress={() => setSelectedAccount(acc.id)} 
                            className={`px-4 py-3 rounded-full mr-2 border self-start ${selectedAccount === acc.id ? 'bg-purple-600 border-purple-600' : 'bg-slate-800 border-slate-700'}`}>
                            <Text className={selectedAccount === acc.id ? 'text-white text-sm' : 'text-slate-300 text-sm'}>{acc.name}</Text>
                        </TouchableOpacity>
                    ))}
                    </ScrollView>
                </>
            )}

            <View className="flex-row gap-4 mt-auto mb-6">
                <TouchableOpacity onPress={() => { setTransModalVisible(false); resetForm(); }} className="p-4 flex-1 items-center bg-slate-800 rounded-xl"><Text className="text-slate-300">Batal</Text></TouchableOpacity>
                <TouchableOpacity onPress={addTransaction} className="p-4 flex-1 items-center bg-blue-600 rounded-xl"><Text className="text-white font-bold">Simpan</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL AKUN & KATEGORI */}
      <Modal visible={accountModalVisible || editAccountModalVisible} animationType="fade" transparent>
        <View className="flex-1 justify-center items-center bg-black/80">
            <View className="w-[85%] bg-slate-900 p-6 rounded-2xl items-center border border-slate-800">
                <Text className="text-xl font-bold mb-5 text-white">{editAccountModalVisible ? 'Edit Dompet' : 'Dompet Baru'}</Text>
                <TextInput placeholder="Nama Dompet" placeholderTextColor="#64748b" className="bg-slate-800 text-white p-4 rounded-xl w-full mb-4 border border-slate-700" value={accountName} onChangeText={setAccountName}/>
                <View className="flex-row gap-3 mb-5 w-full justify-center">
                    <TouchableOpacity onPress={()=>setAccountType('Tunai')} className={`px-4 py-2 rounded-full border ${accountType==='Tunai' ? 'bg-blue-600 border-blue-600' : 'bg-slate-800 border-slate-700'}`}><Text className="text-white">Tunai</Text></TouchableOpacity>
                    <TouchableOpacity onPress={()=>setAccountType('Non-Tunai')} className={`px-4 py-2 rounded-full border ${accountType==='Non-Tunai' ? 'bg-blue-600 border-blue-600' : 'bg-slate-800 border-slate-700'}`}><Text className="text-white">Non-Tunai</Text></TouchableOpacity>
                </View>
                <TouchableOpacity onPress={handleSaveAccount} className="bg-blue-600 p-3 rounded-xl w-full items-center mb-2"><Text className="text-white font-bold">Simpan</Text></TouchableOpacity>
                {editAccountModalVisible && ( <TouchableOpacity onPress={handleDeleteAccount} className="bg-rose-900/50 p-3 rounded-xl w-full items-center mt-2 border border-rose-900"><Text className="text-rose-400 font-bold">Hapus Dompet Ini</Text></TouchableOpacity> )}
                <TouchableOpacity onPress={() => {setAccountModalVisible(false); setEditAccountModalVisible(false);}} className="mt-4"><Text className="text-slate-500">Batal</Text></TouchableOpacity>
            </View>
        </View>
      </Modal>

      <Modal visible={categoryModalVisible} animationType="fade" transparent>
        <View className="flex-1 justify-center items-center bg-black/80">
            <View className="w-[85%] bg-slate-900 p-6 rounded-2xl items-center border border-slate-800">
                <Text className="text-xl font-bold mb-4 text-white">Kelola Kategori</Text>
                <View className="flex-row gap-2 mb-4 w-full">
                    <TextInput placeholder="Nama Kategori" placeholderTextColor="#64748b" className="bg-slate-800 text-white border border-slate-700 p-3 rounded-xl flex-1" value={newCategoryName} onChangeText={setNewCategoryName}/>
                    <TouchableOpacity onPress={addNewCategory} className="bg-blue-600 p-3 rounded-xl justify-center"><Text className="text-white">Tambah</Text></TouchableOpacity>
                </View>
                <ScrollView className="max-h-60 w-full mb-4">
                    {categories.map(c => (
                        <View key={c.id} className="flex-row justify-between p-3 border-b border-slate-800 items-center">
                            <Text className="text-slate-300">{c.name}</Text>
                            <TouchableOpacity onPress={()=>deleteCategory(c.id)}><Text className="text-rose-400 text-xs">Hapus</Text></TouchableOpacity>
                        </View>
                    ))}
                </ScrollView>
                <TouchableOpacity onPress={() => setCategoryModalVisible(false)} className="mt-2"><Text className="text-slate-500">Tutup</Text></TouchableOpacity>
            </View>
        </View>
      </Modal>
    </View>
  );
}