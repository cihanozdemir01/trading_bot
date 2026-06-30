import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Linking,
  Modal
} from 'react-native';
import {
  CURRENT_APP_VERSION,
  checkForAppUpdates,
  preventVersionConflicts
} from './services/UpdateService';

export default function App() {
  // Aktif Modül Yönetimi ('home', 'backtest_module', 'live_module', 'signal_module')
  const [currentModule, setCurrentModule] = useState('home');
  
  // Backtest Modülü İçinde Tab Yönetimi ('strategy', 'ai', 'history')
  const [activeTab, setActiveTab] = useState('strategy');
  
  const [loading, setLoading] = useState(false);
  const [progressStatus, setProgressStatus] = useState('');
  const [progressPct, setProgressPct] = useState(0);

  // Sunucu Bağlantı Adresi
  const [serverUrl, setServerUrl] = useState('https://trading-bot-33es.onrender.com');
  const [tempServerUrl, setTempServerUrl] = useState('https://trading-bot-33es.onrender.com');
  const [showServerModal, setShowServerModal] = useState(false);

  // Canlı Piyasa Top 5 Kripto Para Verileri
  const [top5Tickers, setTop5Tickers] = useState([]);
  const [loadingTickers, setLoadingTickers] = useState(false);

  // CANLI İŞLEM MODÜLÜ STATE'LERİ
  const [isBotActive, setIsBotActive] = useState(false);
  const [liveBalance, setLiveBalance] = useState(1000.0);
  const [binanceApiKey, setBinanceApiKey] = useState('');
  const [binanceSecretKey, setBinanceSecretKey] = useState('');
  const [useTestnet, setUseTestnet] = useState(true);
  const [showBinanceModal, setShowBinanceModal] = useState(false);
  const [livePositions, setLivePositions] = useState([]);
  const [liveLogs, setLiveLogs] = useState([]);
  const [loadingLive, setLoadingLive] = useState(false);

  // SİNYAL MODÜLÜ STATE'LERİ
  const availableScanCoins = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'AVAX/USDT', 'DOGE/USDT'];
  const [selectedScanCoins, setSelectedScanCoins] = useState(['BTC/USDT', 'ETH/USDT', 'SOL/USDT']);
  const [scanInterval, setScanInterval] = useState('1h');
  const [autoScanActive, setAutoScanActive] = useState(false);
  const [scanResults, setScanResults] = useState([]);
  const [scanning, setScanning] = useState(false);

  // Telegram Kimlik Bilgileri
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [showTelegramModal, setShowTelegramModal] = useState(false);

  // Timers Refs
  const autoScanTimerRef = useRef(null);
  const liveModuleTimerRef = useRef(null);

  // Güncelleme Modal & Durumları
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Portföy & Risk Parametreleri
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState('1h');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('');
  const [balance, setBalance] = useState('1000');
  const [posPct, setPosPct] = useState('10');
  const [maxPos, setMaxPos] = useState('3');
  const [slPct, setSlPct] = useState('1.5');
  const [tpPct, setTpPct] = useState('3.0');

  // STRATEJİ KRİTERLERİ STATE'LERİ
  const [useRsi, setUseRsi] = useState(true);
  const [rsiOp, setRsiOp] = useState('less');
  const [rsiVal1, setRsiVal1] = useState('35');
  const [rsiVal2, setRsiVal2] = useState('70');

  const [useMacd, setUseMacd] = useState(true);
  const [macdCross, setMacdCross] = useState('bullish');
  const [macdZero, setMacdZero] = useState('any');

  const [useEma50200, setUseEma50200] = useState(false);
  const [ema50200Cross, setEma50200Cross] = useState('bullish');

  const [useEma2050, setUseEma2050] = useState(false);
  const [ema2050Cross, setEma2050Cross] = useState('bullish');

  const [useEmaPrice, setUseEmaPrice] = useState(true);
  const [emaPriceFilter, setEmaPriceFilter] = useState('above_ema50');
  const [showEmaPriceModal, setShowEmaPriceModal] = useState(false);

  const emaPriceOptions = [
    { label: 'Fiyat > EMA 50 (Yükseliş Trendi)', value: 'above_ema50' },
    { label: 'Fiyat < EMA 50 (Düşüş Trendi)', value: 'below_ema50' },
    { label: 'Fiyat > EMA 20', value: 'above_ema20' },
    { label: 'Fiyat < EMA 20', value: 'below_ema20' },
    { label: 'Fiyat > EMA 100', value: 'above_ema100' },
    { label: 'Fiyat < EMA 100', value: 'below_ema100' },
    { label: 'Fiyat > EMA 200', value: 'above_ema200' },
    { label: 'Fiyat < EMA 200', value: 'below_ema200' },
  ];

  // Test Sonuçları Verisi
  const [backtestResult, setBacktestResult] = useState({
    final_balance: 1000.0,
    initial_balance: 1000.0,
    total_return_pct: 0.0,
    win_rate: 0.0,
    total_trades: 0,
    max_drawdown_pct: 0.0,
    trades: [],
    ai_advice: ["💡 Test butonuna bastığınızda yapay zeka analiz raporu burada görüntülenecektir."]
  });

  // AI Konsolu
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    preventVersionConflicts();
    checkUpdates();
    fetchTop5Tickers();
  }, []);

  // Otomatik Tarama Polling Effect
  useEffect(() => {
    if (autoScanActive) {
      runEnvelopeSignalScan();
      autoScanTimerRef.current = setInterval(() => {
        runEnvelopeSignalScan();
      }, 30000);
    } else {
      if (autoScanTimerRef.current) clearInterval(autoScanTimerRef.current);
    }
    return () => {
      if (autoScanTimerRef.current) clearInterval(autoScanTimerRef.current);
    };
  }, [autoScanActive, selectedScanCoins, scanInterval]);

  // Canlı İşlemler Polling Effect
  useEffect(() => {
    if (currentModule === 'live_module') {
      fetchLiveTradingData();
      liveModuleTimerRef.current = setInterval(() => {
        fetchLiveTradingData();
      }, 8000);
    } else {
      if (liveModuleTimerRef.current) clearInterval(liveModuleTimerRef.current);
    }
    return () => {
      if (liveModuleTimerRef.current) clearInterval(liveModuleTimerRef.current);
    };
  }, [currentModule, isBotActive]);

  const fetchLiveTradingData = async () => {
    try {
      const cleanServerUrl = serverUrl.trim().replace(/\/$/, '');
      
      // 1. Canlı Bakiye & Sağlık Durumu
      const healthRes = await fetch(`${cleanServerUrl}/health`);
      const healthData = await healthRes.json();
      setLiveBalance(healthData.balance_usdt || 1000.0);

      // 2. Canlı Pozisyonlar
      const posRes = await fetch(`${cleanServerUrl}/live/positions`);
      const posData = await posRes.json();
      setLivePositions(posData.positions || []);

      // 3. Canlı Emir Logları
      const orderRes = await fetch(`${cleanServerUrl}/live/orders`);
      const orderData = await orderRes.json();
      setLiveLogs(orderData.logs || []);

    } catch (e) {
      console.log("Canlı işlem veri çekme hatası:", e);
    }
  };

  const saveBinanceConfig = async () => {
    if (!binanceApiKey.trim() || !binanceSecretKey.trim()) {
      Alert.alert("Eksik Bilgi", "Lütfen API Key ve Secret Key alanlarını doldurun.");
      return;
    }
    setLoadingLive(true);
    try {
      const cleanServerUrl = serverUrl.trim().replace(/\/$/, '');
      const response = await fetch(`${cleanServerUrl}/config/binance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: binanceApiKey.trim(),
          secret_key: binanceSecretKey.trim(),
          use_testnet: useTestnet
        })
      });
      const data = await response.json();
      if (data.status === 'success') {
        setShowBinanceModal(false);
        setLiveBalance(data.balance);
        Alert.alert("Bağlantı Başarılı! ⚡", `Binance API anahtarı doğrulandı. Kullanılabilir Bakiye: ${data.balance} USDT`);
        fetchLiveTradingData();
      } else {
        Alert.alert("Bağlantı Başarısız", "API Anahtarı doğrulanamadı.");
      }
    } catch (e) {
      Alert.alert("Hata", "Sunucuya bağlanırken hata oluştu.");
    } finally {
      setLoadingLive(false);
    }
  };

  const toggleCoinSelection = (coin) => {
    if (selectedScanCoins.includes(coin)) {
      if (selectedScanCoins.length > 1) {
        setSelectedScanCoins(selectedScanCoins.filter(c => c !== coin));
      } else {
        Alert.alert("Uyarı", "En az 1 adet kripto para seçili olmalıdır.");
      }
    } else {
      setSelectedScanCoins([...selectedScanCoins, coin]);
    }
  };

  const runEnvelopeSignalScan = async () => {
    setScanning(true);
    try {
      const cleanServerUrl = serverUrl.trim().replace(/\/$/, '');
      const response = await fetch(`${cleanServerUrl}/signal/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: selectedScanCoins,
          interval: scanInterval,
          bot_token: telegramToken,
          chat_id: telegramChatId
        })
      });
      const data = await response.json();
      setScanResults(data.all_results || []);
    } catch (e) {
      console.log("Sinyal tarama hatası:", e);
    } finally {
      setScanning(false);
    }
  };

  const saveTelegramConfig = async () => {
    if (!telegramToken.trim() || !telegramChatId.trim()) {
      Alert.alert("Eksik Bilgi", "Lütfen Telegram Bot Token ve Chat ID alanlarını doldurun.");
      return;
    }
    try {
      const cleanServerUrl = serverUrl.trim().replace(/\/$/, '');
      const response = await fetch(`${cleanServerUrl}/config/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_token: telegramToken.trim(),
          chat_id: telegramChatId.trim()
        })
      });
      const data = await response.json();
      if (data.message_sent) {
        setShowTelegramModal(false);
        Alert.alert("Bağlantı Başarılı! 🎉", "Telegram doğrulama mesajı gruba/kanala iletildi.");
      } else {
        Alert.alert("Bağlantı Başarısız", "Telegram bilgileri doğrulanamadı.");
      }
    } catch (e) {
      Alert.alert("Hata", "Sunucuya bağlanırken hata oluştu.");
    }
  };

  const fetchTop5Tickers = async () => {
    setLoadingTickers(true);
    try {
      const cleanServerUrl = serverUrl.trim().replace(/\/$/, '');
      const response = await fetch(`${cleanServerUrl}/ticker/top5`);
      const data = await response.json();
      setTop5Tickers(data);
    } catch (e) {
      console.log("Top 5 ticker hatası:", e);
    } finally {
      setLoadingTickers(false);
    }
  };

  const checkUpdates = async () => {
    const info = await checkForAppUpdates();
    if (info && info.hasUpdate) {
      setUpdateInfo(info);
      setShowUpdateModal(true);
    }
  };

  const runBacktest = async () => {
    setLoading(true);
    setProgressPct(10);
    setProgressStatus('⏳ Binance Verileri Çekiliyor...');

    const timer = setInterval(() => {
      setProgressPct((prev) => {
        if (prev < 85) {
          const next = prev + 15;
          if (next >= 40 && next < 70) setProgressStatus('⚙️ İndikatörler Hesaplanıyor...');
          else if (next >= 70) setProgressStatus('📊 Risk & PnL Analizi Yapılıyor...');
          return next;
        }
        return prev;
      });
    }, 200);

    try {
      const cleanServerUrl = serverUrl.trim().replace(/\/$/, '');
      let url = `${cleanServerUrl}/backtest?symbol=${symbol}&interval=${interval}&limit=1000`;
      if (startDate.trim()) url += `&start_date=${startDate.trim()}`;
      if (endDate.trim()) url += `&end_date=${endDate.trim()}`;

      url += `&initial_balance=${balance}&position_pct=${posPct}&max_open_positions=${maxPos}`;
      url += `&use_rsi=${useRsi}&use_macd=${useMacd}&use_ema_50_200=${useEma50200}&use_ema_20_50=${useEma2050}&use_ema_price=${useEmaPrice}`;
      url += `&rsi_op=${rsiOp}&rsi_val1=${rsiVal1}&rsi_val2=${rsiVal2}`;
      url += `&macd_cross=${macdCross}&macd_zero=${macdZero}`;
      url += `&ema_50_200_cross=${ema50200Cross}&ema_20_50_cross=${ema2050Cross}&ema_price_filter=${emaPriceFilter}&sl_pct=${slPct}&tp_pct=${tpPct}`;

      const response = await fetch(url);
      const data = await response.json();

      clearInterval(timer);
      setProgressPct(100);
      setProgressStatus('✅ Test Tamamlandı!');
      setBacktestResult(data);
    } catch (error) {
      clearInterval(timer);
      Alert.alert(
        'Bağlantı Hatası',
        `Backend sunucusuna bağlanılamadı (${serverUrl}).\n\nHata: ` + error.message
      );
    } finally {
      setTimeout(() => {
        setLoading(false);
      }, 500);
    }
  };

  const askAIConsult = async (queryText) => {
    setAiQuery(queryText);
    setAiLoading(true);
    setAiResponse('⏳ Derin yapay zeka analiz motoru veri üretiyor...');

    try {
      const cleanServerUrl = serverUrl.trim().replace(/\/$/, '');
      const response = await fetch(`${cleanServerUrl}/ai-consult`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_query: queryText,
          symbol: symbol,
          interval: interval,
          win_rate: backtestResult.win_rate || 0,
          profit_factor: backtestResult.profit_factor || 0,
          total_trades: backtestResult.total_trades || 0,
          max_drawdown: backtestResult.max_drawdown_pct || 0
        })
      });
      const data = await response.json();
      setAiResponse(data.reply);
    } catch (e) {
      setAiResponse('❌ AI Danışmanına bağlanırken hata oluştu.');
    } finally {
      setAiLoading(false);
    }
  };

  const saveServerUrl = () => {
    setServerUrl(tempServerUrl);
    setShowServerModal(false);
    Alert.alert('Sunucu Güncellendi', `Yeni sunucu adresi kaydedildi:\n${tempServerUrl}`);
    fetchTop5Tickers();
  };

  const pnlNet = backtestResult.final_balance - backtestResult.initial_balance;
  const selectedEmaLabel = emaPriceOptions.find(o => o.value === emaPriceFilter)?.label || emaPriceFilter;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* ÜST BAŞLIK & SUNUCU ROZETLERİ */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <View style={styles.logoIcon}>
            <Text style={{ fontSize: 20 }}>📊</Text>
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.appTitle}>AlgoTrade Mobile</Text>
              <View style={styles.versionBadge}>
                <Text style={styles.versionText}>v{CURRENT_APP_VERSION}</Text>
              </View>
            </View>
            <Text style={styles.appSubTitle}>Profesyonel Kantitatif Ticaret</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.liveBadge}
          onPress={() => {
            setTempServerUrl(serverUrl);
            setShowServerModal(true);
          }}
        >
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>🌐 Render Canlı</Text>
        </TouchableOpacity>
      </View>

      {/* GÜNCELLEME UYARI BARI */}
      {updateInfo && updateInfo.hasUpdate && (
        <TouchableOpacity style={styles.updateNoticeBanner} onPress={() => setShowUpdateModal(true)}>
          <Text style={styles.updateNoticeText}>🚀 Yeni Güncelleme Mevcut! ({updateInfo.latestVersion}) — Yüklemek için dokunun</Text>
        </TouchableOpacity>
      )}

      {/* MODÜL 1: ANA EKRAN */}
      {currentModule === 'home' && (
        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.sectionCard, { borderColor: 'rgba(16, 185, 129, 0.4)' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={[styles.cardTitle, { color: '#10b981', margin: 0 }]}>📈 Canlı Fiyat Doğrulama (İlk 5 Kripto)</Text>
              <TouchableOpacity onPress={fetchTop5Tickers} disabled={loadingTickers}>
                <Text style={{ color: '#818cf8', fontSize: 12, fontWeight: '600' }}>
                  {loadingTickers ? '⏳ Yenileniyor...' : '🔄 Yenile'}
                </Text>
              </TouchableOpacity>
            </View>

            {top5Tickers && top5Tickers.length > 0 ? (
              top5Tickers.map((item, idx) => (
                <View key={idx} style={styles.tickerRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.tickerSymbol}>{item.symbol}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.tickerPrice}>${item.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                    <Text style={[styles.tickerChange, item.change_pct >= 0 ? styles.textGreen : styles.textRed]}>
                      {item.change_pct >= 0 ? '+' : ''}{item.change_pct}%
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <ActivityIndicator color="#10b981" style={{ padding: 15 }} />
            )}
          </View>

          <Text style={{ color: '#f3f4f6', fontSize: 16, fontWeight: '700', marginVertical: 10, paddingLeft: 4 }}>
            🎯 Uygulama Modülleri
          </Text>

          <TouchableOpacity style={styles.moduleCard} onPress={() => setCurrentModule('backtest_module')}>
            <View style={styles.moduleCardHeader}>
              <View style={[styles.moduleIconBox, { backgroundColor: '#6366f1' }]}>
                <Text style={{ fontSize: 24 }}>📊</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.moduleTitle}>Backtest &amp; Strateji Simülatörü</Text>
                <Text style={styles.moduleSubTitle}>Gelişmiş kural setleri, indikatör testleri ve yapay zeka danışmanı</Text>
              </View>
            </View>
            <View style={styles.moduleCardFooter}>
              <Text style={{ color: '#818cf8', fontSize: 13, fontWeight: '700' }}>🚀 Modüle Git ve Stratejiyi İncele →</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.moduleCard, { borderColor: 'rgba(168, 85, 247, 0.5)' }]} onPress={() => setCurrentModule('signal_module')}>
            <View style={styles.moduleCardHeader}>
              <View style={[styles.moduleIconBox, { backgroundColor: '#a855f7' }]}>
                <Text style={{ fontSize: 24 }}>📡</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.moduleTitle}>Canlı Sinyal &amp; Telegram Modülü</Text>
                <Text style={styles.moduleSubTitle}>Envelope (100, 8, 3) volatilite indikatörü ile Telegram canlı sinyal tarayıcısı</Text>
              </View>
            </View>
            <View style={styles.moduleCardFooter}>
              <Text style={{ color: '#c084fc', fontSize: 13, fontWeight: '700' }}>📡 Sinyal Modülüne Git &amp; Tara →</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.moduleCard, { borderColor: 'rgba(245, 158, 11, 0.4)' }]} onPress={() => setCurrentModule('live_module')}>
            <View style={styles.moduleCardHeader}>
              <View style={[styles.moduleIconBox, { backgroundColor: '#f59e0b' }]}>
                <Text style={{ fontSize: 24 }}>⚡</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.moduleTitle}>Canlı Otomatik İşlem Modülü</Text>
                <Text style={styles.moduleSubTitle}>7/24 Binance alım-satım botu, canlı pozisyon ve emir takibi</Text>
              </View>
            </View>
            <View style={styles.moduleCardFooter}>
              <Text style={{ color: '#f59e0b', fontSize: 13, fontWeight: '700' }}>⚡ Canlı Moda Geç ve Botu Yönet →</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* MODÜL 4: CANLI İŞLEM MODÜLÜ DETAY SAYFASI */}
      {currentModule === 'live_module' && (
        <View style={{ flex: 1 }}>
          <View style={styles.moduleNavHeader}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setCurrentModule('home')}>
              <Text style={styles.backBtnText}>⬅️ Ana Modüllere Dön</Text>
            </TouchableOpacity>
            <Text style={{ color: '#f59e0b', fontSize: 14, fontWeight: '700' }}>⚡ Canlı İşlem Modülü</Text>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* BİNANCE API BAĞLANTI DURUMU KARTI */}
            <View style={[styles.sectionCard, { borderColor: 'rgba(245, 158, 11, 0.5)', backgroundColor: 'rgba(245, 158, 11, 0.08)' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: '#f59e0b', margin: 0 }]}>🔑 Binance API Bağlantısı</Text>
                  <Text style={{ color: '#f3f4f6', fontSize: 12, marginTop: 4 }}>
                    Kullanılabilir Bakiye: <Text style={{ color: '#10b981', fontWeight: '800' }}>{liveBalance.toFixed(2)} USDT</Text>
                  </Text>
                </View>
                <TouchableOpacity style={[styles.actionChip, { backgroundColor: '#d97706', borderColor: '#fbbf24' }]} onPress={() => setShowBinanceModal(true)}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>⚙️ API Tanımla</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* BOT AKTİFLİK DURUMU */}
            <View style={[styles.sectionCard, { borderColor: isBotActive ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={styles.cardTitle}>🤖 7/24 Canlı Alım-Satım Botu</Text>
                  <Text style={{ color: isBotActive ? '#10b981' : '#ef4444', fontWeight: '700', fontSize: 13 }}>
                    {isBotActive ? '🟢 AKTİF - Sinyalleri Gerçek Zamanlı İşliyor' : '🔴 PASİF - Otomatik İşlemler Durduruldu'}
                  </Text>
                </View>
                <Switch
                  value={isBotActive}
                  onValueChange={(val) => {
                    setIsBotActive(val);
                    Alert.alert(val ? 'Bot Başlatıldı' : 'Bot Durduruldu', val ? 'Binance 7/24 otomatik ticaret motoru aktif.' : 'Otomatik alım-satım durduruldu.');
                  }}
                  trackColor={{ false: '#374151', true: '#10b981' }}
                />
              </View>
            </View>

            {/* AÇIK CANLI POZİSYONLAR */}
            <View style={styles.sectionCard}>
              <Text style={styles.cardTitle}>💼 Açık Canlı Pozisyonlar ({livePositions.length})</Text>
              {livePositions && livePositions.length > 0 ? (
                livePositions.map((pos, idx) => (
                  <View key={idx} style={[styles.criterionBox, { borderColor: pos.pnl >= 0 ? '#10b981' : '#ef4444' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 14 }}>{pos.symbol}</Text>
                      <Text style={{ color: pos.pnl >= 0 ? '#10b981' : '#ef4444', fontWeight: '800', fontSize: 14 }}>
                        {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)} ({pos.pnl_pct.toFixed(2)}%)
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                      <Text style={{ color: '#9ca3af', fontSize: 11 }}>Büyüklük: {pos.size}</Text>
                      <Text style={{ color: '#9ca3af', fontSize: 11 }}>Giriş: ${pos.entry_price}</Text>
                      <Text style={{ color: '#9ca3af', fontSize: 11 }}>Güncel: ${pos.mark_price}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={{ color: '#9ca3af', textAlign: 'center', padding: 20 }}>
                  ⚠️ Aktif açık pozisyon bulunmuyor.
                </Text>
              )}
            </View>

            {/* CANLI EMİR LOGLARI */}
            <View style={[styles.sectionCard, { borderColor: 'rgba(255,255,255,0.08)' }]}>
              <Text style={styles.cardTitle}>📋 Bot İşlem Günlüğü (Canlı Loglar)</Text>
              <ScrollView style={{ maxHeight: 200, backgroundColor: '#090d16', padding: 10, borderRadius: 8 }}>
                {liveLogs && liveLogs.length > 0 ? (
                  liveLogs.map((log, idx) => (
                    <Text key={idx} style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4, fontFamily: 'monospace' }}>
                      {log}
                    </Text>
                  ))
                ) : (
                  <Text style={{ color: '#6b7280', fontSize: 11, textAlign: 'center' }}>Günlük log kaydı bulunmuyor.</Text>
                )}
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      )}

      {/* MODÜL 2: CANLI SİNYAL & TELEGRAM MODÜLÜ DETAY SAYFASI */}
      {currentModule === 'signal_module' && (
        <View style={{ flex: 1 }}>
          <View style={styles.moduleNavHeader}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setCurrentModule('home')}>
              <Text style={styles.backBtnText}>⬅️ Ana Modüllere Dön</Text>
            </TouchableOpacity>
            <Text style={{ color: '#c084fc', fontSize: 14, fontWeight: '700' }}>📡 Sinyal &amp; Telegram Modülü</Text>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* TELEGRAM BİLDİRİM AYARLARI */}
            <View style={[styles.sectionCard, { borderColor: 'rgba(0, 136, 204, 0.5)', backgroundColor: 'rgba(0, 136, 204, 0.08)' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: '#38bdf8', margin: 0 }]}>📲 Telegram Bildirim Bağlantısı</Text>
                  <Text style={{ color: telegramToken ? '#10b981' : '#f59e0b', fontSize: 11, marginTop: 4 }}>
                    {telegramToken ? '🟢 Bot Token ve Chat ID Ayarlandı' : '⚠️ Bildirim gönderilmesi için Telegram bilgilerini tanımlayın.'}
                  </Text>
                </View>
                <TouchableOpacity style={[styles.actionChip, { backgroundColor: '#0284c7', borderColor: '#38bdf8' }]} onPress={() => setShowTelegramModal(true)}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>⚙️ Ayarla</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ZAMAN DİLİMİ VE OTOMATİK TARAMA */}
            <View style={[styles.sectionCard, { borderColor: 'rgba(168, 85, 247, 0.5)' }]}>
              <Text style={[styles.cardTitle, { color: '#c084fc' }]}>⏱️ Tarama Zaman Dilimi &amp; Otomasyon</Text>
              
              <Text style={styles.inputLabel}>Zaman Dilimi Seçin</Text>
              <View style={styles.segmentedContainer}>
                {['15m', '1h', '4h', '1d'].map((tf) => (
                  <TouchableOpacity
                    key={tf}
                    style={[styles.segmentedBtn, scanInterval === tf && { backgroundColor: '#a855f7' }]}
                    onPress={() => setScanInterval(tf)}
                  >
                    <Text style={[styles.segmentedText, scanInterval === tf && styles.segmentedTextActive]}>{tf}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[styles.switchRow, { marginTop: 14 }]}>
                <View>
                  <Text style={styles.switchLabel}>🔄 Otomatik 7/24 Piyasa Taraması</Text>
                  <Text style={{ color: '#9ca3af', fontSize: 10 }}>Arka planda periyodik olarak tara ve Telegram'a gönder</Text>
                </View>
                <Switch
                  value={autoScanActive}
                  onValueChange={(val) => {
                    setAutoScanActive(val);
                    if (val && !telegramToken) {
                      Alert.alert("Bilgi", "Otomatik tarama başlatıldı. Bildirim almak için Telegram bilgilerini tanımlamayı unutmayın!");
                    }
                  }}
                  trackColor={{ false: '#374151', true: '#a855f7' }}
                />
              </View>
            </View>

            {/* KRİPTO PARA SEÇİM SEKMESİ */}
            <View style={styles.sectionCard}>
              <Text style={styles.cardTitle}>🪙 Taranacak Kripto Paraları Seçin</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {availableScanCoins.map(coin => {
                  const isSelected = selectedScanCoins.includes(coin);
                  return (
                    <TouchableOpacity
                      key={coin}
                      style={[styles.coinChip, isSelected && styles.coinChipActive]}
                      onPress={() => toggleCoinSelection(coin)}
                    >
                      <Text style={[styles.coinChipText, isSelected && styles.coinChipTextActive]}>
                        {isSelected ? '✓ ' : '+ '}{coin}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* MANUEL TARAMA BUTONU */}
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: '#a855f7', marginVertical: 10 }]}
              onPress={runEnvelopeSignalScan}
              disabled={scanning}
            >
              {scanning ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>📲 Piyasayı Anında Tara ({scanInterval.toUpperCase()})</Text>
              )}
            </TouchableOpacity>

            {/* TARAMA SONUÇLARI LİSTESİ */}
            <View style={styles.sectionCard}>
              <Text style={styles.cardTitle}>📊 Tarama Sonuçları ({scanResults.length})</Text>
              {scanResults && scanResults.length > 0 ? (
                scanResults.map((item, idx) => (
                  <View key={idx} style={styles.tradeItem}>
                    <View style={styles.tradeRow}>
                      <Text style={styles.tickerSymbol}>{item.symbol} ({item.interval})</Text>
                      <View style={[styles.sideBadge, item.signal === 'BUY' ? styles.badgeBuy : item.signal === 'SELL' ? styles.badgeSell : { backgroundColor: 'rgba(156,163,175,0.2)' }]}>
                        <Text style={styles.badgeText}>{item.signal}</Text>
                      </View>
                    </View>
                    <Text style={{ color: '#9ca3af', fontSize: 11, marginTop: 4 }}>
                      Canlı Fiyat: ${item.price.toFixed(2)} | Durum: {item.reason}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: '#9ca3af', textAlign: 'center', padding: 20 }}>
                  ⚠️ Henüz tarama yapılmadı.
                </Text>
              )}
            </View>
          </ScrollView>
        </View>
      )}

      {/* MODÜL 3: BACKTEST MODÜLÜ DETAY SAYFASI */}
      {currentModule === 'backtest_module' && (
        <View style={{ flex: 1 }}>
          <View style={styles.moduleNavHeader}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setCurrentModule('home')}>
              <Text style={styles.backBtnText}>⬅️ Ana Modüllere Dön</Text>
            </TouchableOpacity>
            <Text style={{ color: '#f3f4f6', fontSize: 14, fontWeight: '700' }}>📊 Backtest Modülü</Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>KASA BAKİYESİ</Text>
              <Text style={styles.statValue}>${backtestResult.final_balance.toFixed(2)}</Text>
              <Text style={[styles.statSub, pnlNet >= 0 ? styles.textGreen : styles.textRed]}>
                {pnlNet >= 0 ? '+' : ''}${pnlNet.toFixed(2)} (%{backtestResult.total_return_pct})
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>WIN RATE</Text>
              <Text style={[styles.statValue, { color: '#6366f1' }]}>%{backtestResult.win_rate}</Text>
              <Text style={styles.statSub}>{backtestResult.total_trades} İşlem</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>MAX DRAWDOWN</Text>
              <Text style={[styles.statValue, styles.textRed]}>%{backtestResult.max_drawdown_pct}</Text>
              <Text style={styles.statSub}>Sermaye Riski</Text>
            </View>
          </View>

          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'strategy' && styles.activeTabButton]}
              onPress={() => setActiveTab('strategy')}
            >
              <Text style={[styles.tabText, activeTab === 'strategy' && styles.activeTabText]}>⚙️ Strateji</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'ai' && styles.activeTabButton]}
              onPress={() => setActiveTab('ai')}
            >
              <Text style={[styles.tabText, activeTab === 'ai' && styles.activeTabText]}>🤖 AI Danışman</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'history' && styles.activeTabButton]}
              onPress={() => setActiveTab('history')}
            >
              <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>📋 Geçmiş ({backtestResult.total_trades})</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
            {activeTab === 'strategy' && (
              <View>
                <View style={[styles.sectionCard, { borderColor: 'rgba(245, 158, 11, 0.4)' }]}>
                  <Text style={[styles.cardTitle, { color: '#f59e0b' }]}>📅 Parite &amp; Tarih Filtresi</Text>
                  <View style={styles.inputRow}>
                    <View style={styles.inputCol}>
                      <Text style={styles.inputLabel}>Sembol</Text>
                      <View style={styles.segmentedContainer}>
                        {['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].map((s) => (
                          <TouchableOpacity
                            key={s}
                            style={[styles.segmentedBtn, symbol === s && styles.segmentedBtnActive]}
                            onPress={() => setSymbol(s)}
                          >
                            <Text style={[styles.segmentedText, symbol === s && styles.segmentedTextActive]}>{s.replace('USDT', '')}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <View style={styles.inputCol}>
                      <Text style={styles.inputLabel}>Zaman Dilimi</Text>
                      <View style={styles.segmentedContainer}>
                        {['15m', '1h', '4h', '1d'].map((tf) => (
                          <TouchableOpacity
                            key={tf}
                            style={[styles.segmentedBtn, interval === tf && styles.segmentedBtnActive]}
                            onPress={() => setInterval(tf)}
                          >
                            <Text style={[styles.segmentedText, interval === tf && styles.segmentedTextActive]}>{tf}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                </View>
              </ScrollView>
            )}
          </ScrollView>
        </View>
      )}

      {/* BİNANCE API AYAR MODALI */}
      <Modal visible={showBinanceModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { borderColor: '#f59e0b' }]}>
            <Text style={styles.modalTitle}>🔑 Binance API Tanımlama</Text>
            <Text style={styles.modalSub}>Canlı veya simüle işlemleri gerçekleştirmek için API anahtarlarınızı girin:</Text>

            <Text style={styles.inputLabel}>Binance API Key</Text>
            <TextInput
              style={[styles.input, { marginBottom: 12 }]}
              value={binanceApiKey}
              onChangeText={setBinanceApiKey}
              placeholder="API Key girin..."
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Binance Secret Key</Text>
            <TextInput
              style={[styles.input, { marginBottom: 12 }]}
              value={binanceSecretKey}
              onChangeText={setBinanceSecretKey}
              placeholder="Secret Key girin..."
              placeholderTextColor="#6b7280"
              secureTextEntry
              autoCapitalize="none"
            />

            <View style={[styles.switchRow, { marginBottom: 16 }]}>
              <Text style={{ color: '#fff', fontSize: 13 }}>Testnet (Simülasyon) Modu</Text>
              <Switch value={useTestnet} onValueChange={setUseTestnet} trackColor={{ false: '#374151', true: '#f59e0b' }} />
            </View>

            <TouchableOpacity style={[styles.downloadBtn, { backgroundColor: '#d97706' }]} onPress={saveBinanceConfig} disabled={loadingLive}>
              {loadingLive ? <ActivityIndicator color="#fff" /> : <Text style={styles.downloadBtnText}>💾 Kaydet &amp; Bağlantıyı Test Et</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowBinanceModal(false)}>
              <Text style={styles.closeBtnText}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* TELEGRAM BİLDİRİM AYARLARI MODALI */}
      <Modal visible={showTelegramModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { borderColor: '#38bdf8' }]}>
            <Text style={styles.modalTitle}>📲 Telegram Bildirim Ayarları</Text>
            <Text style={styles.inputLabel}>Telegram Bot Token</Text>
            <TextInput
              style={[styles.input, { marginBottom: 12 }]}
              value={telegramToken}
              onChangeText={setTelegramToken}
              placeholder="Bot Token..."
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
            />
            <Text style={styles.inputLabel}>Telegram Chat ID</Text>
            <TextInput
              style={[styles.input, { marginBottom: 16 }]}
              value={telegramChatId}
              onChangeText={setTelegramChatId}
              placeholder="Chat ID..."
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
            />
            <TouchableOpacity style={[styles.downloadBtn, { backgroundColor: '#0284c7' }]} onPress={saveTelegramConfig}>
              <Text style={styles.downloadBtnText}>💾 Kaydet ve Test Et</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowTelegramModal(false)}>
              <Text style={styles.closeBtnText}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* RENDER SUNUCU AYARLARI MODALI */}
      <Modal visible={showServerModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { borderColor: '#10b981' }]}>
            <Text style={styles.modalTitle}>🌐 Canlı Sunucu (API) Ayarları</Text>
            <TextInput
              style={[styles.input, { color: '#10b981', fontWeight: '600', marginBottom: 16 }]}
              value={tempServerUrl}
              onChangeText={setTempServerUrl}
              placeholder="https://trading-bot-33es.onrender.com"
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
            />
            <TouchableOpacity style={[styles.downloadBtn, { backgroundColor: '#10b981' }]} onPress={saveServerUrl}>
              <Text style={styles.downloadBtnText}>💾 Kaydet ve Güncelle</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowServerModal(false)}>
              <Text style={styles.closeBtnText}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* OTOMATİK GÜNCELLEME MODALI */}
      {updateInfo && (
        <Modal visible={showUpdateModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>🚀 Yeni Sürüm Yüklensin mi?</Text>
              <TouchableOpacity
                style={styles.downloadBtn}
                onPress={() => {
                  Linking.openURL(updateInfo.downloadUrl);
                  setShowUpdateModal(false);
                }}
              >
                <Text style={styles.downloadBtnText}>📲 Şimdi Güncelle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0f19', paddingTop: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  logoIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  appTitle: { color: '#f3f4f6', fontSize: 16, fontWeight: '700' },
  versionBadge: { backgroundColor: 'rgba(99,102,241,0.25)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: '#6366f1' },
  versionText: { color: '#818cf8', fontSize: 10, fontWeight: '700' },
  appSubTitle: { color: '#9ca3af', fontSize: 10 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  liveText: { color: '#10b981', fontSize: 11, fontWeight: '600' },
  updateNoticeBanner: { backgroundColor: '#a855f7', padding: 10, alignItems: 'center' },
  updateNoticeText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  scrollContent: { flex: 1, padding: 12 },
  sectionCard: { backgroundColor: 'rgba(17,24,39,0.85)', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  cardTitle: { color: '#f3f4f6', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  tickerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  tickerSymbol: { color: '#f3f4f6', fontSize: 13, fontWeight: '700' },
  tickerPrice: { color: '#f3f4f6', fontSize: 13, fontWeight: '700' },
  tickerChange: { fontSize: 11, fontWeight: '600' },
  moduleCard: { backgroundColor: 'rgba(17,24,39,0.9)', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(99,102,241,0.4)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' },
  moduleCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  moduleIconBox: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  moduleTitle: { color: '#ffffff', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  moduleSubTitle: { color: '#9ca3af', fontSize: 11 },
  moduleCardFooter: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', alignItems: 'flex-end' },
  moduleNavHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(17,24,39,0.8)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  backBtn: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  backBtnText: { color: '#818cf8', fontSize: 12, fontWeight: '600' },
  coinChip: { backgroundColor: 'rgba(31,41,55,0.8)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  coinChipActive: { backgroundColor: '#a855f7', borderColor: '#c084fc' },
  coinChipText: { color: '#9ca3af', fontSize: 12, fontWeight: '600' },
  coinChipTextActive: { color: '#ffffff', fontWeight: '700' },
  miniChip: { backgroundColor: '#374151', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  chipText: { color: '#fff', fontSize: 11 },
  statsGrid: { flexDirection: 'row', padding: 12, gap: 8 },
  statCard: { flex: 1, backgroundColor: 'rgba(17,24,39,0.85)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  statLabel: { color: '#9ca3af', fontSize: 9, fontWeight: '700' },
  statValue: { color: '#f3f4f6', fontSize: 16, fontWeight: '700', marginVertical: 2 },
  statSub: { fontSize: 10 },
  textGreen: { color: '#10b981' },
  textRed: { color: '#ef4444' },
  tabContainer: { flexDirection: 'row', marginHorizontal: 12, backgroundColor: 'rgba(17,24,39,0.9)', borderRadius: 10, padding: 4 },
  tabButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  activeTabButton: { backgroundColor: '#6366f1' },
  tabText: { color: '#9ca3af', fontSize: 12, fontWeight: '600' },
  activeTabText: { color: '#ffffff' },
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  inputCol: { flex: 1 },
  inputLabel: { color: '#9ca3af', fontSize: 11, marginBottom: 4 },
  subLabel: { color: '#6b7280', fontSize: 10, fontWeight: '600', marginBottom: 4 },
  input: { backgroundColor: '#1f2937', color: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { color: '#e5e7eb', fontSize: 13, fontWeight: '600' },
  criterionBox: { backgroundColor: 'rgba(0,0,0,0.25)', padding: 12, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  segmentedContainer: { flexDirection: 'row', backgroundColor: '#111827', borderRadius: 8, padding: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  segmentedBtn: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 6 },
  segmentedBtnActive: { backgroundColor: '#6366f1' },
  segmentedText: { color: '#9ca3af', fontSize: 11, fontWeight: '500' },
  segmentedTextActive: { color: '#ffffff', fontWeight: '700' },
  submitBtn: { backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  stickyBottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#0b0f19', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  stickySubmitBtn: { backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 14, alignItems: 'center', boxShadow: '0 4px 20px rgba(99, 102, 241, 0.5)' },
  stickySubmitBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  tradeItem: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', paddingVertical: 10 },
  tradeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sideBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeBuy: { backgroundColor: 'rgba(16,185,129,0.2)' },
  badgeSell: { backgroundColor: 'rgba(239,68,68,0.2)' },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#111827', width: '100%', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#a855f7' },
  modalTitle: { color: '#f3f4f6', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  modalSub: { color: '#9ca3af', fontSize: 12, marginBottom: 14 },
  downloadBtn: { backgroundColor: '#a855f7', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  downloadBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  closeBtn: { paddingVertical: 8, alignItems: 'center', marginTop: 6 },
  closeBtnText: { color: '#9ca3af', fontSize: 13 },
  actionChip: { backgroundColor: 'rgba(168, 85, 247, 0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.4)' }
});
