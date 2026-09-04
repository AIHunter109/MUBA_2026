import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';

export type AppLanguage = 'en' | 'ms' | 'zh' | 'es' | 'hi' | 'ar' | 'fr' | 'pt' | 'ru' | 'id';

export const LANGUAGES: ReadonlyArray<{ code: AppLanguage; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'ms', label: 'Bahasa Melayu' },
  { code: 'zh', label: '中文（简体）' },
  { code: 'es', label: 'Español' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ar', label: 'العربية' },
  { code: 'fr', label: 'Français' },
  { code: 'pt', label: 'Português' },
  { code: 'ru', label: 'Русский' },
  { code: 'id', label: 'Bahasa Indonesia' },
];

const LANGUAGE_KEY = 'remitguard.language';

const translations: Record<AppLanguage, Partial<Record<string, string>>> = {
  en: {
    home: 'Home', send: 'Send', recipients: 'Recipients', history: 'History', settings: 'Settings',
    safetyActive: 'Safety layer active', reviewEveryTransfer: 'Review every transfer before money moves.',
    walletNetwork: 'Wallet and network', suiTestnetWallet: 'Sui testnet wallet', requestGas: 'Request testnet SUI for gas',
    language: 'Language', languageDetail: 'Choose the language used throughout RemitGuard.',
    english: 'English', malay: 'Bahasa Melayu',
    transactionHistory: 'Transaction history', historySubtitle: 'Review verified payments and their on-chain receipts.',
    historyEmpty: 'Your payment history will appear here', historyDetail: 'Completed transfers, safety checks, request IDs, and Sui transaction digests will be listed in this view.', refreshHistory: 'Refresh history',
    recipientsSubtitle: 'Manage saved wallets and trust status before sending.', recipientsEmpty: 'No saved recipients yet', recipientsDetail: 'Add a trusted family member or recipient so natural-language instructions can resolve their wallet.', addRecipient: 'Add recipient',
    recipientsNote: 'Recipient management is a placeholder. The final version will validate addresses and store trusted-recipient preferences.',
    signInDescription: 'Sign in with Google to create your self-custodial Sui wallet. You review every transfer before any money moves.', continueGoogle: 'Continue with Google', demoMode: 'Demo mode',
    sendTitle: 'Send', sendSubtitle: 'Choose an asset, enter a recipient and amount.', recipientAddress: 'Recipient Sui address', testAddress: 'Fill a throwaway test address', amount: 'Amount', sending: 'Submitting...', sendMoney: 'Send',
    gasNote: 'Sending SUI also spends a little SUI on gas.', sendBuildNote: 'This build signs and submits directly from the app. Backend confirmation, sponsorship, and the AI safety review come in later phases.',
    transferSettled: 'Transfer settled', transferFailed: 'Transfer failed on chain', sentTo: 'sent to', transactionDigest: 'Transaction digest', explorer: 'View on explorer', sendAnother: 'Send another',
    remittanceDesk: 'Your remittance desk', goodToSee: 'Good to see you, {name}', dashboardDescription: 'Plan, review, and send support across borders with confidence.', safetyOn: 'Safety on',
    availableBalance: 'Available balance', balanceDescription: 'Ready for your next transfer', availableToSend: 'Available to send', networkGas: 'Network gas',
    balanceUnavailable: 'Balance service unavailable. Pull down to retry.', publicAddress: 'Your public Sui address', publicAddressNote: 'Share this address to receive testnet SUI or USDC. Never share a private key.', receive: 'Receive',
    recentTransactions: 'Recent transactions', viewAll: 'View all', noTransactions: 'No transactions yet', firstTransfer: 'Your first confirmed transfer will show up here.',
    upcomingPayments: 'Upcoming payments', noUpcoming: 'No upcoming payments', recurringPlans: 'Your confirmed recurring plans will appear here.',
    thisMonth: 'This month', paymentSummary: 'Payment summary', noMonthTransactions: 'No transactions this month', monthlyTotals: 'Your monthly totals will appear after your first transfer.',
    sentThisMonth: 'Sent this month', last7Days: 'Last 7 days', suiChartNote: 'SUI transfers are listed above and aren’t combined with the USDC spending chart.',
    aiInsight: 'RemitGuard AI insight', aiInsightText: 'AI safety check is ready. No transfer currently requires a heuristic risk review.', signOut: 'Sign out',
    signIn: 'Sign in', realGoogleDemo: 'Real Google zkLogin runs on web for now. On this device, sign-in creates a local testnet wallet with no Google account.', enokiNotConfigured: 'Enoki is not configured, so sign-in creates a local testnet wallet with no Google account.',
    balanceLoadError: 'Could not load balances. Pull to retry.', suiTestnet: 'Sui testnet', receiveUsdc: 'Receive USDC', demoSessionNotice: 'Demo session. This wallet was generated locally on this device and is not linked to a Google account.',
    sentToRecipient: 'Sent to {recipient}', invalidAmount: 'Invalid amount.', transferFailedMessage: 'The transfer failed.', unknownError: 'Unknown error.',
    settingsSubtitle: 'Configure approval safeguards and account preferences.', testnetSuiRequested: 'Testnet SUI requested. It should arrive in a few seconds.', faucetRequestFailed: 'Faucet request failed.',
    veriplan: 'VeriPlan', veriplanDetail: 'Plan your budget before setting up recurring remittances. Describe your income, essential expenses, savings target, and family support, and budget analysis will help explain payment affordability.', createPlan: 'Create a plan',
    guardians: 'Guardians', guardiansDetail: 'Trusted people who can provide a second approval for high-value or high-risk payments.', addGuardian: 'Add guardian', paymentPolicies: 'Payment policies', paymentPoliciesDetail: 'Set thresholds and rules for new recipients, changed wallets, and second-person approval.', addPolicy: 'Add policy', settingsPlaceholderNote: 'VeriPlan, guardians, and payment policies are visual placeholders. Their connected workflows will be available in later phases.',
    historyLoadError: 'Could not load transaction history. Pull down to try again.', receivedFrom: 'Received from {sender}', unknownSender: 'Unknown sender',
  },
  ms: {
    home: 'Utama', send: 'Hantar', recipients: 'Penerima', history: 'Sejarah', settings: 'Tetapan',
    safetyActive: 'Lapisan keselamatan aktif', reviewEveryTransfer: 'Semak setiap pindahan sebelum wang dihantar.',
    walletNetwork: 'Dompet dan rangkaian', suiTestnetWallet: 'Dompet Sui testnet', requestGas: 'Minta SUI testnet untuk gas',
    language: 'Bahasa', languageDetail: 'Pilih bahasa yang digunakan dalam RemitGuard.', english: 'English', malay: 'Bahasa Melayu',
    transactionHistory: 'Sejarah transaksi', historySubtitle: 'Semak pembayaran yang disahkan dan resit rantaian mereka.',
    historyEmpty: 'Sejarah pembayaran anda akan dipaparkan di sini', historyDetail: 'Pindahan selesai, semakan keselamatan, ID permintaan dan ringkasan transaksi Sui akan disenaraikan di sini.', refreshHistory: 'Muat semula sejarah',
    recipientsSubtitle: 'Urus dompet simpanan dan status kepercayaan sebelum menghantar.', recipientsEmpty: 'Belum ada penerima disimpan', recipientsDetail: 'Tambah ahli keluarga atau penerima yang dipercayai supaya arahan bahasa semula jadi dapat mengenal pasti dompet mereka.', addRecipient: 'Tambah penerima',
    recipientsNote: 'Pengurusan penerima masih ruang letak. Versi akhir akan mengesahkan alamat dan menyimpan pilihan penerima dipercayai.',
    signInDescription: 'Log masuk dengan Google untuk mencipta dompet Sui jagaan sendiri. Anda menyemak setiap pindahan sebelum wang dihantar.', continueGoogle: 'Teruskan dengan Google', demoMode: 'Mod demo',
    sendTitle: 'Hantar', sendSubtitle: 'Pilih aset, masukkan penerima dan amaun.', recipientAddress: 'Alamat Sui penerima', testAddress: 'Isi alamat ujian sementara', amount: 'Amaun', sending: 'Menghantar...', sendMoney: 'Hantar',
    gasNote: 'Menghantar SUI juga menggunakan sedikit SUI untuk gas.', sendBuildNote: 'Versi ini menandatangani dan menghantar terus daripada aplikasi. Pengesahan backend, tajaan dan semakan keselamatan AI akan ditambah kemudian.',
    transferSettled: 'Pindahan selesai', transferFailed: 'Pindahan gagal pada rantaian', sentTo: 'dihantar kepada', transactionDigest: 'Ringkasan transaksi', explorer: 'Lihat dalam penjelajah', sendAnother: 'Hantar lagi',
    remittanceDesk: 'Pusat kiriman wang anda', goodToSee: 'Selamat datang, {name}', dashboardDescription: 'Rancang, semak dan hantar sokongan merentas sempadan dengan yakin.', safetyOn: 'Keselamatan aktif',
    availableBalance: 'Baki tersedia', balanceDescription: 'Sedia untuk pindahan anda yang seterusnya', availableToSend: 'Sedia dihantar', networkGas: 'Gas rangkaian',
    balanceUnavailable: 'Perkhidmatan baki tidak tersedia. Tarik ke bawah untuk cuba lagi.', publicAddress: 'Alamat Sui awam anda', publicAddressNote: 'Kongsi alamat ini untuk menerima SUI atau USDC testnet. Jangan sekali-kali kongsi kunci peribadi.', receive: 'Terima',
    recentTransactions: 'Transaksi terkini', viewAll: 'Lihat semua', noTransactions: 'Belum ada transaksi', firstTransfer: 'Pindahan pertama yang disahkan akan dipaparkan di sini.',
    upcomingPayments: 'Pembayaran akan datang', noUpcoming: 'Tiada pembayaran akan datang', recurringPlans: 'Pelan berulang yang disahkan akan dipaparkan di sini.',
    thisMonth: 'Bulan ini', paymentSummary: 'Ringkasan pembayaran', noMonthTransactions: 'Tiada transaksi bulan ini', monthlyTotals: 'Jumlah bulanan akan dipaparkan selepas pindahan pertama anda.',
    sentThisMonth: 'Dihantar bulan ini', last7Days: '7 hari terakhir', suiChartNote: 'Pindahan SUI disenaraikan di atas dan tidak digabungkan dalam carta perbelanjaan USDC.',
    aiInsight: 'Pandangan RemitGuard AI', aiInsightText: 'Semakan keselamatan AI sudah sedia. Tiada pindahan memerlukan semakan risiko heuristik buat masa ini.', signOut: 'Log keluar',
    signIn: 'Log masuk', realGoogleDemo: 'Google zkLogin sebenar berjalan di web buat masa ini. Pada peranti ini, log masuk mencipta dompet testnet tempatan tanpa akaun Google.', enokiNotConfigured: 'Enoki tidak dikonfigurasikan, jadi log masuk mencipta dompet testnet tempatan tanpa akaun Google.',
    balanceLoadError: 'Tidak dapat memuatkan baki. Tarik ke bawah untuk cuba lagi.', suiTestnet: 'Sui testnet', receiveUsdc: 'Terima USDC', demoSessionNotice: 'Sesi demo. Dompet ini dijana secara tempatan pada peranti ini dan tidak disambungkan kepada akaun Google.',
    sentToRecipient: 'Dihantar kepada {recipient}', invalidAmount: 'Amaun tidak sah.', transferFailedMessage: 'Pindahan gagal.', unknownError: 'Ralat tidak diketahui.',
    settingsSubtitle: 'Konfigurasikan langkah perlindungan kelulusan dan pilihan akaun.', testnetSuiRequested: 'SUI testnet telah diminta. Ia sepatutnya tiba dalam beberapa saat.', faucetRequestFailed: 'Permintaan faucet gagal.',
    veriplan: 'VeriPlan', veriplanDetail: 'Rancang belanjawan anda sebelum menetapkan kiriman wang berulang. Huraikan pendapatan, perbelanjaan penting, sasaran simpanan dan sokongan keluarga anda, dan analisis belanjawan akan membantu menerangkan kemampuan pembayaran.', createPlan: 'Cipta pelan',
    guardians: 'Penjaga', guardiansDetail: 'Orang yang dipercayai yang boleh memberikan kelulusan kedua untuk pembayaran bernilai tinggi atau berisiko tinggi.', addGuardian: 'Tambah penjaga', paymentPolicies: 'Dasar pembayaran', paymentPoliciesDetail: 'Tetapkan ambang dan peraturan untuk penerima baharu, dompet yang berubah dan kelulusan orang kedua.', addPolicy: 'Tambah dasar', settingsPlaceholderNote: 'VeriPlan, penjaga dan dasar pembayaran ialah ruang letak visual. Aliran kerja yang disambungkan akan tersedia dalam fasa seterusnya.',
    historyLoadError: 'Tidak dapat memuatkan sejarah transaksi. Tarik ke bawah untuk cuba lagi.', receivedFrom: 'Diterima daripada {sender}', unknownSender: 'Pengirim tidak diketahui',
  },
  zh: { home: '首页', send: '发送', recipients: '收款人', history: '记录', settings: '设置', language: '语言', languageDetail: '选择 RemitGuard 的显示语言。', walletNetwork: '钱包和网络', sendTitle: '发送', transactionHistory: '交易记录', recentTransactions: '最近交易', thisMonth: '本月', upcomingPayments: '即将付款', signOut: '退出登录', continueGoogle: '使用 Google 继续', availableBalance: '可用余额', publicAddress: '您的公开 Sui 地址' },
  es: { home: 'Inicio', send: 'Enviar', recipients: 'Destinatarios', history: 'Historial', settings: 'Ajustes', language: 'Idioma', languageDetail: 'Elige el idioma de RemitGuard.', walletNetwork: 'Cartera y red', sendTitle: 'Enviar', transactionHistory: 'Historial de transacciones', recentTransactions: 'Transacciones recientes', thisMonth: 'Este mes', upcomingPayments: 'Próximos pagos', signOut: 'Cerrar sesión', continueGoogle: 'Continuar con Google', availableBalance: 'Saldo disponible', publicAddress: 'Tu dirección pública de Sui' },
  hi: { home: 'होम', send: 'भेजें', recipients: 'प्राप्तकर्ता', history: 'इतिहास', settings: 'सेटिंग्स', language: 'भाषा', languageDetail: 'RemitGuard की भाषा चुनें।', walletNetwork: 'वॉलेट और नेटवर्क', sendTitle: 'भेजें', transactionHistory: 'लेन-देन इतिहास', recentTransactions: 'हाल के लेन-देन', thisMonth: 'इस महीने', upcomingPayments: 'आगामी भुगतान', signOut: 'साइन आउट', continueGoogle: 'Google से जारी रखें', availableBalance: 'उपलब्ध शेष', publicAddress: 'आपका सार्वजनिक Sui पता' },
  ar: { home: 'الرئيسية', send: 'إرسال', recipients: 'المستلمون', history: 'السجل', settings: 'الإعدادات', language: 'اللغة', languageDetail: 'اختر لغة RemitGuard.', walletNetwork: 'المحفظة والشبكة', sendTitle: 'إرسال', transactionHistory: 'سجل المعاملات', recentTransactions: 'المعاملات الأخيرة', thisMonth: 'هذا الشهر', upcomingPayments: 'المدفوعات القادمة', signOut: 'تسجيل الخروج', continueGoogle: 'المتابعة باستخدام Google', availableBalance: 'الرصيد المتاح', publicAddress: 'عنوان Sui العام الخاص بك' },
  fr: { home: 'Accueil', send: 'Envoyer', recipients: 'Destinataires', history: 'Historique', settings: 'Réglages', language: 'Langue', languageDetail: 'Choisissez la langue de RemitGuard.', walletNetwork: 'Portefeuille et réseau', sendTitle: 'Envoyer', transactionHistory: 'Historique des transactions', recentTransactions: 'Transactions récentes', thisMonth: 'Ce mois-ci', upcomingPayments: 'Paiements à venir', signOut: 'Se déconnecter', continueGoogle: 'Continuer avec Google', availableBalance: 'Solde disponible', publicAddress: 'Votre adresse Sui publique' },
  pt: { home: 'Início', send: 'Enviar', recipients: 'Destinatários', history: 'Histórico', settings: 'Definições', language: 'Idioma', languageDetail: 'Escolha o idioma do RemitGuard.', walletNetwork: 'Carteira e rede', sendTitle: 'Enviar', transactionHistory: 'Histórico de transações', recentTransactions: 'Transações recentes', thisMonth: 'Este mês', upcomingPayments: 'Próximos pagamentos', signOut: 'Terminar sessão', continueGoogle: 'Continuar com Google', availableBalance: 'Saldo disponível', publicAddress: 'O seu endereço Sui público' },
  ru: { home: 'Главная', send: 'Отправить', recipients: 'Получатели', history: 'История', settings: 'Настройки', language: 'Язык', languageDetail: 'Выберите язык RemitGuard.', walletNetwork: 'Кошелёк и сеть', sendTitle: 'Отправить', transactionHistory: 'История операций', recentTransactions: 'Недавние операции', thisMonth: 'В этом месяце', upcomingPayments: 'Предстоящие платежи', signOut: 'Выйти', continueGoogle: 'Продолжить с Google', availableBalance: 'Доступный баланс', publicAddress: 'Ваш публичный адрес Sui' },
  id: { home: 'Beranda', send: 'Kirim', recipients: 'Penerima', history: 'Riwayat', settings: 'Pengaturan', language: 'Bahasa', languageDetail: 'Pilih bahasa yang digunakan di RemitGuard.', walletNetwork: 'Dompet dan jaringan', sendTitle: 'Kirim', transactionHistory: 'Riwayat transaksi', recentTransactions: 'Transaksi terbaru', thisMonth: 'Bulan ini', upcomingPayments: 'Pembayaran mendatang', signOut: 'Keluar', continueGoogle: 'Lanjutkan dengan Google', availableBalance: 'Saldo tersedia', publicAddress: 'Alamat Sui publik Anda' },
};

type I18nValue = { language: AppLanguage; setLanguage: (language: AppLanguage) => Promise<void>; t: (key: string, values?: Record<string, string>) => string };
const I18nContext = createContext<I18nValue | undefined>(undefined);

function getWebStorage(): Storage | null {
  return Platform.OS === 'web' && typeof localStorage !== 'undefined' ? localStorage : null;
}

export function I18nProvider({ children }: PropsWithChildren) {
  const [language, setCurrentLanguage] = useState<AppLanguage>('en');

  useEffect(() => {
    const storage = getWebStorage();
    (storage ? Promise.resolve(storage.getItem(LANGUAGE_KEY)) : SecureStore.getItemAsync(LANGUAGE_KEY))
      .then((saved) => { if (LANGUAGES.some((item) => item.code === saved)) setCurrentLanguage(saved as AppLanguage); })
      .catch(() => undefined);
  }, []);

  const setLanguage = useCallback(async (next: AppLanguage) => {
    setCurrentLanguage(next);
    const storage = getWebStorage();
    if (storage) storage.setItem(LANGUAGE_KEY, next);
    else await SecureStore.setItemAsync(LANGUAGE_KEY, next, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
  }, []);

  const value = useMemo<I18nValue>(() => ({
    language, setLanguage,
    t: (key, values) => Object.entries(values ?? {}).reduce((text, [name, replacement]) => text.replace(`{${name}}`, replacement), translations[language][key] ?? translations.en[key] ?? key),
  }), [language, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within I18nProvider');
  return context;
}
